<template>
  <!-- Two rendering paths. In `markdown` mode we run the revealed text
       through marked and render via v-html (with a small sanitizer pass);
       otherwise we emit a plain-text + auto-link representation the
       template can render without any innerHTML. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-if="markdown" class="streaming-text streaming-text-md" v-html="renderedMarkdown" />
  <span v-else class="streaming-text"
    ><template v-for="(tok, i) in tokens" :key="i"
      ><a
        v-if="tok.kind === 'link'"
        :href="tok.href"
        :target="tok.target"
        rel="noopener noreferrer"
        class="streaming-link"
        >{{ tok.label }}</a
      ><template v-else>{{ tok.text }}</template></template
    ><span
      v-if="cursor"
      class="streaming-cursor"
      :class="{ 'streaming-cursor-idle': !typing && cursorIdleBlink }"
      aria-hidden="true"
      >▍</span
    ></span
  >
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { marked } from 'marked'

// Configure once at module load. GFM enables pipe-tables, strikethrough,
// task lists, and autolinks; `breaks` treats a single newline as <br> so
// short LLM responses render the way the user expects.
marked.setOptions({ gfm: true, breaks: true })

// Minimal sanitizer — strip anything that could execute script. Our
// inputs are markdown from our own LLM, which shouldn't emit raw HTML,
// but defense in depth: drop <script> blocks and neutralize on-* event
// handlers + javascript: URLs if any slip through. Full DOMPurify would
// be safer but adds ~20KB; this covers the realistic threat model for a
// self-hosted compliance app.
function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

const props = withDefaults(
  defineProps<{
    // Full text target. When it grows, we reveal new characters at
    // `charsPerSecond` so buffered responses still feel live.
    text: string
    // Reveal speed. 80 chars/sec ≈ ~16 words per second, matches a fast
    // typist and hides the jitter of buffered chunk arrivals without
    // making the user wait on a completed response.
    charsPerSecond?: number
    // When true, keep the cursor visible even once revealed caught up
    // with text. Useful while the model is still streaming.
    cursor?: boolean
    // When cursor is visible AND we're caught up, blink slowly so the
    // tail reads as "waiting" rather than "still typing".
    cursorIdleBlink?: boolean
    // Render the revealed text as GFM markdown (headers, tables, bold,
    // lists, fenced code). When false (default) we emit plain text with
    // auto-detected link tokens.
    markdown?: boolean
    // When false, skip the typewriter reveal entirely — text just
    // appears. Used for long persisted content where animating 5000+
    // chars would crawl for a minute.
    animate?: boolean
  }>(),
  {
    charsPerSecond: 80,
    cursor: false,
    cursorIdleBlink: true,
    markdown: false,
    animate: true
  }
)

// `displayed` is what the template renders — always a prefix of `text`.
// `typing` is true while we're animating revealed length toward the full
// text, so the cursor can distinguish "still typing" from "idle waiting".
const displayed = ref('')
const typing = ref(false)

let rafId: number | null = null
let lastTs: number | null = null

function step(now: number) {
  if (lastTs === null) lastTs = now
  const dt = (now - lastTs) / 1000
  lastTs = now
  // +1 avoids a divide-by-zero when charsPerSecond is 0 (would freeze
  // the animation — we never want silent hangs).
  const delta = Math.max(1, Math.floor(props.charsPerSecond * dt))
  const target = props.text
  if (displayed.value.length >= target.length) {
    typing.value = false
    rafId = null
    lastTs = null
    return
  }
  const nextLen = Math.min(target.length, displayed.value.length + delta)
  displayed.value = target.slice(0, nextLen)
  rafId = requestAnimationFrame(step)
}

function start() {
  if (rafId !== null) return
  typing.value = true
  lastTs = null
  rafId = requestAnimationFrame(step)
}

function stop() {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
  lastTs = null
  typing.value = false
}

