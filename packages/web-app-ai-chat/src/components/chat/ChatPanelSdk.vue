<template>
  <div class="chat-panel">
    <!-- File context bar -->
    <div v-if="selectedFile" class="file-context">
      <span class="file-context-icon">📄</span>
      <span class="file-context-name">{{ selectedFile.name }}</span>
      <button class="file-context-dismiss" @click="clearFile">✕</button>
    </div>

    <!-- File picker -->
    <div v-if="showFilePicker" class="file-picker">
      <input
        ref="filePickerInput"
        v-model="filePathInput"
        type="text"
        placeholder="/path/to/file.md"
        class="file-picker-input"
        @keydown.enter="attachFile"
        @keydown.escape="showFilePicker = false"
      />
      <button class="file-picker-btn" @click="attachFile">Attach</button>
    </div>

    <!-- Active compliance context banner. Shown only when we're in
         compliance mode AND the CompliancePage has published a context.
         Mirrors the legacy sidecar's "framework · coverage% · viewing X"
         summary. -->
    <div v-if="activeContextLabel" class="compliance-context-bar">
      <span class="compliance-context-label">Context</span>
      {{ activeContextLabel }}
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="messages">
      <div v-if="chat.messages.length === 0" class="empty-state">
        <p class="empty-state-text">
          {{
            effectiveMode === 'compliance'
              ? 'Ask about findings, controls, or evidence in your ingested corpus.'
              : 'Ask me anything, or attach a file with the 📎 button to ask about its contents.'
          }}
        </p>
        <div v-if="suggestions.length > 0" class="suggestions">
          <button v-for="s in suggestions" :key="s" class="suggestion-chip" @click="submitRaw(s)">
            {{ s }}
          </button>
        </div>
      </div>

      <div
        v-for="msg in chat.messages"
        :key="msg.id"
        :class="['message', msg.role === 'user' ? 'message-user' : 'message-ai']"
      >
        <!-- Render each UIMessagePart. Text parts become bubbles; custom
             data parts become cards; tool parts become step rows. The
             role label is inline at the top of the first text bubble
             (below) so it reads as a header of the message rather than
             floating in space above it. -->
        <template v-for="(part, pi) in msg.parts" :key="`${msg.id}-${pi}`">
          <!-- Text part. User bubbles render plain; assistant bubbles
               route through StreamingText so buffered agent responses
               feel like they're being typed and live chat-mode deltas
               still animate in smoothly. The trailing cursor is only
               shown for the tail text part of the actively-streaming
               assistant message. The role label shows only on the
               first text part of a message so multi-part replies don't
               repeat "Assistant" for each bubble. -->
          <div v-if="part.type === 'text'" class="message-bubble">
            <span v-if="isFirstTextPart(msg, pi)" class="message-role-inline">{{
              msg.role === 'user' ? 'You' : 'Assistant'
            }}</span>
            <template v-if="msg.role === 'user'">{{ (part as any).text }}</template>
            <StreamingText
              v-else
              :text="(part as any).text || ''"
              :cursor="isStreamingTail(msg, pi)"
              :cursor-idle-blink="true"
              :markdown="true"
            />
          </div>

          <!-- Tool parts (dynamic-tool) — agent step cards -->
          <div v-else-if="isToolPart(part)" class="agent-step-card">
            <div class="agent-step-row">
              <span class="step-status">
                <span
                  v-if="
                    (part as any).state === 'input-streaming' ||
                    (part as any).state === 'input-available'
                  "
                  class="step-spinner"
                  >⏳</span
                >
                <span v-else-if="(part as any).state === 'output-available'" class="step-done"
                  >✓</span
                >
                <span v-else class="step-error">✗</span>
              </span>
              <span class="step-label">{{ toolLabel(part) }}</span>
              <span v-if="toolOutputSummary(part)" class="step-summary">{{
                toolOutputSummary(part)
              }}</span>
            </div>
          </div>

          <!-- Custom data parts -->
          <div
            v-else-if="(part as any).type === 'data-question'"
            class="question-card"
            :class="{ 'card-resolved': isResolved((part as any).data.id) }"
          >
            <div class="question-text">{{ (part as any).data.text }}</div>
            <div v-if="!isResolved((part as any).data.id)" class="question-options">
              <button
                v-for="opt in (part as any).data.options"
                :key="opt"
                class="question-btn"
                @click="answerQuestion((part as any).data.id, opt)"
              >
                {{ opt }}
              </button>
            </div>
            <div v-else class="question-answered">
              Selected: {{ getResolution((part as any).data.id) }}
            </div>
          </div>

          <div
            v-else-if="(part as any).type === 'data-approval'"
            class="approval-card"
            :class="{ 'card-resolved': isResolved((part as any).data.id) }"
          >
            <div class="approval-text">{{ (part as any).data.text }}</div>
            <div
              v-if="(part as any).data.existing || (part as any).data.preview"
              class="diff-container"
            >
              <div v-if="(part as any).data.existing" class="diff-pane">
                <div class="diff-header diff-header-old">Before</div>
                <pre class="diff-content">{{ (part as any).data.existing }}</pre>
              </div>
              <div v-if="(part as any).data.preview" class="diff-pane">
                <div class="diff-header diff-header-new">
                  {{ (part as any).data.existing ? 'After' : 'Content' }}
                </div>
                <pre class="diff-content">{{ (part as any).data.preview }}</pre>
              </div>
            </div>
            <div v-if="(part as any).data.file_path" class="approval-file-path">
              📄 {{ (part as any).data.file_path }}
            </div>
            <div v-if="!isResolved((part as any).data.id)" class="approval-actions">
              <button
                class="btn-approve"
                @click="respondApproval((part as any).data.id, 'approve')"
              >
                Approve
              </button>
              <button class="btn-reject" @click="respondApproval((part as any).data.id, 'reject')">
                Reject
              </button>
            </div>
            <div v-else class="approval-result">
              {{ getResolution((part as any).data.id) === 'approve' ? '✓ Approved' : '✗ Rejected' }}
            </div>
          </div>
        </template>

        <!-- Grounding panel — only rendered for assistant messages in
             compliance mode that came back with at least one citation.
             Shows under the last text bubble so the user can cross-
             reference the claim against its source clause. -->
        <div v-if="msg.role === 'assistant' && groundingFor(msg)" class="grounding-panel">
          <div class="grounding-label">Grounded in:</div>
          <div v-for="(g, gi) in groundingFor(msg)!.hits" :key="gi" class="grounding-hit">
            <strong>{{ g.clause || 'n/a' }}</strong>
            <span class="grounding-source">{{ g.source }}</span>
            <span class="grounding-score">{{ g.score.toFixed(3) }}</span>
          </div>
        </div>

        <!-- "Draft procedure" action — compliance-mode only, on assistant
             messages long enough to have substantive content. Publishes
             a window CustomEvent the CompliancePage listens for so we
             don't need a prop callback wired through. -->
        <div
          v-if="
            msg.role === 'assistant' &&
            effectiveMode === 'compliance' &&
            assistantTextOf(msg).length > 80
          "
          class="msg-actions"
        >
          <button class="msg-action-btn" @click="onDraftProcedure(msg)">
            Draft procedure from this →
          </button>
        </div>
      </div>

      <!-- Live status indicator — visible while the server is working
           but before the first content token lands, or between a tool
           call and the next token. Tells the user "something is
           happening" so the UI doesn't feel frozen. -->
      <div v-if="showStatusIndicator" class="message message-ai">
        <div class="status-indicator">
          <span class="status-indicator-icon">
            <span class="status-dot"></span>
            <span class="status-dot"></span>
            <span class="status-dot"></span>
          </span>
          <span class="status-indicator-label">{{ statusLabel }}</span>
        </div>
      </div>
      <div v-if="chat.error" class="message message-ai">
        <div class="message-bubble" style="color: var(--oc-role-error, #dc2626)">
          {{ chat.error.message }}
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="input-area">
      <button
        class="attach-button"
        :class="{ 'attach-active': selectedFile }"
        title="Attach a file"
        @click="toggleFilePicker"
      >
        📎
      </button>
      <input
        v-model="input"
        type="text"
        placeholder="Ask me anything…"
        class="chat-input"
        :disabled="isBusy"
        @keydown.enter="send"
      />
      <select v-model="mode" class="mode-select" :title="`Mode (currently: ${effectiveMode})`">
        <option value="auto">Auto</option>
        <option value="agent">Agent</option>
        <option value="chat">Chat</option>
        <option value="compliance">Compliance</option>
      </select>
      <button class="send-button" :disabled="isBusy || !input.trim()" @click="send">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, reactive, watch, shallowRef } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, type UIMessage, type UIMessagePart } from 'ai'
