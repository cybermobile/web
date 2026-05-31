import { computed, unref } from 'vue'
import { useAuthStore, useConfigStore } from './piniaStores'

export type AiToolsService = 'agent' | 'rclone' | 'confluence'

export type AiToolsOptions = {
  agentUrl?: string
  rcloneUrl?: string
  confluenceUrl?: string
}

const optionKeyByService: Record<AiToolsService, keyof AiToolsOptions> = {
  agent: 'agentUrl',
  rclone: 'rcloneUrl',
  confluence: 'confluenceUrl'
}

function fallbackServiceUrl(service: AiToolsService): string {
  const hostnameParts = window.location.hostname.split('.').filter(Boolean)
  const baseHostname =
    hostnameParts.length > 2 ? hostnameParts.slice(1).join('.') : window.location.hostname

  return `${window.location.protocol}//${service}.${baseHostname}`
}

export function getAiToolsServiceUrl(service: AiToolsService): string {
  const configStore = useConfigStore()
  const aiToolsOptions = (configStore.options as { aiTools?: AiToolsOptions }).aiTools || {}
  const configuredUrl = aiToolsOptions[optionKeyByService[service]]

  return configuredUrl?.replace(/\/$/, '') || fallbackServiceUrl(service)
}

export function getOpenCloudAccessToken(): string | null {
  const windowToken = (window as { __opencloud_access_token?: string }).__opencloud_access_token

  if (windowToken) {
    return asBearerToken(windowToken)
  }

  const authStore = useAuthStore()
  if (authStore.accessToken) {
    return asBearerToken(authStore.accessToken)
  }

  const configStore = useConfigStore()
  const currentServer = unref(configStore.serverUrl) || window.location.origin
  const candidates: { key: string; token: string; expiresAt?: number }[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)

    if (!key) {
      continue
    }

    try {
      const data = JSON.parse(localStorage.getItem(key) || '')

      if (data.access_token) {
        candidates.push({
          key,
          token: data.access_token,
          expiresAt: typeof data.expires_at === 'number' ? data.expires_at : undefined
        })
      }
    } catch {
      // Skip malformed storage entries from other OpenCloud subsystems.
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const validCandidates = candidates.filter((candidate) => {
    return !candidate.expiresAt || candidate.expiresAt > nowSeconds
  })
  const currentSession = validCandidates.find((candidate) => candidate.key.includes(currentServer))
  const legacyOpenCloudSession = validCandidates.find((candidate) =>
    candidate.key.startsWith('oc_')
  )
  const fallbackSession = validCandidates[0]
  const selectedSession = currentSession || legacyOpenCloudSession || fallbackSession

  return selectedSession ? asBearerToken(selectedSession.token) : null
}

function asBearerToken(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export function useAiToolsConfig() {
  const configStore = useConfigStore()

  const agentUrl = computed(() => getAiToolsServiceUrl('agent'))
  const rcloneUrl = computed(() => getAiToolsServiceUrl('rclone'))
  const confluenceUrl = computed(() => getAiToolsServiceUrl('confluence'))

  return {
    agentUrl,
    rcloneUrl,
    confluenceUrl,
    aiToolsOptions: computed(
      () => (unref(configStore.options) as { aiTools?: AiToolsOptions }).aiTools || {}
    )
  }
}
