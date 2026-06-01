/**
 * Shared reactive compliance context + global chat open hook.
 *
 * The top-bar chat (ChatPanelSdk) lives outside CompliancePage.vue's
 * component tree, so provide/inject won't reach it. We export a small
 * module with module-level `ref`s — both sides import the same module
 * and therefore see the same reactive state. No store library needed.
 *
 * Context shape matches what /api/compliance-chat/sdk expects in its
 * request body (framework slug, report rollup, active finding).
 *
 * The `openChatWithPrompt` event-bridge is the equivalent for imperative
 * "open the chat with this question" actions — CompliancePage dispatches
 * it via window.dispatchEvent(new CustomEvent(...)), the chat widget
 * listens and flips itself open.
 */
import { ref } from 'vue'

export type ComplianceContext = {
  framework?: string | null
  report_summary?: {
    total_controls?: number
    covered?: number
    partial?: number
    missing?: number
    coverage_percent?: number
  } | null
  report_findings?:
    | {
        control_id?: string
        control_title?: string
        status?: string
        severity?: string
        top_score?: number
        top_evidence?: string
        next_action?: string
      }[]
    | null
  finding?: {
    control_id?: string
    control_title?: string
    status?: string
    lifecycle_status?: string
    framework?: string
    control_section?: string
    severity?: string
    top_score?: number
    reasoning?: string
    evidence?: {
      source?: string
      clause?: string
      section_title?: string
      score?: number
      text?: string
      node_id?: string
    }[]
  } | null
}

export type ChatModePreference = 'auto' | 'chat' | 'agent' | 'compliance'

export type OpenChatWithPromptOptions = {
  autoSubmit?: boolean
  complianceContext?: ComplianceContext
  mode?: ChatModePreference
}

export type OpenChatEventDetail = {
  prompt: string
  autoSubmit: boolean
  complianceContext?: ComplianceContext
  mode?: ChatModePreference
}

export const complianceContext = ref<ComplianceContext>({})

/** Publish a new compliance context (or clear it by passing {}). */
export function setComplianceContext(ctx: ComplianceContext): void {
  complianceContext.value = ctx
}

// Event name the chat widget listens for. Custom-event payload is the
// pre-seeded prompt; the widget opens itself and submits.
export const OPEN_CHAT_EVENT = 'oc:open-chat-with-prompt'

export function openChatWithPrompt(
  prompt: string,
  autoSubmitOrOptions: boolean | OpenChatWithPromptOptions = true
): void {
  const options =
    typeof autoSubmitOrOptions === 'boolean'
      ? { autoSubmit: autoSubmitOrOptions }
      : autoSubmitOrOptions
  window.dispatchEvent(
    new CustomEvent<OpenChatEventDetail>(OPEN_CHAT_EVENT, {
      detail: {
        prompt,
        autoSubmit: options.autoSubmit !== false,
        complianceContext: options.complianceContext,
        mode: options.mode
      }
    })
  )
}