import StreamingText from './StreamingText.vue'
import {
  setComplianceContext,
  complianceContext,
  getAiToolsServiceUrl,
  getOpenCloudAccessToken,
  type ChatModePreference,
  type ComplianceContext
} from '@opencloud-eu/web-pkg'

const AI_BACKEND_URL = getAiToolsServiceUrl('agent')
const STORAGE_KEY = 'oc-ai-chat-sdk'

// Unified chat modes after the compliance-sidecar merge:
//   'auto'       — follows the current route (compliance page → compliance
//                  mode, everywhere else → agent mode). Default.
//   'agent'      — tool-calling agent loop.
//   'chat'       — simple streaming chat, no tools.
//   'compliance' — RAG-grounded chat with framework/finding context.
type Mode = 'auto' | 'chat' | 'agent' | 'compliance'

function loadPersisted(): { mode: Mode; conversationId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return { mode: d.mode || 'auto', conversationId: d.conversationId || null }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'auto', conversationId: null }
}

const props = defineProps<{
  // Pending prompt passed in by ChatWidget when an `oc:open-chat-with-prompt`
  // custom event fires while the drawer was closed. We watch
  // `pendingKey` (a counter bumped per event) so identical prompts
  // still retrigger; watching the string alone misses same-text events.
  pendingPrompt?: string
  pendingAutoSubmit?: boolean
  pendingKey?: number
  pendingComplianceContext?: ComplianceContext
  pendingMode?: ChatModePreference
}>()