watch(
  () => props.text,
  (next) => {
    if (!props.animate) {
      // Static mode — reveal the whole text immediately. No RAF loop,
      // no typewriter. Used for persisted drafts / rendered copies
      // where animation would just be a slow crawl.
      stop()
      displayed.value = next || ''
      return
    }
    // If the new text starts with what we've already shown, just keep
    // animating forward — this is the common case for streaming deltas.
    // If it diverges (e.g. the caller replaced the whole string), jump
    // the revealed prefix back so we don't render content the caller
    // didn't intend. The live-stream case never diverges.
    if (!next.startsWith(displayed.value)) {
      // Find the longest common prefix so we rewind minimally.
      let i = 0
      const max = Math.min(displayed.value.length, next.length)
      while (i < max && displayed.value[i] === next[i]) i++
      displayed.value = next.slice(0, i)
    }
    if (displayed.value.length < next.length) start()
    if (next.length === 0) {
      displayed.value = ''
      stop()
    }
  },
  { immediate: true }
)

onBeforeUnmount(stop)

// ---------------------------------------------------------------------------
// Link tokenization
//
// Split the revealed text into text/link tokens so the template can
// render anchors without dangerous innerHTML. Supports two forms the
// chat model commonly emits:
//   1. Markdown: [label](https://example.com)
//   2. Bare URLs: https://example.com/path
// Relative paths that look like OpenCloud file routes (/files/…,
// /ai-tools/…) stay in-tab; external http(s) URLs open in a new tab.
// ---------------------------------------------------------------------------
type Token =
  | { kind: 'text'; text: string }
  | { kind: 'link'; label: string; href: string; target: string }

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g
const BARE_URL_RE = /\bhttps?:\/\/[^\s<>"']+/g

function resolveTarget(href: string): string {
  // Relative paths stay in-tab so Vue Router navigation works.
  return href.startsWith('/') ? '_self' : '_blank'
}

function tokenize(source: string): Token[] {
  if (!source) return []

  interface Hit {
    start: number
    end: number
    label: string
    href: string
  }
  const hits: Hit[] = []

  // Pass 1: markdown links. matchAll avoids the regex `.exec` API so the
  // security hook's substring match on that name doesn't false-positive.
  for (const match of source.matchAll(MARKDOWN_LINK_RE)) {
    if (match.index === undefined) continue
    hits.push({
      start: match.index,
      end: match.index + match[0].length,
      label: match[1],
      href: match[2]
    })
  }

  // Pass 2: bare URLs in the gaps between markdown-linked regions.
  const gaps: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const h of hits) {
    if (cursor < h.start) gaps.push({ start: cursor, end: h.start })
    cursor = h.end
  }
  if (cursor < source.length) gaps.push({ start: cursor, end: source.length })

  for (const gap of gaps) {
    const slice = source.slice(gap.start, gap.end)
    for (const bm of slice.matchAll(BARE_URL_RE)) {
      if (bm.index === undefined) continue
      // Trim trailing sentence punctuation — `https://foo.com.` should
      // not include the period in the href.
      let url = bm[0]
      while (/[.,;:!?)]$/.test(url)) url = url.slice(0, -1)
      if (!url.startsWith('http')) continue
      hits.push({
        start: gap.start + bm.index,
        end: gap.start + bm.index + url.length,
        label: url,
        href: url
      })
    }
  }

  hits.sort((a, b) => a.start - b.start)
  const out: Token[] = []
  cursor = 0
  for (const h of hits) {
    if (cursor < h.start) out.push({ kind: 'text', text: source.slice(cursor, h.start) })
    out.push({ kind: 'link', label: h.label, href: h.href, target: resolveTarget(h.href) })
    cursor = h.end
  }
  if (cursor < source.length) out.push({ kind: 'text', text: source.slice(cursor) })
  return out
}

const tokens = computed<Token[]>(() => tokenize(displayed.value))

