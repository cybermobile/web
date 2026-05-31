<template>
  <div class="chat-widget">
    <!-- Topbar trigger button rendered inline by app.runtime.header.right. -->
    <button
      type="button"
      class="chat-nav-btn"
      :class="{ active: isOpen }"
      title="AI Chat"
      aria-label="AI Chat"
      :aria-pressed="isOpen"
      @click="toggleChat"
    >
      <svg
        v-if="!isOpen"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- Right-side slide-in panel. The `expanded` class bumps the
         drawer width +35% for wider markdown/table rendering. -->
    <Transition name="slide">
      <div v-if="isOpen" class="chat-drawer" :class="{ 'chat-drawer-expanded': expanded }">
        <div class="chat-drawer-header">
          <span>AI Chat</span>
          <button
            type="button"
            class="chat-drawer-expand-btn"
            :title="expanded ? 'Collapse chat' : 'Expand chat to see wider content'"
            :aria-label="expanded ? 'Collapse chat' : 'Expand chat'"
            @click="expanded = !expanded"
          >
            <!-- Collapse icon (← arrow into a frame) when expanded,
                 expand icon (↔ outward arrows) when collapsed. -->
            <svg
              v-if="expanded"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            <svg
              v-else
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
        </div>
        <div class="chat-drawer-body">
          <ChatPanelSdk
            :pending-prompt="pendingPrompt"
            :pending-auto-submit="pendingAutoSubmit"
            :pending-key="pendingKey"
            @open-request="isOpen = true"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import ChatPanelSdk from './ChatPanelSdk.vue'
import { OPEN_CHAT_EVENT } from '@opencloud-eu/web-pkg'

// Expanded mode adds 45% to the drawer width (420 → 610 px) for cases
// where the user's reading a markdown table or long code block. Saved
// to localStorage so a reload keeps the preference.
const EXPAND_KEY = 'oc-chat-expanded'
const expanded = ref<boolean>(false)
try {
  if (localStorage.getItem(EXPAND_KEY) === '1') expanded.value = true
} catch {
  /* private mode */
}
watch(expanded, (v) => {
  try {
    localStorage.setItem(EXPAND_KEY, v ? '1' : '0')
  } catch {
    /* quota */
  }
})

const isOpen = ref(false)
// Pending prompt supplied by a `oc:open-chat-with-prompt` custom event.
// Passed down to ChatPanelSdk as a prop; the panel watches for changes
// and submits. We clear it after forwarding so re-opening the drawer
// doesn't re-fire the same prompt.
const pendingPrompt = ref<string>('')
const pendingAutoSubmit = ref<boolean>(true)
let pendingSeq = 0
const pendingKey = ref<number>(0) // bumped per event so identical prompts still trigger

function onOpenChatEvent(ev: Event) {
  const detail = (ev as CustomEvent<{ prompt?: string; autoSubmit?: boolean }>).detail
  if (!detail) return
  isOpen.value = true
  pendingPrompt.value = detail.prompt || ''
  pendingAutoSubmit.value = detail.autoSubmit !== false
  pendingKey.value = ++pendingSeq
}

onMounted(() => window.addEventListener(OPEN_CHAT_EVENT, onOpenChatEvent))
onUnmounted(() => window.removeEventListener(OPEN_CHAT_EVENT, onOpenChatEvent))

function getContentEl(): HTMLElement | null {
  return document.getElementById('web-content-main')
}

function toggleChat() {
  isOpen.value = !isOpen.value
}

// Keep the host content's right-padding in sync with the drawer's open
// state AND expansion — watch both. Expanded drawer = 570px wide, so
// content needs a matching 590px of breathing room on the right.
function applyContentPadding() {
  const el = getContentEl()
  if (!el) return
  el.style.transition = 'padding-right 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
  const isMobile = window.matchMedia('(max-width: 600px)').matches
  if (!isOpen.value || isMobile) {
    el.style.paddingRight = ''
    return
  }
  el.style.paddingRight = expanded.value ? '630px' : '440px'
}
watch([isOpen, expanded], applyContentPadding)

onUnmounted(() => {
  const el = getContentEl()
  if (el) {
    el.style.transition = ''
    el.style.paddingRight = ''
  }
})
</script>

<style scoped>
.chat-widget {
  display: flex;
  align-items: center;
}

.chat-nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--oc-role-on-chrome, currentColor);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.chat-nav-btn:hover,
.chat-nav-btn.active {
  background: rgba(255, 255, 255, 0.15);
}

.chat-drawer {
  position: fixed;
  top: 60px;
  right: 10px;
  bottom: 10px;
  width: 420px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--oc-role-surface-container, #f6f8fa);
  box-shadow: -4px 0 32px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 12px;
  overflow: hidden;
  /* Width transition matches the same cubic-bezier as the host
     content's padding-right shift, so the two move in lockstep and
     there's no visible gap between them while animating. */
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-drawer-expanded {
  /* 420 × 1.45 = 609 — rounded to 610 for a clean number. Capped to
     92vw so it can't eat the whole viewport on a medium-sized tablet. */
  width: min(610px, 92vw);
}

.chat-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  min-height: 56px;
  background: var(--oc-role-chrome, #20434f);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.chat-drawer-expand-btn {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  transition:
    opacity 0.15s,
    background 0.15s;
}
.chat-drawer-expand-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.chat-drawer-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

/* Phone: the 420px drawer eats the entire screen on a narrow device.
   Go full-width with minimal insets so messages get max room, and
   also pad the body's right-shift so content isn't pushed off-screen
   when the drawer opens (the 440px padding set elsewhere). */
@media (max-width: 600px) {
  .chat-drawer,
  .chat-drawer-expanded {
    /* Drawer is already full-width on phones — expanding it is a no-op,
       so also hide the toggle to reduce visual clutter. */
    top: 56px;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100vw;
    border-radius: 0;
    border: none;
  }
  .chat-drawer-expand-btn {
    display: none;
  }
}
</style>