const emit = defineEmits<{
  // Fired when an external caller wants the chat to be visible — e.g.
  // CompliancePage's inline "Ask AI" buttons. The host widget (which
  // owns the drawer open/close state) listens and flips itself open.
  (e: 'open-request'): void
}>()

const persisted = loadPersisted()
const mode = ref<Mode>(persisted.mode)

// Route-aware detection: the chat widget lives globally so we recompute
// whenever the URL changes (MutationObserver below picks up SPA routes).
const currentPath = ref<string>(window.location.pathname)
function isOnCompliancePage(): boolean {
  return (
    currentPath.value.startsWith('/compliance') ||
    currentPath.value.startsWith('/ai-tools/compliance')
  )
}
const effectiveMode = computed<Exclude<Mode, 'auto'>>(() => {
  if (mode.value !== 'auto') return mode.value
  return isOnCompliancePage() ? 'compliance' : 'agent'
})
const input = ref('')
const conversationId = ref<string | null>(persisted.conversationId)
const messagesContainer = ref<HTMLElement | null>(null)

const selectedFile = ref<{ name: string; path: string } | null>(null)
const showFilePicker = ref(false)
const filePathInput = ref('')
const filePickerInput = ref<HTMLInputElement | null>(null)

// Resolution tracker for question/approval data parts — keyed by the
// action's id from the backend. Reactive so the UI updates when a user
// clicks a button before the next assistant response arrives.
const resolved = reactive<Record<string, string>>({})

function isResolved(id: string): boolean {
  return id in resolved
}
function getResolution(id: string): string {
  return resolved[id] || ''
}

// A one-shot override for the next request's body — lets us inject
// response_to/response_value for question/approval turns without mutating
// the transport (its `body` fn is captured at construction time, and the
// `transport` field is private on AbstractChat so we can't swap it out).
const nextRequestOverride = ref<Record<string, unknown> | null>(null)

// Grounding hits parsed out of `data-grounding` parts, keyed by
// assistant message id. Reactive so the citation panel re-renders as
// new hits land. Shown only in compliance mode.
type GroundingHit = {
  clause: string
  source: string
  section_title?: string
  score: number
  node_id?: string
  text_preview?: string
}
const groundingByMessage = reactive<Record<string, { hits: GroundingHit[] }>>({})