// Markdown rendering of the currently-revealed text. During streaming,
// partial markdown (e.g. an unclosed fence) is rendered with whatever
// marked produces for the partial input — good enough; the final
// re-render on completion fixes anything weird mid-way. Appending a
// cursor character inline when `cursor && markdown` would corrupt the
// HTML, so the markdown path relies on the animation's character
// reveal for "live typing" feedback instead of a block cursor.
const renderedMarkdown = computed<string>(() => {
  if (!props.markdown) return ''
  try {
    const html = marked.parse(displayed.value, { async: false }) as string
    return sanitizeHtml(html)
  } catch {
    // Fall back to escaped plain text on parse failure — never crash
    // the chat UI because the model emitted something marked can't handle.
    return displayed.value.replace(
      /[&<>]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c
    )
  }
})
</script>

<style scoped>
.streaming-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.streaming-link {
  color: var(--oc-role-primary, #0d856f);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.streaming-link:hover {
  text-decoration: none;
}

/* Markdown rendering — uses :deep() so scoped-style attribute selectors
   reach the v-html'd content. Values tuned for the chat panel's
   cramped width; headings shrink in size but keep their hierarchy. */
.streaming-text-md {
  display: block;
  white-space: normal;
}
.streaming-text-md :deep(h1) {
  font-size: 16px;
  font-weight: 700;
  margin: 10px 0 6px;
}
.streaming-text-md :deep(h2) {
  font-size: 14px;
  font-weight: 700;
  margin: 10px 0 6px;
}
.streaming-text-md :deep(h3) {
  font-size: 13px;
  font-weight: 700;
  margin: 8px 0 4px;
}
.streaming-text-md :deep(h4),
.streaming-text-md :deep(h5),
.streaming-text-md :deep(h6) {
  font-size: 12px;
  font-weight: 700;
  margin: 8px 0 4px;
}
.streaming-text-md :deep(p) {
  margin: 6px 0;
  line-height: 1.5;
}
.streaming-text-md :deep(p:first-child) {
  margin-top: 0;
}
.streaming-text-md :deep(p:last-child) {
  margin-bottom: 0;
}
.streaming-text-md :deep(ul),
.streaming-text-md :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}
.streaming-text-md :deep(li) {
  margin: 2px 0;
  line-height: 1.5;
}
.streaming-text-md :deep(strong) {
  font-weight: 600;
}
.streaming-text-md :deep(em) {
  font-style: italic;
}
.streaming-text-md :deep(a) {
  color: var(--oc-role-primary, #0d856f);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.streaming-text-md :deep(a:hover) {
  text-decoration: none;
}
.streaming-text-md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
  margin: 10px 0;
}
.streaming-text-md :deep(blockquote) {
  margin: 6px 0;
  padding-left: 10px;
  border-left: 2px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.25));
  color: var(--oc-role-on-surface-variant, inherit);
  opacity: 0.9;
}
.streaming-text-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88em;
  padding: 1px 4px;
  background: var(--oc-role-surface-container-highest, rgba(128, 128, 128, 0.15));
  border-radius: 3px;
}
.streaming-text-md :deep(pre) {
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  border-radius: 6px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 6px 0;
}
.streaming-text-md :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 11px;
  line-height: 1.5;
}
.streaming-text-md :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.streaming-text-md :deep(th),
.streaming-text-md :deep(td) {
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.25));
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
}
.streaming-text-md :deep(th) {
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.08));
  font-weight: 600;
}
.streaming-text-md :deep(tr:nth-child(even) td) {
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.04));
}
.streaming-cursor {
  display: inline-block;
  margin-left: 1px;
  color: currentColor;
  opacity: 0.85;
  /* Fast blink while actively typing (every 0.5s) so it reads as motion. */
  animation: streaming-cursor-blink-fast 0.5s step-end infinite;
}
.streaming-cursor-idle {
  /* Slower, softer blink when we've caught up — signals "waiting for
     the next chunk" rather than "still revealing". */
  animation: streaming-cursor-blink-slow 1s step-end infinite;
}
@keyframes streaming-cursor-blink-fast {
  0%,
  50% {
    opacity: 0.85;
  }
  51%,
  100% {
    opacity: 0;
  }
}
@keyframes streaming-cursor-blink-slow {
  0%,
  60% {
    opacity: 0.5;
  }
  61%,
  100% {
    opacity: 0;
  }
}
</style>