// Build a Chat instance per mode. `shallowRef` so we can swap whole
// instances when the mode changes without Vue deep-proxying the Chat
// internals (which fights its own reactivity wiring).
function makeChat(m: Exclude<Mode, 'auto'>) {
  const api =
    m === 'agent'
      ? `${AI_BACKEND_URL}/api/agent/sdk`
      : m === 'compliance'
        ? `${AI_BACKEND_URL}/api/compliance-chat/sdk`
        : `${AI_BACKEND_URL}/api/chat/sdk`
  return new Chat<UIMessage>({
    transport: new DefaultChatTransport({
      api,
      body: () => {
        if (nextRequestOverride.value) {
          const override = nextRequestOverride.value
          nextRequestOverride.value = null
          return override
        }
        const body: Record<string, unknown> = {}
        // Compliance mode hits a different endpoint that accepts
        // active_framework/active_report_summary/active_finding; other
        // modes use file_url/access_token/conversation_id.
        if (m === 'compliance') {
          const ctx = complianceContext.value
          if (ctx.framework) body.active_framework = ctx.framework
          if (ctx.report_summary) body.active_report_summary = ctx.report_summary
          if (ctx.report_findings) body.active_report_findings = ctx.report_findings
          if (ctx.finding) body.active_finding = ctx.finding
        } else {
          const token = getOpenCloudAccessToken()
          if (token) body.access_token = token
          if (selectedFile.value) body.file_url = buildWebDavUrl(selectedFile.value.path)
          if (conversationId.value) body.conversation_id = conversationId.value
        }
        return body
      }
    }),
    onData: (part) => {
      const p = part as unknown as { type?: string; data?: unknown }
      if (p.type === 'data-chat-meta') {
        const data = p.data as { conversation_id?: string } | undefined
        if (data?.conversation_id) conversationId.value = data.conversation_id
      } else if (p.type === 'data-grounding') {
        // Stash grounding against the upcoming assistant message. onData
        // can fire before the assistant message id settles, so we use
        // 'pending' until onFinish rebinds it.
        const data = p.data as { hits?: GroundingHit[] } | undefined
        if (data?.hits) groundingByMessage.pending = { hits: data.hits }
      }
    },
    onFinish: () => {
      // Bind any pending grounding to the real assistant id.
      if (groundingByMessage.pending) {
        const msgs = chat.value.messages
        const lastAssistant = [...msgs].reverse().find((mm) => mm.role === 'assistant')
        if (lastAssistant) {
          groundingByMessage[lastAssistant.id] = groundingByMessage.pending
          delete groundingByMessage.pending
        }
      }
      scrollToBottom()
    }
  })
}

const chat = shallowRef(makeChat(effectiveMode.value))
// Rebuild the Chat instance when the effective mode changes — either
// via the mode-select dropdown or by navigating on/off the compliance
// route while `mode === 'auto'`.
watch(effectiveMode, (m) => {
  chat.value = makeChat(m)
})

watch([mode, conversationId], () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: mode.value,
        conversationId: conversationId.value
      })
    )
  } catch {
    /* quota */
  }
})

const isBusy = computed(
  () => chat.value.status === 'submitted' || chat.value.status === 'streaming'
)

function isToolPart(part: UIMessagePart<any, any>): boolean {
  const t = (part as { type?: string }).type || ''
  return t === 'dynamic-tool' || t.startsWith('tool-')
}

function groundingFor(msg: UIMessage): { hits: GroundingHit[] } | null {
  return groundingByMessage[msg.id] || null
}

// Helper: the rendered plain-text for an assistant message, used by
// the "Draft procedure from this" action. Concatenates every text part.
function assistantTextOf(msg: UIMessage): string {
  const parts = msg.parts || []
  return parts
    .filter((p) => (p as { type?: string }).type === 'text')
    .map((p) => (p as { text?: string }).text || '')
    .join('')
}

// Active-context summary line shown above the messages in compliance
// mode. Mirrors the legacy sidecar's format so users see familiar
// "Framework · coverage% · viewing ControlId" at a glance.
const activeContextLabel = computed(() => {
  if (effectiveMode.value !== 'compliance') return ''
  const ctx = complianceContext.value
  const parts: string[] = []
  if (ctx.framework) parts.push(ctx.framework)
  if (ctx.report_summary?.coverage_percent !== undefined) {
    parts.push(`${ctx.report_summary.coverage_percent}% coverage`)
  }
  if (ctx.report_findings?.length) {
    const missing = ctx.report_findings.filter((f) => f.status === 'missing').length
    const partial = ctx.report_findings.filter((f) => f.status === 'partial').length
    if (missing || partial) parts.push(`${missing} missing / ${partial} partial`)
  }
  if (ctx.finding?.control_id) parts.push(`viewing ${ctx.finding.control_id}`)
  return parts.join(' · ')
})

// Suggestion chips shown when there are no messages yet. Compliance
// mode adapts based on active framework/finding; agent mode shows
// generic file-centric prompts.
const suggestions = computed<string[]>(() => {
  if (chat.value.messages.length > 0) return []
  if (effectiveMode.value === 'compliance') {
    const ctx = complianceContext.value
    if (ctx.finding?.control_id) {
      const cid = ctx.finding.control_id
      return [
        `What evidence would satisfy ${cid}?`,
        `Draft a remediation plan for ${cid}.`,
        `Why is ${cid} flagged as ${ctx.finding.status || 'needing review'}?`
      ]
    }
    if (ctx.report_summary?.missing && ctx.report_summary.missing > 0) {
      return [
        'Which controls are currently missing evidence?',
        'Prioritize the missing controls by severity.',
        `Draft a remediation roadmap for ${ctx.framework || 'this framework'}.`
      ]
    }
    if (ctx.framework) {
      return [
        `Summarize my ${ctx.framework} coverage.`,
        `What does ${ctx.framework} require for policy documentation?`
      ]
    }
    return [
      'Summarize my active framework coverage.',
      'Which controls are currently missing evidence?',
      'What certificates are about to expire?'
    ]
  }
  return []
})

// Label the role only on the first text part of a message so multi-
// text-part assistant replies don't repeat "Assistant" inline.
function isFirstTextPart(msg: UIMessage, partIdx: number): boolean {
  const parts = msg.parts || []
  for (let i = 0; i < partIdx; i++) {
    if ((parts[i] as { type?: string }).type === 'text') return false
  }
  return (parts[partIdx] as { type?: string }).type === 'text'
}

// Live status line shown while the chat is actively streaming but
// hasn't landed any visible assistant text yet. Three phases:
//   - "Thinking…" right after submit, before any event arrives
//   - "Using <toolName>…" while a tool call is in flight (between
//     tool-input-available and tool-output-available)
//   - nothing once visible text is streaming — the blinking cursor
//     on the text already signals activity, a second indicator is
//     redundant
//
// Earlier bug (fixed): the indicator would flicker off as soon as the
// AI SDK emitted `text-start` (creating an empty text part) because
// the status flipped from 'submitted' → 'streaming' while text length
// was still 0. Now we keep the indicator visible whenever the chat is
// working AND the last assistant message has no text content yet.
const showStatusIndicator = computed<boolean>(() => {
  if (chat.value.status !== 'submitted' && chat.value.status !== 'streaming') return false
  const msgs = chat.value.messages
  if (msgs.length === 0) return true
  const last = msgs[msgs.length - 1]
  if (last.role !== 'assistant') return true
  // Any visible text content? An empty text part (from a text-start
  // with no text-delta yet) doesn't count — we want to keep the
  // "Thinking…" indicator up until real content arrives.
  const hasText = (last.parts || []).some(
    (p) =>
      (p as { type?: string }).type === 'text' && ((p as { text?: string }).text || '').length > 0
  )
  return !hasText
})

const statusLabel = computed<string>(() => {
  const msgs = chat.value.messages
  if (msgs.length === 0) return 'Thinking…'
  const last = msgs[msgs.length - 1]
  if (!last || last.role !== 'assistant') return 'Thinking…'
  const runningTool = (last.parts || []).find((p) => {
    const t = (p as { type?: string }).type || ''
    const state = (p as { state?: string }).state
    return (
      (t === 'dynamic-tool' || t.startsWith('tool-')) &&
      state !== 'output-available' &&
      state !== 'output-error'
    )
  }) as { toolName?: string; name?: string } | undefined
  if (runningTool) {
    const name = runningTool.toolName || runningTool.name || 'tool'
    return `Using ${name}…`
  }
  return 'Thinking…'
})

// Which message parts get the animated cursor? Only the LAST text part
// of the LAST assistant message while the chat is actively streaming.
// Anything earlier has already resolved; later parts haven't been
// emitted yet. This keeps the cursor from splatting across finished
// messages during a multi-turn session.
function isStreamingTail(msg: UIMessage, partIdx: number): boolean {
  if (chat.value.status !== 'streaming' && chat.value.status !== 'submitted') return false
  const msgs = chat.value.messages
  if (msgs.length === 0) return false
  const last = msgs[msgs.length - 1]
  if (last.id !== msg.id) return false
  // Find the index of the last text part in this message.
  let lastTextIdx = -1
  const parts = msg.parts || []
  for (let i = 0; i < parts.length; i++) {
    if ((parts[i] as { type?: string }).type === 'text') lastTextIdx = i
  }
  return partIdx === lastTextIdx
}

function toolLabel(part: any): string {
  const name = part.toolName || part.name || 'tool'
  const input = part.input || {}
  const argStr = Object.values(input)
    .filter((v) => typeof v === 'string')
    .join(', ')
  return `${name}(${argStr})`
}

function toolOutputSummary(part: any): string {
  const out = part.output
  if (!out) return ''
  if (typeof out === 'string') return out
  if (out.status === 'error') return out.error || 'error'
  return out.summary || ''
}

// File context detection (copied from ChatPanel.vue — same heuristic).
function detectCurrentFile(): { name: string; path: string } | null {
  const pathname = decodeURIComponent(window.location.pathname)
  const match = pathname.match(/\/personal\/[^/]+\/(.+?)(?:\?|$)/)
  if (!match) return null
  const filePath = match[1]
  const name = filePath.split('/').pop() || filePath
  if (!name.includes('.')) return null
  return { name, path: '/' + filePath }
}

function updateFileFromUrl() {
  const detected = detectCurrentFile()
  selectedFile.value = detected
  currentPath.value = window.location.pathname
}

// `openWith(prompt, autoSubmit=true)` — imperative hook retained for
// any future caller that grabs a template ref on this component. The
// primary open pathway is the `oc:open-chat-with-prompt` window event,
// which is handled by the host ChatWidget (it owns the drawer state)
// and forwarded here via the `pendingPrompt`/`pendingKey` props.
// Doing both at the panel level duplicated submissions — see the
// pendingKey watcher below for the single source of truth.
function openWith(prompt: string, autoSubmit = true) {
  emit('open-request')
  const text = prompt.trim()
  if (!text) return
  nextTick(() => (autoSubmit ? submitRaw(text) : (input.value = text)))
}

onMounted(() => {
  updateFileFromUrl()
  const observer = new MutationObserver(() => updateFileFromUrl())
  observer.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true,
    characterData: true
  })
})

// Watch the pendingKey counter (bumped per open-with-prompt event by
// ChatWidget) so a second identical prompt still fires. `immediate`
// handles the "panel just mounted with a pending prompt" case without
// a separate onMounted branch — that duplication was causing the Ask
// AI button to submit twice. The undefined → undefined no-op on first
// mount (when there's no pending prompt yet) is filtered by the
// `!k || k === oldK` guard.
watch(
  () => props.pendingKey,
  (k, oldK) => {
    if (!k || k === oldK) return
    const p = props.pendingPrompt || ''
    if (!p) return
    const autoSubmit = props.pendingAutoSubmit !== false
    if (props.pendingComplianceContext) {
      setComplianceContext(props.pendingComplianceContext)
    }
    if (props.pendingMode && props.pendingMode !== mode.value) {
      mode.value = props.pendingMode
    }
    nextTick(() => (autoSubmit ? submitRaw(p) : (input.value = p)))
  },
  { immediate: true }
)

defineExpose({ openWith })

function clearFile() {
  selectedFile.value = null
}

function toggleFilePicker() {
  showFilePicker.value = !showFilePicker.value
  if (showFilePicker.value) {
    filePathInput.value = ''
    nextTick(() => filePickerInput.value?.focus())
  }
}

function attachFile() {
  let path = filePathInput.value.trim()
  if (!path) return
  path = path.split('?')[0]
  if (path.startsWith('http')) {
    try {
      const url = new URL(path)
      if (url.pathname.includes('/remote.php/webdav/')) {
        path = decodeURIComponent(url.pathname.split('/remote.php/webdav')[1] || '/')
      } else {
        const m = url.pathname.match(/\/personal\/[^/]+\/(.+)/)
        if (m) path = '/' + decodeURIComponent(m[1])
        else {
          alert('Paste a file path like /Documents/file.md')
          return
        }
      }
    } catch {
      /* treat as path */
    }
  }
  path = decodeURIComponent(path)
  path = path.startsWith('/') ? path : '/' + path
  const name = path.split('/').pop() || path
  selectedFile.value = { name, path }
  showFilePicker.value = false
  filePathInput.value = ''
}

function buildWebDavUrl(filePath: string): string {
  if (filePath.includes('/remote.php/webdav/')) return filePath
  const origin = window.location.origin
  const clean = filePath.startsWith('/') ? filePath : '/' + filePath
  return `${origin}/remote.php/webdav${clean}`
}

function submitRaw(text: string) {
  if (!text || isBusy.value) return
  void chat.value.sendMessage({ text })
  nextTick(scrollToBottom)
}

// Emit a window event so CompliancePage can spin up a new doc-pipeline
// entry pre-seeded with the chat response — keeps us decoupled from
// the compliance page's imports.
function onDraftProcedure(msg: UIMessage) {
  const payload = {
    content: assistantTextOf(msg),
    grounding: groundingFor(msg)?.hits || []
  }
  window.dispatchEvent(new CustomEvent('oc:draft-procedure-from-chat', { detail: payload }))
}

function send() {
  const text = input.value.trim()
  if (!text || isBusy.value) return
  input.value = ''
  submitRaw(text)
}

// Question/approval responses — re-submit a user turn with response_to +
// response_value in the request body so the backend agent loop knows to
// route it as a response, not a new user message. Uses the one-shot body
// override so we don't need to touch the transport's private fields.
function submitResponse(responseTo: string, responseValue: string, humanLabel: string) {
  resolved[responseTo] = responseValue
  const b: Record<string, unknown> = {
    response_to: responseTo,
    response_value: responseValue
  }
  const token = getOpenCloudAccessToken()
  if (token) b.access_token = token
  if (selectedFile.value) b.file_url = buildWebDavUrl(selectedFile.value.path)
  if (conversationId.value) b.conversation_id = conversationId.value
  nextRequestOverride.value = b
  void chat.value.sendMessage({ text: humanLabel })
  nextTick(scrollToBottom)
}

function answerQuestion(id: string, opt: string) {
  submitResponse(id, opt, opt)
}

function respondApproval(id: string, decision: 'approve' | 'reject') {
  submitResponse(id, decision, decision === 'approve' ? 'Approved' : 'Rejected')
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
</script>

<style scoped>
/* Styles mirror ChatPanel.vue but use OpenCloud design-system role tokens
   throughout so the panel renders correctly in both light and dark theme. */
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #191c1d);
}

.file-context {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.08));
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  font-size: 12px;
}
.file-context-icon {
  font-size: 14px;
}
.file-context-name {
  flex: 1;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.file-context-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  font-size: 14px;
}
.file-context-dismiss:hover {
  opacity: 1;
}

.file-picker {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.06));
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
}
.file-picker-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 5px;
  font-size: 12px;
  background: var(--oc-role-surface, transparent);
  color: var(--oc-role-on-surface, inherit);
  outline: none;
}
.file-picker-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 5px;
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
  cursor: pointer;
  font-size: 12px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty-state {
  opacity: 0.6;
  font-size: 13px;
  text-align: center;
  padding: 40px 10px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}
.message-user {
  align-items: flex-end;
}
.message-ai {
  align-items: flex-start;
}
.message-role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
  color: var(--oc-role-on-surface-variant, inherit);
  opacity: 0.7;
}
.message-user .message-role {
  color: var(--oc-role-primary, #0d856f);
  opacity: 0.9;
}
/* Inline role label — sits inside the bubble as a mini-header so it
   reads as part of the message rather than floating above it. */
.message-role-inline {
  display: block;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  opacity: 0.6;
}
.message-ai .message-role-inline {
  color: var(--oc-role-primary, #0d856f);
}
.message-user .message-role-inline {
  color: var(--oc-role-on-primary, #fff);
  opacity: 0.85;
}

/* Live status indicator (thinking… / using toolName…) */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.08));
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  font-size: 12px;
  color: var(--oc-role-on-surface-variant, inherit);
}
.status-indicator-icon {
  display: inline-flex;
  gap: 3px;
}
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: status-dot-pulse 1.2s infinite ease-in-out;
}
.status-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.status-dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes status-dot-pulse {
  0%,
  60%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
.status-indicator-label {
  font-style: italic;
}
.message-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 88%;
}
.message-user .message-bubble {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
  border-bottom-right-radius: 4px;
}
.message-ai .message-bubble {
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.08));
  color: var(--oc-role-on-surface, inherit);
  border-bottom-left-radius: 4px;
}

.agent-step-card {
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.06));
  border-left: 2px solid var(--oc-role-primary, #0d856f);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 88%;
}
.agent-step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.step-done {
  color: var(--oc-role-primary, #0d856f);
  font-weight: 700;
}
.step-error {
  color: var(--oc-role-error, #dc2626);
  font-weight: 700;
}
.step-label {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}
.step-summary {
  opacity: 0.7;
  font-size: 11px;
  margin-left: auto;
}

.question-card,
.approval-card {
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.06));
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  max-width: 88%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card-resolved {
  opacity: 0.7;
}
.question-options,
.approval-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.question-btn {
  padding: 4px 10px;
  border: 1px solid var(--oc-role-primary, #0d856f);
  background: transparent;
  color: var(--oc-role-primary, #0d856f);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.question-btn:hover {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
}
.btn-approve {
  padding: 4px 12px;
  border: none;
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.btn-reject {
  padding: 4px 12px;
  border: 1px solid var(--oc-role-error, #dc2626);
  background: transparent;
  color: var(--oc-role-error, #dc2626);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.approval-result,
.question-answered {
  font-size: 11px;
  opacity: 0.7;
  font-style: italic;
}
.approval-file-path {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  opacity: 0.7;
}
.diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  font-size: 11px;
}
.diff-pane {
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  border-radius: 4px;
  overflow: hidden;
}
.diff-header {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.diff-header-old {
  background: rgba(220, 38, 38, 0.12);
  color: var(--oc-role-error, #dc2626);
}
.diff-header-new {
  background: rgba(46, 160, 67, 0.12);
  color: #2ea043;
}
.diff-content {
  margin: 0;
  padding: 6px 8px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
}

.input-area {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  flex-shrink: 0;
}
.attach-button {
  background: transparent;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
}
.attach-active {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
}
.chat-input {
  flex: 1;
  padding: 7px 12px;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: var(--oc-role-surface, transparent);
  color: var(--oc-role-on-surface, inherit);
}
.chat-input:focus {
  border-color: var(--oc-role-primary, #0d856f);
}
.mode-select {
  padding: 6px 8px;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  font-size: 12px;
  background: var(--oc-role-surface, transparent);
  color: var(--oc-role-on-surface, inherit);
  cursor: pointer;
}
.send-button {
  width: 32px;
  border: none;
  border-radius: 6px;
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Compliance-mode extensions (folded in from the retired sidecar) */
.compliance-context-bar {
  padding: 6px 14px;
  font-size: 11px;
  color: var(--oc-role-on-surface-variant, inherit);
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.05));
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.1));
  flex-shrink: 0;
}
.compliance-context-label {
  font-weight: 700;
  margin-right: 6px;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: var(--oc-role-primary, #0d856f);
}

.empty-state-text {
  margin: 0 0 10px;
}
.suggestions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.suggestion-chip {
  text-align: left;
  padding: 6px 10px;
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  color: inherit;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.suggestion-chip:hover {
  background: var(--oc-role-surface-container-highest, rgba(128, 128, 128, 0.12));
}

.grounding-panel {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.06));
  border-left: 2px solid var(--oc-role-primary, #0d856f);
  border-radius: 4px;
  font-size: 11px;
  max-width: 88%;
}
.grounding-label {
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--oc-role-primary, #0d856f);
}
.grounding-hit {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.grounding-source {
  opacity: 0.7;
  font-family: ui-monospace, monospace;
  font-size: 10px;
}
.grounding-score {
  opacity: 0.5;
  font-size: 10px;
  margin-left: auto;
}

.msg-actions {
  margin-top: 6px;
}
.msg-action-btn {
  font-size: 11px;
  background: transparent;
  border: 1px solid var(--oc-role-primary, #0d856f);
  color: var(--oc-role-primary, #0d856f);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.msg-action-btn:hover {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
}

/* Mobile: shrink chat-panel text sizes and relax overflow constraints
   so rendered markdown tables scroll within the bubble rather than
   blowing out the panel width. */
@media (max-width: 600px) {
  .message-bubble {
    max-width: 95%;
    font-size: 12px;
  }
  .agent-step-card,
  .question-card,
  .approval-card,
  .grounding-panel {
    max-width: 95%;
  }
}
</style>
