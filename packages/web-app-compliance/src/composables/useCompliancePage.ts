import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey
} from 'vue'
import {
  setComplianceContext,
  openChatWithPrompt,
  getAiToolsServiceUrl,
  getOpenCloudAccessToken,
  type ComplianceContext
} from '@opencloud-eu/web-pkg'
import {
  compliancePathForTab,
  complianceTabFromPath,
  isComplianceRoute,
  isComplianceTabPinned,
  type ComplianceTab
} from './useComplianceRouteState'
import {
  COMPLIANCE_COVERAGE_ORDER as COVERAGE_ORDER,
  COMPLIANCE_COVERED_THRESHOLD as COVERED_THRESHOLD,
  COMPLIANCE_PARTIAL_THRESHOLD as PARTIAL_THRESHOLD,
  COMPLIANCE_SEVERITY_ORDER as SEVERITY_ORDER,
  nextComplianceFindingAction,
  type ComplianceFinding as Finding,
  type ComplianceFindingEvidence as Evidence,
  type ComplianceFindingSeverity as Severity
} from './useComplianceFindings'
import {
  COMPLIANCE_DOCUMENT_COLUMNS as DOC_COLUMNS,
  canAdvanceComplianceDocument,
  canRegenerateComplianceDocumentDraft,
  canRejectComplianceDocument,
  nextComplianceDocumentActionLabel,
  type ComplianceDocumentStage as DocStage
} from './useComplianceDocuments'
import {
  buildComplianceEvidenceGroups,
  complianceAnomalyDetailLine,
  type ComplianceAnomaly as Anomaly,
  type ComplianceEvidenceGroup as EvidenceGroup
} from './useComplianceEvidence'
import { requestComplianceFormJson, requestComplianceJson } from './useComplianceApi'
import {
  countMissingRequiredFrameworkDocs,
  readFrameworksResponse,
  type ComplianceFrameworkLibraryEntry as FrameworkLibraryEntry,
  type ComplianceFrameworkSummary as FrameworkSummary
} from './useComplianceFrameworks'

export function createCompliancePage() {
  // Build the "Ask AI" prompts via the shared open-chat-with-prompt event
  // bridge. The global chat widget listens for the event, opens itself,
  // and submits. Keeps CompliancePage decoupled from the chat component.
  function askAboutFinding(f: StoredFinding) {
    activeChatFinding.value = complianceContextFinding(f)
    const context = buildChatContext(activeReport.value, activeChatFinding.value)
    setComplianceContext(context)
    openChatWithPrompt(
      `Explain finding ${f.control_id} (${f.control_title}). Its current coverage is "${f.coverage}" with severity "${f.severity}". What evidence would close this gap?`,
      {
        mode: 'compliance',
        complianceContext: context
      }
    )
  }
  function askAboutAnomaly(a: Anomaly) {
    const d = a.details || {}
    if (a.kind === 'overdue_cert') {
      openChatWithPrompt(
        `The certificate "${d.name}" for ${d.vessel || 'the fleet'} is ${d.days_overdue || 0} days overdue. What remediation steps should I take, and which ISM/ISO clauses require it?`
      )
    } else if (a.kind === 'cert_expiring_soon') {
      openChatWithPrompt(
        `The certificate "${d.name}" for ${d.vessel || 'the fleet'} expires in ${d.days_until || 0} days. What renewal procedure applies and which clauses require advance renewal?`
      )
    } else if (a.kind === 'missed_drill') {
      openChatWithPrompt(
        `Drill "${d.name}" on ${d.vessel || 'the fleet'} was missed. What's the compliance impact and what should I document for the next audit?`
      )
    } else if (a.kind === 'event_spike') {
      openChatWithPrompt(
        `Events of type "${a.event_type}" are at ${d.recent_count}× in the last 7 days (baseline ${d.daily_avg_30d}/day). What does this usually indicate?`
      )
    }
  }

  const AGENT_URL = getAiToolsServiceUrl('agent')

  type SortKey = 'coverage' | 'severity' | 'control_id' | 'control_title' | 'top_score' | 'source'
  type SortDir = 'asc' | 'desc'

  type Report = {
    framework: string
    version: string
    total_controls: number
    covered: number
    partial: number
    missing: number
    coverage_percent: number
    findings: Finding[]
  }

  function tabFromUrl(): ComplianceTab {
    return complianceTabFromPath()
  }

  const activeTab = ref<ComplianceTab>(tabFromUrl())

  function openFrameworksTab() {
    activeTab.value = 'frameworks'
    loadFrameworkLibrary()
  }

  function openFindingsTab() {
    activeTab.value = 'findings'
    loadPersistedFindings()
  }

  function openEvidenceTab() {
    activeTab.value = 'evidence'
    buildEvidenceView()
    loadExpiringCertificates()
  }

  function openDocumentsTab() {
    activeTab.value = 'documents'
    loadDocuments()
  }

  // Pushes a URL change when the user switches tabs in the UI. Guarded so
  // it's a no-op when we're already on the target path — keeps the back
  // button stack clean.
  let routeSyncSilent = false
  watch(activeTab, (next) => {
    if (routeSyncSilent) return
    if (!isComplianceRoute()) return // Outside the compliance route — shouldn't happen.
    const currentTab = complianceTabFromPath()
    if (currentTab === next) return
    window.history.pushState({}, '', compliancePathForTab(next) + window.location.search)
  })

  // React to browser back/forward. Popstate fires for both user navigation
  // and programmatic history.back()/forward(). Mirrors each tab's lazy data
  // load so a deep-link lands populated rather than showing an empty panel.
  function onPopstate(): void {
    const next = tabFromUrl()
    if (next === activeTab.value) return
    routeSyncSilent = true
    activeTab.value = next
    if (next === 'frameworks') void loadFrameworkLibrary()
    else if (next === 'findings') void loadPersistedFindings()
    else if (next === 'evidence') {
      void buildEvidenceView()
      void loadExpiringCertificates()
    } else if (next === 'documents') void loadDocuments()
    void nextTick(() => {
      routeSyncSilent = false
    })
  }
  onMounted(() => window.addEventListener('popstate', onPopstate))
  onBeforeUnmount(() => window.removeEventListener('popstate', onPopstate))

  // --- Framework Library (P1 onboarding) ---------------------------------
  const frameworkLibrary = ref<FrameworkLibraryEntry[]>([])
  const frameworkLibraryLoading = ref(false)
  const frameworkUploading = ref<string>('') // format: `${slug}:${key}` while a single upload is in flight
  const frameworkUploadMessage = ref<string>('')
  const frameworkUploadOk = ref<boolean>(true)
  const frameworksMissingCount = computed(() =>
    countMissingRequiredFrameworkDocs(frameworkLibrary.value)
  )

  async function loadFrameworkLibrary(): Promise<void> {
    frameworkLibraryLoading.value = true
    try {
      frameworkLibrary.value = await requestComplianceJson<FrameworkLibraryEntry[]>(
        AGENT_URL,
        '/frameworks/library'
      )
    } catch (exc) {
      frameworkUploadOk.value = false
      frameworkUploadMessage.value = `Failed to load frameworks: ${exc instanceof Error ? exc.message : exc}`
    } finally {
      frameworkLibraryLoading.value = false
    }
  }

  async function onFrameworkUpload(ev: Event, slug: string, key: string): Promise<void> {
    const input = ev.target as HTMLInputElement
    const file = input.files && input.files[0]
    if (!file) return
    frameworkUploading.value = `${slug}:${key}`
    frameworkUploadMessage.value = ''
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await requestComplianceFormJson<{ chunks?: number }>(
        AGENT_URL,
        `/frameworks/${encodeURIComponent(slug)}/documents/${encodeURIComponent(key)}/upload`,
        form
      )
      frameworkUploadOk.value = true
      frameworkUploadMessage.value = `${file.name} ingested → ${data.chunks} chunks.`
      await loadFrameworkLibrary()
    } catch (exc) {
      frameworkUploadOk.value = false
      frameworkUploadMessage.value = `Upload failed: ${exc instanceof Error ? exc.message : exc}`
    } finally {
      frameworkUploading.value = ''
      // Reset the input so picking the same file again still fires change.
      input.value = ''
    }
  }
  const frameworks = ref<FrameworkSummary[]>([])
  // Initialize to `true` so first paint shows the "Loading frameworks…" card
  // rather than a false "No frameworks available" empty state (loadFrameworks
  // doesn't run until onMounted, which fires AFTER the first render).
  const loading = ref<boolean>(true)
  // Top-of-page banner: only set by the framework LIST fetch.
  const frameworkLoadError = ref<string>('')
  // Per-framework analysis errors, shown inside each framework card. Keyed by slug.
  const analysisErrors = ref<Record<string, string>>({})
  const running = ref<Record<string, boolean>>({})
  const reports = ref<Record<string, Report>>({})
  const activeReportSlug = ref<string>('')
  const filter = ref<'all' | 'covered' | 'partial' | 'missing'>('all')
  const expanded = ref<Record<string, boolean>>({})
  // A6: free-text search across the findings table
  const searchQuery = ref<string>('')
  // A5: current sort state — default to "coverage" (missing first) so auditors
  // see the gaps at the top without needing to click anything.
  const sortKey = ref<SortKey>('coverage')
  const sortDir = ref<SortDir>('asc')
  // A7: advanced filters
  const severityFilter = ref<'all' | Severity>('all')
  const clausePrefix = ref<string>('')
  const noEvidenceOnly = ref<boolean>(false)
  // A9: transient "Copied" label on the copy-citation button. Key = `${control_id}-${evidenceIndex}`.
  const copiedKey = ref<string>('')
  // B6: corpus metadata
  type CorpusStats = {
    collection: string
    total_chunks: number
    sources: { source: string; framework: string; chunks: number }[]
  }
  const corpusStats = ref<CorpusStats | null>(null)
  // Show top-12 corpus sources by default; expand on demand. Most fleets
  // accumulate 100+ ingested filenames — dumping them all makes the card
  // feel unusable.
  const showAllCorpusSources = ref(false)

  // First-run onboarding state. Derived from the same signals the rest
  // of the page already computes — no new backend calls needed.
  //   framework: have any required framework docs been ingested?
  //   analysis:  does any gap-analysis report exist?
  //   findings:  has the user clicked into Findings at least once?
  // The user can dismiss the card permanently via the X button; the
  // dismissal is stored in localStorage so a reload remembers.
  const ONBOARDING_DISMISSED_KEY = 'oc-compliance-onboarding-dismissed'
  const onboardingDismissed = ref<boolean>(
    (() => {
      try {
        return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1'
      } catch {
        return false
      }
    })()
  )
  const onboardingState = computed(() => ({
    framework: frameworkLibrary.value.some((fw) => fw.all_required_ingested),
    analysis: Object.keys(reports.value).length > 0,
    findings: persistedFindings.value.length > 0
  }))
  const showOnboarding = computed(() => {
    if (onboardingDismissed.value) return false
    const s = onboardingState.value
    // Self-hide once all three are done; user gets the space back.
    return !(s.framework && s.analysis && s.findings)
  })
  function dismissOnboarding() {
    onboardingDismissed.value = true
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1')
    } catch {
      /* quota */
    }
  }
  // Milestone 2 task 8 — scan-ingest UI state
  const scanDialogOpen = ref(false)
  const scanPath = ref('/')
  const scanFramework = ref('')
  const scanRunning = ref(false)
  const scanResult = ref<{
    ingested: number
    skipped: number
    errors: number
    results: any[]
  } | null>(null)
  const scanError = ref('')
  // C1: run history
  type RunSummary = {
    id: number
    framework: string
    run_at: string
    total_controls: number
    covered: number
    partial: number
    missing: number
    coverage_percent: number
  }
  const runHistory = ref<RunSummary[]>([])

  // Findings tab state
  // Backend-persisted finding. Differs from the in-memory `Finding` in two ways:
  // 1. `coverage` is a distinct field ("covered" | "partial" | "missing"),
  //    whereas Finding uses `status` for that. StoredFinding's `status` means
  //    lifecycle state ("open" | "in_progress" | "closed").
  // 2. Adds `id`, `notes`, `created_at`, `updated_at` from the SQLite row.
  type StoredFinding = Omit<Finding, 'status'> & {
    id: number
    status: 'open' | 'in_progress' | 'closed'
    coverage: 'covered' | 'partial' | 'missing'
    notes: string
    created_at: string
    updated_at: string
  }
  const persistedFindings = ref<StoredFinding[]>([])
  const activeChatFinding = ref<ComplianceContext['finding']>(null)
  const findingsCount = ref<{ open: number; in_progress: number; closed: number }>({
    open: 0,
    in_progress: 0,
    closed: 0
  })
  const findingsFilter = ref<{ framework: string; status: string; severity: string }>({
    framework: '',
    status: '',
    severity: ''
  })

  function complianceContextFinding(f: StoredFinding): NonNullable<ComplianceContext['finding']> {
    return {
      control_id: f.control_id,
      control_title: f.control_title,
      control_section: f.control_section,
      framework: f.framework,
      status: f.coverage,
      lifecycle_status: f.status,
      severity: f.severity,
      top_score: f.top_score,
      reasoning: f.reasoning,
      evidence: f.evidence.slice(0, 5).map((ev) => ({
        source: ev.source,
        clause: ev.clause,
        section_title: ev.section_title,
        score: ev.score,
        text: ev.text,
        node_id: ev.node_id
      }))
    }
  }

  function buildChatContext(
    report: Report | null,
    activeFinding: ComplianceContext['finding']
  ): ComplianceContext {
    const findingsForContext = report
      ? report.findings
          .filter((f) => f.status !== 'covered')
          .sort((a, b) => {
            const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
            if (sev !== 0) return sev
            const cov = COVERAGE_ORDER[a.status] - COVERAGE_ORDER[b.status]
            if (cov !== 0) return cov
            return a.control_id.localeCompare(b.control_id, undefined, { numeric: true })
          })
          .slice(0, 25)
          .map((f) => ({
            control_id: f.control_id,
            control_title: f.control_title,
            status: f.status,
            severity: f.severity,
            top_score: f.top_score,
            top_evidence: f.evidence[0]?.source || '',
            next_action: nextActionFor(f)
          }))
      : null

    return {
      framework: report?.framework || activeFinding?.framework || null,
      report_summary: report
        ? {
            total_controls: report.total_controls,
            covered: report.covered,
            partial: report.partial,
            missing: report.missing,
            coverage_percent: report.coverage_percent
          }
        : null,
      report_findings: findingsForContext,
      finding: activeFinding
    }
  }
  // Client-side text search — framework/status/severity narrow the server
  // query; the search box filters what came back. Case-insensitive match
  // across control_id, control_title, reasoning, and notes so the user can
  // find findings by a phrase they remember.
  const findingsSearch = ref('')
  const filteredPersistedFindings = computed(() => {
    const q = findingsSearch.value.trim().toLowerCase()
    if (!q) return persistedFindings.value
    return persistedFindings.value.filter((f) => {
      return (
        (f.control_id || '').toLowerCase().includes(q) ||
        (f.control_title || '').toLowerCase().includes(q) ||
        (f.reasoning || '').toLowerCase().includes(q) ||
        (f.notes || '').toLowerCase().includes(q) ||
        (f.framework || '').toLowerCase().includes(q)
      )
    })
  })
  const editingFinding = ref<StoredFinding | null>(null)
  const editNotes = ref<string>('')
  const editStatus = ref<string>('')

  function askAboutEditingFinding() {
    if (!editingFinding.value) {
      return
    }

    askAboutFinding(editingFinding.value)
    editingFinding.value = null
  }

  type FindingDetailTab = 'overview' | 'reasoning' | 'evidence' | 'remediation' | 'timeline'
  const findingDetailTab = ref<FindingDetailTab>('overview')
  const findingDetailTabs: { id: FindingDetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'reasoning', label: 'AI reasoning' },
    { id: 'evidence', label: 'Linked evidence' },
    { id: 'remediation', label: 'Remediation' },
    { id: 'timeline', label: 'Timeline' }
  ]

  const evidenceGroups = ref<EvidenceGroup[]>([])

  // PRD §6.2 certificate expiry tracker — buckets populated from OpenSearch
  type ExpiringCert = {
    id: string
    name: string
    vessel?: string
    framework?: string
    days_left: number
    expires_at: string
  }
  type ExpiringResponse = {
    window_days: number
    total: number
    buckets: {
      expired: ExpiringCert[]
      d30: ExpiringCert[]
      d60: ExpiringCert[]
      d90: ExpiringCert[]
    }
  }
  const expiringCerts = ref<ExpiringResponse | null>(null)

  const anomalies = ref<{ anomalies: Anomaly[]; total: number } | null>(null)
  // Manual cert-entry form state
  const certFormOpen = ref(false)
  const certSaving = ref(false)
  const certSaveError = ref('')
  const newCert = ref<{
    name: string
    vessel: string
    issuer: string
    framework: string
    issued_at: string
    expires_at: string
    status: string
    file_path: string
  }>({
    name: '',
    vessel: '',
    issuer: '',
    framework: '',
    issued_at: '',
    expires_at: '',
    status: 'valid',
    file_path: ''
  })

  // Certificate PDF upload: PUT the file straight to WebDAV (same path the
  // agent's scan-ingest would use), then fill `newCert.file_path` so the
  // subsequent ingest call records the URL. Runs client-side — no agent
  // endpoint needed, since WebDAV already accepts the OIDC bearer.
  const certUploading = ref(false)
  const certUploadProgress = ref(0)
  async function uploadCertFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const token = getAccessToken()
    if (!token) {
      certSaveError.value = 'No Cloudbase session found. Sign in and retry.'
      input.value = ''
      return
    }
    // Sanitize filename: keep it flat under /Certificates/ so the evidence
    // tab links resolve. The vessel prefix (if present) helps keep names
    // unique across ships; fall back to the raw basename otherwise.
    const safeBase =
      (newCert.value.vessel ? newCert.value.vessel.replace(/\s+/g, '-') + '-' : '') +
      file.name.replace(/\s+/g, '-')
    const path = `/Certificates/${safeBase}`
    const url = `${window.location.origin}/remote.php/webdav${path.split('/').map(encodeURIComponent).join('/')}`

    certUploading.value = true
    certUploadProgress.value = 0
    certSaveError.value = ''
    try {
      // Use XHR so we get upload progress events; fetch doesn't expose them
      // as of 2026-04 without ReadableStream request bodies (unsupported in
      // some browsers we might encounter).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', url, true)
        xhr.setRequestHeader('Authorization', token)
        xhr.setRequestHeader('Content-Type', file.type || 'application/pdf')
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable)
            certUploadProgress.value = Math.round((ev.loaded / ev.total) * 100)
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`HTTP ${xhr.status}`))
        xhr.onerror = () => reject(new Error('network error'))
        xhr.send(file)
      })
      newCert.value.file_path = path
    } catch (err: any) {
      certSaveError.value = `Upload failed: ${err?.message || err}`
    } finally {
      certUploading.value = false
      input.value = ''
    }
  }

  // Unified structured-evidence form — one card with a type toggle instead of
  // three separate forms. Fields vary per type; we post to the matching
  // endpoint based on `structType`.
  type StructType = 'drill' | 'asset' | 'event'
  const structFormOpen = ref(false)
  const structType = ref<StructType>('drill')
  const structTypeOptions: { value: StructType; label: string }[] = [
    { value: 'drill', label: 'Training / Drill' },
    { value: 'asset', label: 'Asset' },
    { value: 'event', label: 'Event' }
  ]
  const structSaving = ref(false)
  const structSaveError = ref('')
  const structSavedCount = ref(0)
  const newStruct = ref<{
    name: string
    vessel: string
    subtype: string
    status: string
    scheduled_at: string
    completed_at: string
    participants: number | null
    location: string
    actor: string
    severity: string
    occurred_at: string
    summary: string
    notes: string
  }>({
    name: '',
    vessel: '',
    subtype: 'fire',
    status: 'scheduled',
    scheduled_at: '',
    completed_at: '',
    participants: null,
    location: '',
    actor: '',
    severity: 'info',
    occurred_at: '',
    summary: '',
    notes: ''
  })

  function resetStructForm() {
    newStruct.value = {
      name: '',
      vessel: '',
      subtype:
        structType.value === 'drill' ? 'fire' : structType.value === 'asset' ? 'equipment' : '',
      status: structType.value === 'drill' ? 'scheduled' : '',
      scheduled_at: '',
      completed_at: '',
      participants: null,
      location: '',
      actor: '',
      severity: 'info',
      occurred_at: '',
      summary: '',
      notes: ''
    }
  }

  // Minimum-required-field gates per type.
  const canSaveStruct = computed(() => {
    const s = newStruct.value
    if (structType.value === 'drill') return s.name.trim().length > 0
    if (structType.value === 'asset') return s.name.trim().length > 0
    if (structType.value === 'event') return s.subtype.trim().length > 0
    return false
  })

  watch(structType, () => {
    resetStructForm()
    structSaveError.value = ''
  })
  const expiryBucketOrder: { key: 'expired' | 'd30' | 'd60' | 'd90'; label: string }[] = [
    { key: 'expired', label: 'Expired' },
    { key: 'd30', label: 'Within 30 days' },
    { key: 'd60', label: '31–60 days' },
    { key: 'd90', label: '61–90 days' }
  ]

  // B1: live streaming progress during gap analysis. `null` = no run in flight.
  type RunProgress = {
    slug: string
    current: number
    total: number
    label: string
    building: Report | null
  }
  const progress = ref<RunProgress | null>(null)

  // Milestone 6: document pipeline
  type DocHistoryEntry = { stage: DocStage; entered_at: string; actor: string; note: string }
  type DocResearchHit = {
    node_id: string
    source: string
    clause: string
    section_title: string
    score: number
    text: string
  }
  type StoredDocument = {
    id: number
    title: string
    framework: string
    control_id: string
    description: string
    requested_by: string
    stage: DocStage
    research_hits: DocResearchHit[]
    context: string
    draft: string
    review_note: string
    history: DocHistoryEntry[]
    created_at: string
    updated_at: string
    file_path: string
    persistence_error: string
  }
  const documents = ref<StoredDocument[]>([])
  const activeDoc = ref<StoredDocument | null>(null)
  // Expands the draft section into a wide side-panel beside the modal for
  // full-document review. Reset whenever the modal opens a different doc.
  const draftExpanded = ref(false)
  const newDocOpen = ref(false)
  const newDoc = ref<{ title: string; framework: string; control_id: string; description: string }>(
    {
      title: '',
      framework: '',
      control_id: '',
      description: ''
    }
  )
  const creatingDoc = ref(false)
  const advancing = ref(false)
  // Surfaces errors raised while walking a doc through the pipeline —
  // currently: missing OIDC token on approval, and WebDAV write failures.
  // Rendered in the doc detail modal so the user doesn't just see a spinner.
  const docError = ref<string>('')
  let docPollTimer: number | null = null

  // M10: citation grounding verifier. After each gap run, every citation is
  // checked against Qdrant to detect hallucinated evidence. Keyed by framework
  // slug so switching between frameworks keeps results visible.
  type GroundingResult = {
    total_citations: number
    grounded: number
    mismatched: number
    missing: number
    unverifiable: number
    grounding_percent: number
    hallucinations: {
      control_id: string
      control_title: string
      citation_index: number
      check: { node_id: string; status: string; mismatches: string[] }
    }[]
  }
  const grounding = ref<Record<string, GroundingResult>>({})
  const verifying = ref<Record<string, boolean>>({})

  const activeReport = computed<Report | null>(() =>
    activeReportSlug.value ? reports.value[activeReportSlug.value] || null : null
  )

  const activeGrounding = computed<GroundingResult | null>(() =>
    activeReportSlug.value ? grounding.value[activeReportSlug.value] || null : null
  )

  // One-glance dashboard summary. Rolls up counts from state that other
  // cards already pull; avoids a dedicated backend endpoint since everything
  // is already in memory by the time the Dashboard renders.
  const summaryStats = computed(() => ({
    frameworks: frameworks.value.length,
    totalControls: frameworks.value.reduce((sum, f) => sum + (f.control_count || 0), 0),
    anomalyCount: anomalies.value?.total || 0,
    expiringCount: expiringCerts.value
      ? expiringCerts.value.buckets.expired.length + expiringCerts.value.buckets.d30.length
      : 0,
    corpusChunks: corpusStats.value?.total_chunks || 0
  }))

  function scrollToAnomalies() {
    // Anomalies card lives on the dashboard tab; switch there if we aren't,
    // then scroll it into view. The .anomalies-card selector is stable.
    activeTab.value = 'dashboard'
    nextTick(() => {
      document
        .querySelector('.anomalies-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Milestone 9: publish the current page state as compliance context to
  // the shared module so the unified chat (global ChatPanelSdk mounted in
  // ChatWidget) can answer questions like "what about this finding"
  // without the user re-stating. Watcher runs whenever the active report
  // or finding changes — low cost, fires maybe once per navigation.
  const chatContext = computed(() => {
    const selectedFinding = editingFinding.value
      ? complianceContextFinding(editingFinding.value)
      : activeChatFinding.value
    return buildChatContext(activeReport.value, selectedFinding)
  })
  watch(chatContext, (ctx) => setComplianceContext(ctx), { immediate: true, deep: true })

  // Documents Kanban: reshape the flat list into one column per active stage.
  // Terminal stages (approved, rejected) hide when empty so the board
  // isn't cluttered with unused columns. Active-pipeline stages stay
  // visible even when empty so users see the full workflow at a glance.
  const documentColumns = computed(() =>
    DOC_COLUMNS.map((col) => ({
      ...col,
      docs: documents.value.filter((d) => d.stage === col.stage)
    })).filter((col) => !col.terminal || col.docs.length > 0)
  )
  const documentsOpenCount = computed(
    () => documents.value.filter((d) => d.stage !== 'approved' && d.stage !== 'rejected').length
  )

  const filteredFindings = computed<Finding[]>(() => {
    if (!activeReport.value) return []

    // Step 1: status filter
    let result =
      filter.value === 'all'
        ? [...activeReport.value.findings]
        : activeReport.value.findings.filter((f) => f.status === filter.value)

    // Step 1b: severity filter (A7)
    if (severityFilter.value !== 'all') {
      result = result.filter((f) => f.severity === severityFilter.value)
    }

    // Step 1c: clause prefix filter (A7)
    const prefix = clausePrefix.value.trim()
    if (prefix) {
      result = result.filter((f) => f.control_id.startsWith(prefix))
    }

    // Step 1d: no-evidence-only toggle (A7)
    if (noEvidenceOnly.value) {
      result = result.filter((f) => f.evidence.length === 0)
    }

    // Step 2: free-text search across key fields
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      result = result.filter((f) => {
        if (f.control_title.toLowerCase().includes(q)) return true
        if (f.control_id.toLowerCase().includes(q)) return true
        if (f.control_section.toLowerCase().includes(q)) return true
        if (f.reasoning.toLowerCase().includes(q)) return true
        for (const ev of f.evidence) {
          if (ev.source && ev.source.toLowerCase().includes(q)) return true
          if (ev.clause && ev.clause.toLowerCase().includes(q)) return true
          if (ev.text && ev.text.toLowerCase().includes(q)) return true
        }
        return false
      })
    }

    // Step 3: sort
    const dir = sortDir.value === 'asc' ? 1 : -1
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey.value) {
        case 'coverage':
          cmp = COVERAGE_ORDER[a.status] - COVERAGE_ORDER[b.status]
          break
        case 'severity':
          cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
          break
        case 'control_id':
          cmp = a.control_id.localeCompare(b.control_id, undefined, { numeric: true })
          break
        case 'control_title':
          cmp = a.control_title.localeCompare(b.control_title)
          break
        case 'top_score':
          cmp = a.top_score - b.top_score
          break
        case 'source': {
          const aSrc = a.evidence[0]?.source || ''
          const bSrc = b.evidence[0]?.source || ''
          cmp = aSrc.localeCompare(bSrc)
          break
        }
      }
      // Tie-break by clause id (stable, human-friendly)
      if (cmp === 0) {
        cmp = a.control_id.localeCompare(b.control_id, undefined, { numeric: true })
      }
      return cmp * dir
    })

    return result
  })

  // A7: "Is any filter active?" — used to decide whether to show the N-of-M counter
  const isFiltered = computed<boolean>(() => {
    return (
      filter.value !== 'all' ||
      searchQuery.value.trim() !== '' ||
      severityFilter.value !== 'all' ||
      clausePrefix.value.trim() !== '' ||
      noEvidenceOnly.value
    )
  })

  // A13: degraded marker — count controls that failed evaluation
  // (the sync/streaming paths both emit observation severity on per-control errors)
  const degradedCount = computed<number>(() => {
    if (!activeReport.value) return 0
    return activeReport.value.findings.filter((f) => f.severity === 'observation').length
  })

  // A8: template-based next-action text for partial/missing/observation findings.
  // Pure function — no LLM call. Designed to give auditors an actionable bullet
  // they can drop into a remediation plan.
  function nextActionFor(f: Finding): string {
    return nextComplianceFindingAction(f, COVERED_THRESHOLD)
  }

  // A9: copy a citation to clipboard in a human-readable format.
  // Only shows the "✓ Copied" confirmation when navigator.clipboard.writeText
  // actually succeeds. If the browser blocks clipboard access we fall back to a
  // window.prompt that surfaces the text for manual copy, but we cannot verify
  // the user actually copied it — so we do NOT claim success in the UI for the
  // fallback path.
  async function copyCitation(f: Finding, ev: Evidence): Promise<void> {
    const clause = ev.clause ? ` clause ${ev.clause}` : ''
    const section = ev.section_title ? ` — ${ev.section_title}` : ''
    const text = `${f.framework} ${f.control_id} (${f.control_title}): ${ev.source}${clause}${section} [retrieval score ${ev.score.toFixed(3)}]\n"${ev.text.trim()}"`

    let copied = false
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch (e) {
      console.warn('clipboard write failed; falling back to prompt', e)
      // Fallback: surface the text via window.prompt so the user can copy it
      // manually. We cannot detect whether they actually copied it, so we do
      // not mark the citation as successfully copied regardless of the prompt
      // return value.
      window.prompt('Copy citation (clipboard access was blocked):', text)
    }

    if (!copied) return

    const idx = f.evidence.indexOf(ev)
    copiedKey.value = `${f.control_id}-${idx}`
    setTimeout(() => {
      if (copiedKey.value === `${f.control_id}-${idx}`) copiedKey.value = ''
    }, 2000)
  }

  // ---------------------------------------------------------------------------
  // Exports (A10 CSV, A11 JSON, A12 Markdown)
  // ---------------------------------------------------------------------------

  function _downloadBlob(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function _csvEscape(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function _slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function exportCsv(): void {
    if (!activeReport.value) return
    const headers = [
      'control_id',
      'control_title',
      'section',
      'coverage',
      'severity',
      'top_score',
      'top_evidence_source',
      'top_evidence_clause',
      'reasoning'
    ]
    const rows = [headers.join(',')]
    for (const f of filteredFindings.value) {
      const ev = f.evidence[0]
      const row = [
        f.control_id,
        f.control_title,
        f.control_section,
        f.status,
        f.severity,
        f.top_score.toFixed(3),
        ev?.source || '',
        ev?.clause || '',
        f.reasoning
      ].map(_csvEscape)
      rows.push(row.join(','))
    }
    const filename = `${_slugify(activeReport.value.framework)}-findings.csv`
    _downloadBlob(rows.join('\n') + '\n', filename, 'text/csv;charset=utf-8')
  }

  function exportJson(): void {
    if (!activeReport.value) return
    const filename = `${_slugify(activeReport.value.framework)}-report.json`
    _downloadBlob(
      JSON.stringify(activeReport.value, null, 2),
      filename,
      'application/json;charset=utf-8'
    )
  }

  function exportMarkdown(): void {
    if (!activeReport.value) return
    const r = activeReport.value
    const lines: string[] = []
    lines.push(`# ${r.framework} — Gap Analysis Report`)
    lines.push('')
    lines.push(`**Framework version:** ${r.version}`)
    lines.push(`**Coverage:** ${r.coverage_percent}%`)
    lines.push(
      `**Controls:** ${r.covered} covered · ${r.partial} partial · ${r.missing} missing · ${r.total_controls} total`
    )
    if (degradedCount.value > 0) {
      lines.push(`**⚠ Degraded:** ${degradedCount.value} control(s) failed evaluation`)
    }
    lines.push('')
    lines.push('## Summary by Status')
    lines.push('')
    for (const status of ['missing', 'partial', 'covered'] as const) {
      const group = r.findings.filter((f) => f.status === status)
      if (group.length === 0) continue
      lines.push(`### ${status.toUpperCase()} (${group.length})`)
      lines.push('')
      for (const f of group) {
        lines.push(`- **${f.control_id}** — ${f.control_title} _(score ${f.top_score.toFixed(3)})_`)
        if (f.control_section) lines.push(`  - Section: ${f.control_section}`)
        if (f.status !== 'covered') lines.push(`  - Next action: ${nextActionFor(f)}`)
        if (f.reasoning) lines.push(`  - Reasoning: ${f.reasoning}`)
        if (f.evidence.length > 0) {
          lines.push(`  - Top evidence:`)
          for (const ev of f.evidence.slice(0, 3)) {
            const clause = ev.clause ? ` clause ${ev.clause}` : ''
            lines.push(`    - \`${ev.source}\`${clause} (score ${ev.score.toFixed(3)})`)
          }
        }
      }
      lines.push('')
    }
    const filename = `${_slugify(r.framework)}-audit-report.md`
    _downloadBlob(lines.join('\n'), filename, 'text/markdown;charset=utf-8')
  }

  function exportPdf(): void {
    if (!activeReport.value) return
    const r = activeReport.value
    const statusColor = (s: string) =>
      s === 'covered' ? '#16a34a' : s === 'partial' ? '#d97706' : '#dc2626'

    const win = window.open('', '_blank')
    if (!win) return
    const doc = win.document
    doc.open()

    const head = doc.createElement('title')
    head.textContent = `${r.framework} — Audit Report`
    doc.head.appendChild(head)

    const style = doc.createElement('style')
    style.textContent = `
    body { font-family: -apple-system, sans-serif; font-size: 12px; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; border-bottom: 2px solid #333; }
    td { padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
    @media print { body { padding: 0; } }
  `
    doc.head.appendChild(style)

    const h1 = doc.createElement('h1')
    h1.textContent = `${r.framework} — Gap Analysis Report`
    doc.body.appendChild(h1)

    const meta = doc.createElement('div')
    meta.className = 'meta'
    meta.textContent = `${r.version} · ${r.total_controls} controls · ${r.coverage_percent}% covered (${r.covered} covered, ${r.partial} partial, ${r.missing} missing) · Generated ${new Date().toLocaleString()}`
    doc.body.appendChild(meta)

    const table = doc.createElement('table')
    const thead = doc.createElement('thead')
    const headerRow = doc.createElement('tr')
    for (const col of ['ID', 'Control', 'Status', 'Severity', 'Score', 'Source', 'Reasoning']) {
      const th = doc.createElement('th')
      th.textContent = col
      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = doc.createElement('tbody')
    for (const f of r.findings) {
      const tr = doc.createElement('tr')
      const cells = [
        f.control_id,
        f.control_title,
        f.status,
        f.severity,
        f.top_score.toFixed(3),
        f.evidence[0]?.source || '',
        f.reasoning.length > 120 ? f.reasoning.slice(0, 120) + '…' : f.reasoning
      ]
      cells.forEach((text, i) => {
        const td = doc.createElement('td')
        td.textContent = text
        if (i === 2) {
          td.style.color = statusColor(f.status)
          td.style.fontWeight = '700'
        }
        if (i === 6) td.style.fontSize = '10px'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    doc.body.appendChild(table)
    doc.close()

    win.print()
  }

  // Fire-and-forget: persist the report to the findings store after a successful
  // run. Failures are logged but do not surface to the user — the in-memory
  // report is still usable even if persistence fails.
  async function persistReport(slug: string, report: Report): Promise<void> {
    try {
      await requestComplianceJson(AGENT_URL, '/audit/persist-report', {
        method: 'POST',
        body: { framework: slug, report, replace_existing: true }
      })
    } catch (e) {
      console.warn('persistReport failed', e)
    }
    try {
      await requestComplianceJson(AGENT_URL, '/audit/save-run', {
        method: 'POST',
        body: { framework: slug, report }
      })
      void loadRunHistory()
    } catch {
      /* non-critical */
    }
  }

  // M10: citation grounding. Checks every evidence citation against Qdrant.
  // Hallucinated citations (node_id missing or mismatched metadata) surface
  // in the Audit Prep UI so users can distrust the affected findings.
  async function verifyReport(slug: string, report: Report): Promise<void> {
    verifying.value[slug] = true
    try {
      grounding.value[slug] = await requestComplianceJson<GroundingResult>(
        AGENT_URL,
        '/audit/verify-citations',
        {
          method: 'POST',
          body: { framework: slug, report }
        }
      )
    } catch (e) {
      console.warn('verifyReport failed', e)
    } finally {
      verifying.value[slug] = false
    }
  }

  // ---------------------------------------------------------------------------
  // Milestone 6 — document pipeline
  // ---------------------------------------------------------------------------
  async function loadDocuments() {
    try {
      const resp = await fetch(`${AGENT_URL}/documents?limit=500`)
      if (resp.ok) documents.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  // Chat → Document Pipeline bridge. The sidecar emits draft-procedure with
  // the last assistant message; we seed a new doc request with that content
  // as the description and jump to the Documents tab so the user sees it
  // land in the Kanban immediately. Framework defaults to the active report's
  // framework when available.
  async function onDraftFromChat(payload: {
    content: string
    grounding?: { clause: string; source: string }[]
  }) {
    const activeFw = activeReport.value?.framework || ''
    // Trim content to a reasonable description length; the full body goes into
    // research context once the pipeline runs the RAG stage.
    const desc =
      payload.content.length > 600 ? payload.content.slice(0, 600) + '…' : payload.content
    const groundingLine =
      payload.grounding && payload.grounding.length > 0
        ? '\n\nGrounded in: ' +
          payload.grounding
            .slice(0, 3)
            .map((g) => `${g.clause}@${g.source}`)
            .join(', ')
        : ''
    newDoc.value = {
      title: `Procedure from chat — ${new Date().toLocaleString()}`,
      framework: activeFw,
      control_id: '',
      description: desc + groundingLine
    }
    await createDoc()
    activeTab.value = 'documents'
  }

  async function createDoc(): Promise<StoredDocument | null> {
    if (!newDoc.value.title.trim()) return null
    creatingDoc.value = true
    try {
      const resp = await fetch(`${AGENT_URL}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc.value)
      })
      if (!resp.ok) return null
      const created = await resp.json()
      documents.value = [created, ...documents.value]
      newDoc.value = { title: '', framework: '', control_id: '', description: '' }
      newDocOpen.value = false
      // Auto-advance into research immediately — the request→research step is
      // fully automatic (RAG retrieval), so waiting for a user click would be
      // friction without value.
      await advanceDoc(created, { silent: true })
      return created
    } finally {
      creatingDoc.value = false
    }
  }

  // Live draft-stream state. The backend's /draft/stream SSE emits
  // token events that we accumulate here; StreamingText renders them as
  // a typewriter with a blinking cursor. Only one stream runs at a time —
  // `abort` is the fetch AbortController so we can cancel cleanly if the
  // user closes the modal or navigates away mid-stream.
  const draftStream = reactive<{
    active: boolean
    text: string
    docId: number | null
    abort: AbortController | null
  }>({ active: false, text: '', docId: null, abort: null })

  function stopDraftStream() {
    if (draftStream.abort) {
      try {
        draftStream.abort.abort()
      } catch {
        /* already aborted */
      }
    }
    draftStream.active = false
    draftStream.abort = null
    draftStream.docId = null
    // text is left intact so a late-arriving chunk doesn't erase what
    // the user was reading; the REST-fetched doc will overwrite it.
  }

  async function startDraftStream(docId: number) {
    stopDraftStream()
    const controller = new AbortController()
    Object.assign(draftStream, { active: true, text: '', docId, abort: controller })
    try {
      const resp = await fetch(`${AGENT_URL}/documents/${docId}/draft/stream`, {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal
      })
      if (!resp.ok || !resp.body) {
        docError.value = `Draft stream failed: HTTP ${resp.status}`
        stopDraftStream()
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buf = ''
      const parseEvents = () => {
        let idx: number
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const dataLines: string[] = []
          for (const line of raw.split('\n')) {
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
          }
          if (dataLines.length === 0) continue
          try {
            const ev = JSON.parse(dataLines.join('\n'))
            if (ev.type === 'token' && typeof ev.content === 'string') {
              // Mutate in place — reactive means the template re-renders
              // on each append and StreamingText's prefix-match animator
              // catches up.
              draftStream.text += ev.content
            } else if (ev.type === 'error') {
              docError.value = `Draft generation failed: ${ev.error || 'unknown'}`
            }
            // 'start' and 'done' handled implicitly — the backend has
            // persisted the final draft + advanced stage to 'review' by
            // the time `done` fires. We refetch once the reader closes.
          } catch {
            /* swallow malformed frames */
          }
        }
      }
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        parseEvents()
      }
      buf += decoder.decode().replace(/\r\n/g, '\n')
      if (!buf.endsWith('\n\n')) buf += '\n\n'
      parseEvents()
    } catch (exc) {
      // AbortError is expected when the user closes the modal mid-stream.
      if ((exc as { name?: string }).name !== 'AbortError') {
        docError.value = `Draft stream error: ${exc instanceof Error ? exc.message : exc}`
      }
    } finally {
      draftStream.active = false
      draftStream.abort = null
      // Refetch the doc so activeDoc picks up the DB-persisted final
      // draft + new stage ('review'). Any further UI render then reads
      // activeDoc.draft directly, not draftStream.text.
      try {
        const fresh = await fetch(`${AGENT_URL}/documents/${docId}`).then((r) =>
          r.ok ? r.json() : null
        )
        if (fresh) {
          const idx = documents.value.findIndex((d) => d.id === docId)
          if (idx >= 0) documents.value[idx] = fresh
          if (activeDoc.value?.id === docId) activeDoc.value = fresh
        }
      } catch {
        /* non-critical */
      }
      draftStream.docId = null
    }
  }

  // Closing the modal needs to abort any in-flight draft stream so the
  // HTTP request doesn't keep running after the user's moved on. Also
  // stops the poll timer to be safe.
  function closeDocModal() {
    stopDraftStream()
    stopDocPoll()
    activeDoc.value = null
  }

  function openDoc(d: StoredDocument) {
    activeDoc.value = { ...d }
    draftExpanded.value = false
    // Doc is drafting but has no content yet → open the live stream.
    // If a draft already exists (e.g. user re-opened a completed doc),
    // fall back to the polling path — the draft is probably already
    // done and a new stream would just regenerate it.
    if (d.stage === 'draft' && !d.draft) {
      void startDraftStream(d.id)
    } else if (d.stage === 'draft') {
      startDocPoll(d.id)
    }
  }

  function documentsForFinding(f: StoredFinding | null): StoredDocument[] {
    if (!f) {
      return []
    }

    const framework = (f.framework || '').trim()
    const controlId = (f.control_id || '').trim()
    if (!framework || !controlId) {
      return []
    }

    return documents.value.filter((d) => d.framework === framework && d.control_id === controlId)
  }

  function openLinkedDocument(d: StoredDocument) {
    editingFinding.value = null
    activeTab.value = 'documents'
    openDoc(d)
  }

  function hasRemediationDocumentsForFinding(f: StoredFinding | null): boolean {
    return documentsForFinding(f).length > 0
  }

  function stopDocPoll() {
    if (docPollTimer !== null) {
      clearInterval(docPollTimer)
      docPollTimer = null
    }
  }

  function startDocPoll(id: number) {
    stopDocPoll()
    docPollTimer = window.setInterval(async () => {
      try {
        const resp = await fetch(`${AGENT_URL}/documents/${id}`)
        if (!resp.ok) return
        const fresh: StoredDocument = await resp.json()
        const idx = documents.value.findIndex((d) => d.id === id)
        if (idx >= 0) documents.value[idx] = fresh
        if (activeDoc.value?.id === id) activeDoc.value = fresh
        // Stop polling when the doc has reached a terminal state for the
        // current background task:
        //   - rejected → always terminal
        //   - draft → waiting for the LLM to land
        //   - approved → waiting for WebDAV write; terminal once file_path
        //     OR persistence_error is set (Codex H1: without the error
        //     branch the poll would spin forever on failure).
        //   - anything else → not a background stage, stop immediately.
        if (fresh.stage === 'rejected') stopDocPoll()
        else if (fresh.stage !== 'draft' && fresh.stage !== 'approved') stopDocPoll()
        else if (fresh.stage === 'approved' && (fresh.file_path || fresh.persistence_error))
          stopDocPoll()
      } catch {
        /* non-critical */
      }
    }, 2000)
  }

  async function advanceDoc(d: StoredDocument, opts: { silent?: boolean } = {}) {
    advancing.value = true
    docError.value = ''
    try {
      // Only review → approved needs the OIDC token (backend writes the
      // final draft to WebDAV). Earlier transitions ignore access_token.
      // If the review → approved caller has no token, surface an error and
      // abort instead of silently marking the doc approved without ever
      // persisting it (Codex H1: prevents the stuck-forever poll state).
      //
      // auto_draft=false tells the server NOT to kick off its own background
      // draft — the frontend will stream via /draft/stream below. Without
      // this, two concurrent Ollama calls would write to the same doc row.
      const body: Record<string, unknown> = { approved_by: 'admin', note: '', auto_draft: false }
      if (d.stage === 'review') {
        const token = getAccessToken()
        if (!token) {
          docError.value = 'Cannot approve: no Cloudbase session found. Sign in again and retry.'
          return
        }
        body.access_token = token
      }
      const resp = await fetch(`${AGENT_URL}/documents/${d.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        try {
          docError.value = (await resp.json()).detail || `HTTP ${resp.status}`
        } catch {
          docError.value = `HTTP ${resp.status}`
        }
        return
      }
      const updated: StoredDocument = await resp.json()
      const idx = documents.value.findIndex((x) => x.id === d.id)
      if (idx >= 0) documents.value[idx] = updated
      if (!opts.silent && activeDoc.value?.id === d.id) activeDoc.value = updated
      // Drafting now streams live — open the SSE and accumulate tokens
      // into draftStream.text, rendered by StreamingText in the modal.
      // Falls back to the poll path if a stream already populated the
      // draft (repeat advance on an already-drafted doc).
      if (updated.stage === 'draft') {
        if (updated.draft) startDocPoll(updated.id)
        else void startDraftStream(updated.id)
      }
      // Approval also runs in the background (WebDAV write); poll so the
      // file_path OR persistence_error appears without a manual refresh.
      if (updated.stage === 'approved' && !updated.file_path && !updated.persistence_error) {
        startDocPoll(updated.id)
      }
    } finally {
      advancing.value = false
    }
  }

  async function rejectDoc(d: StoredDocument) {
    const reason = window.prompt('Why is this being rejected?') || ''
    advancing.value = true
    try {
      const resp = await fetch(`${AGENT_URL}/documents/${d.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'admin', reason })
      })
      if (!resp.ok) return
      const updated: StoredDocument = await resp.json()
      const idx = documents.value.findIndex((x) => x.id === d.id)
      if (idx >= 0) documents.value[idx] = updated
      activeDoc.value = updated
    } finally {
      advancing.value = false
    }
  }

  async function regenerateDraft(d: StoredDocument) {
    advancing.value = true
    try {
      await fetch(`${AGENT_URL}/documents/${d.id}/regenerate-draft`, { method: 'POST' })
      startDocPoll(d.id)
    } finally {
      advancing.value = false
    }
  }

  async function deleteDoc(d: StoredDocument) {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return
    try {
      const resp = await fetch(`${AGENT_URL}/documents/${d.id}`, { method: 'DELETE' })
      if (resp.ok) {
        documents.value = documents.value.filter((x) => x.id !== d.id)
        if (activeDoc.value?.id === d.id) activeDoc.value = null
      }
    } catch {
      /* non-critical */
    }
  }

  function canAdvance(d: StoredDocument): boolean {
    return canAdvanceComplianceDocument(d)
  }

  function canRegenerateDraft(d: StoredDocument): boolean {
    return canRegenerateComplianceDocumentDraft(d)
  }

  function canReject(d: StoredDocument): boolean {
    return canRejectComplianceDocument(d)
  }

  function nextActionLabel(d: StoredDocument): string {
    return nextComplianceDocumentActionLabel(d)
  }

  function toggleSort(key: SortKey) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      // Score sort defaults desc (highest first), everything else defaults asc.
      sortDir.value = key === 'top_score' ? 'desc' : 'asc'
    }
  }

  function sortArrow(key: SortKey): string {
    if (sortKey.value !== key) return ''
    return sortDir.value === 'asc' ? ' ▲' : ' ▼'
  }

  function coverageClass(pct: number): string {
    if (pct >= 75) return 'coverage-good'
    if (pct >= 50) return 'coverage-warn'
    return 'coverage-bad'
  }

  // navLinkClass returns the exact class list OpenCloud's web-nav-sidebar uses
  // for active/inactive state on Admin Settings and Files. Keeping this list in
  // sync with the design system means our tab behavior (hover, focus, active
  // outline, typography) stays identical to the native app shell without
  // maintaining our own version.
  function navLinkClass(isActive: boolean): string {
    const common =
      'oc-button-surface gap-2 justify-between text-base min-h-4 oc-button cursor-pointer disabled:opacity-60 disabled:cursor-default oc-sidebar-nav-item-link relative w-full whitespace-nowrap px-2 py-3 opacity-100 select-none rounded-xl'
    const active = 'oc-button-filled oc-button-surface-filled active overflow-hidden outline'
    const idle =
      'oc-button-raw-inverse oc-button-surface-raw-inverse hover:bg-role-surface-container-highest focus:bg-role-surface-container-highest'
    return `${common} ${isActive ? active : idle}`
  }

  function toggleExpanded(id: string) {
    expanded.value[id] = !expanded.value[id]
  }

  async function loadFrameworks() {
    frameworkLoadError.value = ''
    loading.value = true
    try {
      const data = await requestComplianceJson<{ frameworks?: FrameworkSummary[] }>(
        AGENT_URL,
        '/audit/frameworks'
      )
      frameworks.value = readFrameworksResponse(data)
    } catch (e: any) {
      frameworkLoadError.value = e?.message || String(e)
    } finally {
      loading.value = false
    }
  }

  // OpenCloud stores the OIDC session in localStorage under an `oc_*` key.
  // Mirrors the helper used by OrganizerPage so both pages forward the
  // signed-in user's real token to the agent instead of hardcoding admin
  // credentials. Returns null when no session is present — callers must
  // surface a clear error to the user rather than silently falling back.
  // Scan every localStorage key and return the first JSON value that looks
  // like an OIDC session (has `access_token`). The key name varies across
  // OpenCloud versions and OIDC libs (`oc_*`, `oidc.user:*`, etc.) — matching
  // on the shape of the stored value is more resilient than hardcoding a
  // prefix that may drift.
  function getOcSession(): Record<string, any> | null {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      try {
        const raw = localStorage.getItem(key)
        if (!raw || raw[0] !== '{') continue
        const data = JSON.parse(raw)
        if (data && typeof data === 'object' && data.access_token) return data
      } catch {
        /* skip malformed entries */
      }
    }
    return null
  }
  function getAccessToken(): string | null {
    return getOpenCloudAccessToken()
  }
  // Pull the current user's preferred username from the OIDC profile so the
  // Files-app deep links we build (file_path + evidence source) resolve for
  // whoever's signed in — not just admin (Codex M1). Falls back to `admin`
  // only to avoid blowing up when the session shape is unexpected; the link
  // will still 404 in that case, which is better than silently routing to
  // a different user's space.
  function getUsername(): string {
    const session = getOcSession()
    const profile = session?.profile || session?.userinfo || {}
    return profile.preferred_username || profile.username || session?.preferred_username || 'admin'
  }
  // Build a Files-app URL for a WebDAV path living in the signed-in user's
  // personal space. Used by both the doc pipeline file-link and the
  // evidence source links. When we can't derive a username, fall back to
  // the raw /remote.php/webdav URL — the browser will open the file
  // directly (or prompt a download) rather than routing to the wrong user.
  // Evidence sources are filenames (e.g., "ism_sample.md"), not paths — so
  // they need a search query rather than a direct route. Uses the signed-in
  // user's personal space so non-admin users also land somewhere they can
  // actually see.
  function evidenceSearchLink(source: string): string {
    const user = getUsername()
    return `/files/spaces/personal/${encodeURIComponent(user)}?q=${encodeURIComponent(source)}`
  }
  function fileLinkFor(webdavPath: string): string {
    const user = getUsername()
    if (!user || (user === 'admin' && !getOcSession())) {
      // No session available at all — serve the raw WebDAV URL so the
      // browser's existing auth still works.
      return `/remote.php/webdav${webdavPath}`
    }
    return `/files/spaces/personal/${encodeURIComponent(user)}${webdavPath}`
  }

  async function runScanIngest() {
    scanRunning.value = true
    scanResult.value = null
    scanError.value = ''
    const accessToken = getAccessToken()
    if (!accessToken) {
      scanError.value = 'No Cloudbase session found. Sign in again and retry.'
      scanRunning.value = false
      return
    }
    try {
      const resp = await fetch(`${AGENT_URL}/ingest/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: scanPath.value,
          access_token: accessToken,
          framework: scanFramework.value || null
        })
      })
      if (!resp.ok) {
        try {
          scanError.value = (await resp.json()).detail || `HTTP ${resp.status}`
        } catch {
          scanError.value = `HTTP ${resp.status}`
        }
        return
      }
      scanResult.value = await resp.json()
      await loadCorpusStats()
      await loadFrameworkLibrary()
    } catch (e: any) {
      scanError.value = e?.message || String(e)
    } finally {
      scanRunning.value = false
    }
  }

  async function loadCorpusStats() {
    try {
      const resp = await fetch(`${AGENT_URL}/rag/corpus-stats`)
      if (resp.ok) corpusStats.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  async function loadRunHistory() {
    try {
      const resp = await fetch(`${AGENT_URL}/audit/runs?limit=20`)
      if (resp.ok) {
        const data = await resp.json()
        runHistory.value = data.runs || []
      }
    } catch {
      /* non-critical */
    }
  }

  // C2: trend calculation — compares latest vs previous run for a framework
  function getTrend(
    slug: string
  ): { delta: number; direction: 'up' | 'down' | 'flat'; prev: number; curr: number } | null {
    const fwName = frameworks.value.find((f) => f.slug === slug)?.name || slug
    const runs = runHistory.value.filter((r) => r.framework === fwName)
    if (runs.length < 2) return null
    const curr = runs[0].coverage_percent
    const prev = runs[1].coverage_percent
    const delta = curr - prev
    return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', prev, curr }
  }

  async function loadAnomalies() {
    try {
      const resp = await fetch(`${AGENT_URL}/structured/anomalies`)
      if (resp.ok) anomalies.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  function anomalyDetailLine(a: Anomaly): string {
    return complianceAnomalyDetailLine(a)
  }

  // Submit the active structured-evidence type to its matching /structured/* endpoint.
  // Datetime strings from <input type="date"> are YYYY-MM-DD; from <input type="datetime-local">
  // are YYYY-MM-DDTHH:MM. Append Z for UTC so OpenSearch parses as a date.
  async function submitStruct() {
    if (!canSaveStruct.value) return
    structSaving.value = true
    structSaveError.value = ''
    const s = newStruct.value
    const stamp = (v: string) => (v ? (v.length === 10 ? v + 'T00:00:00Z' : v + ':00Z') : undefined)

    let endpoint = ''
    let doc: Record<string, unknown> = {}
    if (structType.value === 'drill') {
      endpoint = '/structured/training-drills/ingest'
      const id = `drill-${(s.vessel || 'default').toLowerCase().replace(/\s+/g, '-')}-${s.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      doc = {
        id,
        name: s.name.trim(),
        vessel: s.vessel || undefined,
        type: s.subtype,
        status: s.status,
        scheduled_at: stamp(s.scheduled_at),
        completed_at: stamp(s.completed_at),
        participants: s.participants ?? undefined,
        notes: s.notes || undefined
      }
    } else if (structType.value === 'asset') {
      endpoint = '/structured/assets/ingest'
      const id = `asset-${(s.vessel || 'default').toLowerCase().replace(/\s+/g, '-')}-${s.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      doc = {
        id,
        name: s.name.trim(),
        vessel: s.vessel || undefined,
        category: s.subtype,
        status: s.status || undefined,
        location: s.location || undefined,
        notes: s.notes || undefined
      }
    } else if (structType.value === 'event') {
      endpoint = '/structured/events/ingest'
      const id = `event-${s.subtype}-${Date.now()}`
      doc = {
        id,
        event_type: s.subtype,
        vessel: s.vessel || undefined,
        actor: s.actor || undefined,
        severity: s.severity,
        occurred_at: stamp(s.occurred_at) || new Date().toISOString(),
        summary: s.summary || undefined
      }
    }

    try {
      const resp = await fetch(`${AGENT_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: [doc] })
      })
      if (!resp.ok) {
        try {
          structSaveError.value = (await resp.json()).detail || `HTTP ${resp.status}`
        } catch {
          structSaveError.value = `HTTP ${resp.status}`
        }
        return
      }
      structSavedCount.value += 1
      resetStructForm()
      await new Promise((r) => setTimeout(r, 400))
      await loadAnomalies()
    } catch (e: any) {
      structSaveError.value = e?.message || String(e)
    } finally {
      structSaving.value = false
    }
  }

  async function loadExpiringCertificates() {
    try {
      const resp = await fetch(`${AGENT_URL}/structured/certificates/expiring?window_days=90`)
      if (resp.ok) expiringCerts.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  // Manual cert submission. Builds a certificate doc, POSTs to the ingest
  // endpoint, refreshes the expiry buckets, resets the form. ID is derived
  // from name+vessel so re-submitting the same cert updates rather than
  // duplicates.
  async function submitCert() {
    const c = newCert.value
    if (!c.name.trim()) return
    certSaving.value = true
    certSaveError.value = ''
    const id = `${(c.vessel || 'default').toLowerCase().replace(/\s+/g, '-')}-${c.name.toLowerCase().replace(/\s+/g, '-')}`
    const doc: Record<string, unknown> = {
      id,
      name: c.name.trim(),
      status: c.status || 'valid'
    }
    if (c.vessel.trim()) doc.vessel = c.vessel.trim()
    if (c.issuer.trim()) doc.issuer = c.issuer.trim()
    if (c.framework) doc.framework = c.framework
    if (c.file_path.trim()) doc.file_path = c.file_path.trim()
    // <input type="date"> produces YYYY-MM-DD. OpenSearch accepts it if the
    // mapping is `date` (it is — see main.py ensure_opensearch_indices).
    if (c.issued_at) doc.issued_at = c.issued_at + 'T00:00:00Z'
    if (c.expires_at) doc.expires_at = c.expires_at + 'T00:00:00Z'
    try {
      const resp = await fetch(`${AGENT_URL}/structured/certificates/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: [doc] })
      })
      if (!resp.ok) {
        try {
          certSaveError.value = (await resp.json()).detail || `HTTP ${resp.status}`
        } catch {
          certSaveError.value = `HTTP ${resp.status}`
        }
        return
      }
      newCert.value = {
        name: '',
        vessel: '',
        issuer: '',
        framework: '',
        issued_at: '',
        expires_at: '',
        status: 'valid',
        file_path: ''
      }
      certFormOpen.value = false
      // Wait a moment for OpenSearch near-real-time refresh before reloading.
      await new Promise((r) => setTimeout(r, 800))
      await loadExpiringCertificates()
    } catch (e: any) {
      certSaveError.value = e?.message || String(e)
    } finally {
      certSaving.value = false
    }
  }

  async function buildEvidenceView() {
    // Fetch all findings and group by (framework, source). Keying on source
    // alone collapsed cross-framework reuse into the first framework's bucket
    // and mislabelled the group (Codex M2). Keeping them separate lets the UI
    // show accurate per-framework evidence counts.
    try {
      const resp = await fetch(`${AGENT_URL}/findings?limit=500`)
      if (!resp.ok) return
      const findings: StoredFinding[] = await resp.json()
      evidenceGroups.value = buildComplianceEvidenceGroups(findings)
    } catch {
      /* non-critical */
    }
  }

  async function loadPersistedFindings() {
    const params = new URLSearchParams()
    if (findingsFilter.value.framework) params.set('framework', findingsFilter.value.framework)
    if (findingsFilter.value.status) params.set('status', findingsFilter.value.status)
    if (findingsFilter.value.severity) params.set('severity', findingsFilter.value.severity)
    params.set('limit', '500')
    try {
      const resp = await fetch(`${AGENT_URL}/findings?${params}`)
      if (resp.ok) persistedFindings.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  async function loadFindingsCount() {
    try {
      const resp = await fetch(`${AGENT_URL}/findings/stats`)
      if (resp.ok) findingsCount.value = await resp.json()
    } catch {
      /* non-critical */
    }
  }

  function openFindingEditor(f: StoredFinding) {
    editingFinding.value = f
    editNotes.value = f.notes || ''
    editStatus.value = f.status
    // Always open on Overview so users can find themselves. Rely on the Vue
    // reactive update to re-render the tab body.
    findingDetailTab.value = 'overview'
  }

  // Launch the document pipeline pre-seeded with this finding's context.
  // Implements the "Draft procedure with agent" hook from PRD §8.2.
  async function draftRemediationDoc(f: StoredFinding) {
    newDoc.value = {
      title: `Remediation — ${f.control_id} ${f.control_title}`,
      framework: f.framework,
      control_id: f.control_id,
      description: `Draft a remediation procedure addressing this finding.\n\nCurrent status: ${f.coverage} (${f.severity}).\nReasoning: ${f.reasoning || '(none)'}\nNotes: ${f.notes || '(none)'}`
    }
    const created = await createDoc()
    if (created) {
      const noteLine = `Remediation document created: ${created.title} (#${created.id}).`
      const existingNotes = f.notes?.trim() || ''
      const nextNotes = existingNotes ? `${existingNotes}\n\n${noteLine}` : noteLine
      await updateFinding(f.id, { status: 'in_progress', notes: nextNotes })
    }
    activeTab.value = 'documents'
    editingFinding.value = null
  }

  async function updateFinding(
    id: number,
    patch: { status?: 'open' | 'in_progress' | 'closed'; notes?: string }
  ): Promise<void> {
    const resp = await fetch(`${AGENT_URL}/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    if (!resp.ok) {
      return
    }

    const updated = await resp.json()
    const idx = persistedFindings.value.findIndex((finding) => finding.id === id)
    if (idx >= 0) persistedFindings.value[idx] = updated
    if (editingFinding.value?.id === id) editingFinding.value = updated
    void loadFindingsCount()
  }

  async function markFindingInProgress(f: StoredFinding): Promise<void> {
    const noteLine = 'Remediation work started.'
    const existingNotes = f.notes?.trim() || ''
    const nextNotes = existingNotes.includes(noteLine)
      ? existingNotes
      : existingNotes
        ? `${existingNotes}\n\n${noteLine}`
        : noteLine

    await updateFinding(f.id, { status: 'in_progress', notes: nextNotes })
  }

  async function saveFindingEdit() {
    if (!editingFinding.value) return
    const id = editingFinding.value.id
    try {
      await updateFinding(id, {
        status: editStatus.value as 'open' | 'in_progress' | 'closed',
        notes: editNotes.value
      })
      editingFinding.value = null
    } catch {
      /* non-critical */
    }
  }

  async function deleteFinding(id: number) {
    try {
      const resp = await fetch(`${AGENT_URL}/findings/${id}`, { method: 'DELETE' })
      if (resp.ok) {
        persistedFindings.value = persistedFindings.value.filter((f) => f.id !== id)
        void loadFindingsCount()
      }
    } catch {
      /* non-critical */
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk finding actions
  //
  // Set of selected finding IDs drives a floating action bar. All bulk ops
  // loop the existing per-row endpoints (PATCH /findings/{id},
  // DELETE /findings/{id}) rather than introducing a dedicated bulk route —
  // keeps the backend surface small and lets the UI report per-row progress
  // on failure. Typical bulk sizes are <100; at that scale the N+1 pattern
  // is fine.
  // ---------------------------------------------------------------------------
  const selectedFindingIds = ref<Set<number>>(new Set())
  const bulkActionInFlight = ref(false)
  const bulkActionMessage = ref<string>('')
  const bulkActionOk = ref<boolean>(true)

  const allFilteredSelected = computed(() => {
    const visible = filteredPersistedFindings.value
    if (visible.length === 0) return false
    return visible.every((f) => selectedFindingIds.value.has(f.id))
  })
  const someFilteredSelected = computed(() =>
    filteredPersistedFindings.value.some((f) => selectedFindingIds.value.has(f.id))
  )

  function toggleFindingSelection(id: number): void {
    // New Set so Vue re-runs the computed — mutating in place keeps the
    // same reference and the template doesn't re-render.
    const next = new Set(selectedFindingIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedFindingIds.value = next
  }

  function toggleAllFilteredSelection(): void {
    const next = new Set(selectedFindingIds.value)
    if (allFilteredSelected.value) {
      for (const f of filteredPersistedFindings.value) next.delete(f.id)
    } else {
      for (const f of filteredPersistedFindings.value) next.add(f.id)
    }
    selectedFindingIds.value = next
  }

  function clearFindingSelection(): void {
    selectedFindingIds.value = new Set()
    bulkActionMessage.value = ''
  }

  async function bulkSetStatus(status: 'open' | 'in_progress' | 'closed'): Promise<void> {
    const ids = Array.from(selectedFindingIds.value)
    if (ids.length === 0) return
    bulkActionInFlight.value = true
    bulkActionMessage.value = ''
    let updated = 0
    const failed: number[] = []
    for (const id of ids) {
      try {
        const resp = await fetch(`${AGENT_URL}/findings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const fresh = await resp.json()
        const idx = persistedFindings.value.findIndex((f) => f.id === id)
        if (idx >= 0) persistedFindings.value[idx] = fresh
        updated++
      } catch {
        failed.push(id)
      }
    }
    bulkActionOk.value = failed.length === 0
    bulkActionMessage.value =
      failed.length === 0
        ? `Updated ${updated} finding${updated === 1 ? '' : 's'} → ${status.replace('_', ' ')}.`
        : `Updated ${updated}; ${failed.length} failed (ids: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}).`
    bulkActionInFlight.value = false
    void loadFindingsCount()
    // Drop successfully-updated ids from the selection; keep failed ones so
    // the user can retry.
    const remaining = new Set<number>()
    for (const id of failed) remaining.add(id)
    selectedFindingIds.value = remaining
  }

  // Audit binder PDF download. Fetches the server-composed PDF and
  // triggers a browser download via a synthetic anchor — avoids a
  // navigation away from the compliance page which would lose the tab
  // state. Blob URL is revoked on the next animation frame so the
  // browser has time to start the download.
  const downloadingBinder = ref(false)
  const binderMessage = ref<string>('')
  const binderOk = ref<boolean>(true)

  async function downloadAuditBinder(slug: string): Promise<void> {
    downloadingBinder.value = true
    binderMessage.value = ''
    try {
      const resp = await fetch(`${AGENT_URL}/audit/binder?framework=${encodeURIComponent(slug)}`)
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }))
        throw new Error(errBody.detail || `HTTP ${resp.status}`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}-audit-binder.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      requestAnimationFrame(() => URL.revokeObjectURL(url))
      binderOk.value = true
      binderMessage.value = 'Binder downloaded.'
    } catch (exc) {
      binderOk.value = false
      binderMessage.value = `Download failed: ${exc instanceof Error ? exc.message : exc}`
    } finally {
      downloadingBinder.value = false
    }
  }

  async function bulkDeleteSelected(): Promise<void> {
    const ids = Array.from(selectedFindingIds.value)
    if (ids.length === 0) return
    if (
      !confirm(`Delete ${ids.length} finding${ids.length === 1 ? '' : 's'}? This cannot be undone.`)
    )
      return
    bulkActionInFlight.value = true
    bulkActionMessage.value = ''
    let deleted = 0
    const failed: number[] = []
    for (const id of ids) {
      try {
        const resp = await fetch(`${AGENT_URL}/findings/${id}`, { method: 'DELETE' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        persistedFindings.value = persistedFindings.value.filter((f) => f.id !== id)
        deleted++
      } catch {
        failed.push(id)
      }
    }
    bulkActionOk.value = failed.length === 0
    bulkActionMessage.value =
      failed.length === 0
        ? `Deleted ${deleted} finding${deleted === 1 ? '' : 's'}.`
        : `Deleted ${deleted}; ${failed.length} failed.`
    bulkActionInFlight.value = false
    void loadFindingsCount()
    const remaining = new Set<number>()
    for (const id of failed) remaining.add(id)
    selectedFindingIds.value = remaining
  }

  function runDelta(
    run: RunSummary,
    idx: number
  ): { delta: number; direction: 'up' | 'down' | 'flat' } | null {
    const next = runHistory.value.slice(idx + 1).find((r) => r.framework === run.framework)
    if (!next) return null
    const delta = run.coverage_percent - next.coverage_percent
    return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
  }

  function gapControlIds(slug: string): string[] {
    const report = reports.value[slug]
    if (!report) return []
    return report.findings
      .filter((f: Finding) => f.status === 'missing' || f.status === 'partial')
      .map((f: Finding) => f.control_id)
  }

  // ---------------------------------------------------------------------------
  // B1: Streaming gap analysis
  //
  // The /audit/run-gap-analysis/stream endpoint emits SSE frames of the shape
  //   data: {"type": "framework_loaded", ...}
  //   data: {"type": "control_start", ...}
  //   data: {"type": "control_done", "finding": {...}}
  //   data: {"type": "report", "report": {...}}
  //   data: {"type": "error", "error": "..."}
  //
  // EventSource can't POST, so we use fetch() + ReadableStream + a small SSE
  // line parser. Each control's finding arrives incrementally; we append it to
  // the in-progress report and live-update the dashboard counters while the
  // run proceeds.
  // ---------------------------------------------------------------------------

  type StreamEvent =
    | { type: 'framework_loaded'; framework: string; version: string; total: number }
    | { type: 'control_start'; control_id: string; title: string; index: number }
    | { type: 'control_done'; index: number; finding: Finding }
    | { type: 'report'; report: Report }
    | { type: 'error'; error: string }

  async function streamGapAnalysis(
    slug: string,
    onEvent: (ev: StreamEvent) => void,
    onlyControls?: string[]
  ): Promise<void> {
    const body: Record<string, unknown> = { framework: slug }
    if (onlyControls?.length) body.only_controls = onlyControls
    const resp = await fetch(`${AGENT_URL}/audit/run-gap-analysis/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      let detail = ''
      try {
        const body = await resp.json()
        detail = body?.detail ? ` — ${body.detail}` : ''
      } catch {
        /* non-JSON error body */
      }
      throw new Error(`HTTP ${resp.status}${detail}`)
    }
    if (!resp.body) {
      throw new Error('no response body on stream')
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buf = ''
    try {
      // Read chunks, split on SSE event terminator (\n\n), parse data: lines.
      // Event bodies that span multiple `data:` lines are concatenated with \n
      // per the SSE spec, though our backend emits one line per event.
      const parseEvents = () => {
        let idx: number
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const dataLines: string[] = []
          for (const line of raw.split('\n')) {
            if (line.startsWith(':')) continue
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
          }
          if (dataLines.length === 0) continue
          const payload = dataLines.join('\n')
          try {
            const ev: StreamEvent = JSON.parse(payload)
            onEvent(ev)
          } catch (e) {
            console.warn('streamGapAnalysis: failed to parse SSE payload', payload, e)
          }
        }
      }
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        buf = buf.replace(/\r\n/g, '\n')
        parseEvents()
      }
      buf += decoder.decode()
      buf = buf.replace(/\r\n/g, '\n')
      if (!buf.endsWith('\n\n')) buf += '\n\n'
      parseEvents()
    } finally {
      try {
        reader.releaseLock()
      } catch {
        /* already released */
      }
    }
  }

  async function runGapAnalysis(slug: string, onlyControls?: string[]) {
    delete analysisErrors.value[slug]
    running.value[slug] = true
    const isPartial = !!onlyControls?.length
    progress.value = {
      slug,
      current: 0,
      total: 0,
      label: isPartial ? 'Re-running gaps…' : 'Starting…',
      building: null
    }

    const existingReport = reports.value[slug]
    const building: Report = {
      framework: existingReport?.framework || '',
      version: existingReport?.version || '',
      total_controls: 0,
      covered: 0,
      partial: 0,
      missing: 0,
      coverage_percent: 0,
      findings: []
    }
    let streamErrored = false
    let finalReport: Report | null = null

    try {
      await streamGapAnalysis(
        slug,
        (ev) => {
          if (ev.type === 'framework_loaded') {
            building.framework = ev.framework
            building.version = ev.version
            building.total_controls = ev.total
            if (!isPartial) {
              reports.value[slug] = { ...building, findings: [] }
            }
            activeReportSlug.value = slug
            progress.value = {
              slug,
              current: 0,
              total: ev.total,
              label: 'Evaluating…',
              building
            }
          } else if (ev.type === 'control_start') {
            if (progress.value) {
              progress.value = {
                ...progress.value,
                current: ev.index,
                label: `${ev.control_id} — ${ev.title}`
              }
            }
          } else if (ev.type === 'control_done') {
            building.findings.push(ev.finding)
            if (ev.finding.status === 'covered') building.covered += 1
            else if (ev.finding.status === 'partial') building.partial += 1
            else building.missing += 1
            building.coverage_percent =
              building.total_controls > 0
                ? Math.round((building.covered / building.total_controls) * 1000) / 10
                : 0
            if (!isPartial) {
              reports.value[slug] = { ...building, findings: [...building.findings] }
            }
            if (progress.value) {
              progress.value = { ...progress.value, current: ev.index + 1 }
            }
          } else if (ev.type === 'report') {
            finalReport = ev.report
          } else if (ev.type === 'error') {
            streamErrored = true
            analysisErrors.value[slug] = ev.error
          }
        },
        onlyControls
      )

      if (streamErrored) {
        // Error already surfaced via analysisErrors; leave the partial report
        // in reports[slug] so the user sees what did complete.
        return
      }

      let report: Report
      if (isPartial && existingReport) {
        const rerunIds = new Set(onlyControls)
        const kept = existingReport.findings.filter((f: Finding) => !rerunIds.has(f.control_id))
        // vue-tsc narrows `finalReport` to `never` because the assignment lives
        // inside a callback closure. Cast back to the declared type so the
        // partial-rerun merge keeps compiling.
        const newFindings = (finalReport as Report | null)?.findings || building.findings
        const merged = [...kept, ...newFindings]
        const covered = merged.filter((f: Finding) => f.status === 'covered').length
        const partial = merged.filter((f: Finding) => f.status === 'partial').length
        const missing = merged.filter((f: Finding) => f.status === 'missing').length
        report = {
          ...existingReport,
          findings: merged,
          total_controls: merged.length,
          covered,
          partial,
          missing,
          coverage_percent:
            merged.length > 0 ? Math.round((covered / merged.length) * 1000) / 10 : 0
        }
      } else {
        report = finalReport || reports.value[slug]
      }
      reports.value[slug] = report
      activeReportSlug.value = slug
      delete analysisErrors.value[slug]
      void persistReport(slug, report)
      void verifyReport(slug, report)
    } catch (e: any) {
      // Streaming failed at the transport layer (or the non-OK branch threw).
      // Fall back to the synchronous endpoint so the user still gets a result.
      // Preserve partial-rerun semantics: forward only_controls so the sync path
      // does not silently rerun the full framework (Codex H1).
      console.warn('streaming gap analysis failed, falling back to sync:', e)
      try {
        const syncBody: Record<string, unknown> = { framework: slug }
        if (onlyControls?.length) syncBody.only_controls = onlyControls
        const resp = await fetch(`${AGENT_URL}/audit/run-gap-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncBody)
        })
        if (!resp.ok) {
          let detail = ''
          try {
            const body = await resp.json()
            detail = body?.detail ? ` — ${body.detail}` : ''
          } catch {
            /* non-JSON */
          }
          analysisErrors.value[slug] = `HTTP ${resp.status}${detail}`
          return
        }
        const syncReport: Report = await resp.json()
        let report: Report
        if (isPartial && existingReport) {
          // Same merge logic as the streaming path: preserve findings the user
          // did NOT ask to rerun, overwrite the ones that were rerun.
          const rerunIds = new Set(onlyControls)
          const kept = existingReport.findings.filter((f: Finding) => !rerunIds.has(f.control_id))
          const merged = [...kept, ...syncReport.findings]
          const covered = merged.filter((f: Finding) => f.status === 'covered').length
          const partial = merged.filter((f: Finding) => f.status === 'partial').length
          const missing = merged.filter((f: Finding) => f.status === 'missing').length
          report = {
            ...existingReport,
            findings: merged,
            total_controls: merged.length,
            covered,
            partial,
            missing,
            coverage_percent:
              merged.length > 0 ? Math.round((covered / merged.length) * 1000) / 10 : 0
          }
        } else {
          report = syncReport
        }
        reports.value[slug] = report
        activeReportSlug.value = slug
        delete analysisErrors.value[slug]
        void persistReport(slug, report)
        void verifyReport(slug, report)
      } catch (fallbackErr: any) {
        analysisErrors.value[slug] = fallbackErr?.message || String(fallbackErr)
      }
    } finally {
      running.value[slug] = false
      progress.value = null
    }
  }

  function viewReport(slug: string) {
    activeReportSlug.value = slug
    filter.value = 'all'
    expanded.value = {}
    activeTab.value = 'audit'
  }

  // B2: state persistence — localStorage for filters, URL hash for tab/report
  const STORAGE_KEY = 'compliance-ui-state'

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeTab: activeTab.value,
          activeReportSlug: activeReportSlug.value,
          filter: filter.value,
          sortKey: sortKey.value,
          sortDir: sortDir.value,
          severityFilter: severityFilter.value,
          clausePrefix: clausePrefix.value,
          noEvidenceOnly: noEvidenceOnly.value,
          searchQuery: searchQuery.value
        })
      )
    } catch {
      /* quota or private mode */
    }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      // URL wins over localStorage — a deep-link like /compliance/findings
      // shouldn't silently get overridden by a stale saved tab. Only restore
      // the saved tab when the URL didn't pin one.
      if (s.activeTab && !isComplianceTabPinned()) activeTab.value = s.activeTab
      if (s.activeReportSlug) activeReportSlug.value = s.activeReportSlug
      if (s.filter) filter.value = s.filter
      if (s.sortKey) sortKey.value = s.sortKey
      if (s.sortDir) sortDir.value = s.sortDir
      if (s.severityFilter) severityFilter.value = s.severityFilter
      if (s.clausePrefix !== undefined) clausePrefix.value = s.clausePrefix
      if (s.noEvidenceOnly !== undefined) noEvidenceOnly.value = s.noEvidenceOnly
      if (s.searchQuery !== undefined) searchQuery.value = s.searchQuery
    } catch {
      /* corrupt or private mode */
    }
  }

  watch(
    [
      activeTab,
      activeReportSlug,
      filter,
      sortKey,
      sortDir,
      severityFilter,
      clausePrefix,
      noEvidenceOnly,
      searchQuery
    ],
    saveState,
    { deep: true }
  )

  // Draft-procedure bridge from the merged chat widget. The chat dispatches
  // `oc:draft-procedure-from-chat` via window.dispatchEvent when the user
  // clicks the in-chat "Draft procedure from this" action. We listen here
  // because CompliancePage owns the doc-pipeline UI, but the chat widget
  // itself lives outside this component's tree.
  function onDraftProcedureEvent(ev: Event) {
    const detail = (
      ev as CustomEvent<{ content: string; grounding?: { clause: string; source: string }[] }>
    ).detail
    if (!detail || !detail.content) return
    void onDraftFromChat(detail)
  }

  onMounted(() => {
    restoreState()
    loadFrameworks()
    loadCorpusStats()
    loadRunHistory()
    loadFindingsCount()
    // Tabs persisted to localStorage need their data loaded on mount, not only
    // when the user clicks the tab — otherwise a refresh on Findings/Evidence
    // renders a blank panel until the user navigates away and back (Codex M1).
    void loadPersistedFindings()
    void buildEvidenceView()
    void loadDocuments()
    // Framework coverage drives the nav badge + Audit Prep banner — load on
    // mount so both are accurate before the user clicks anywhere.
    void loadFrameworkLibrary()
    void loadExpiringCertificates()
    void loadAnomalies()
    window.addEventListener('oc:draft-procedure-from-chat', onDraftProcedureEvent)
  })

  onBeforeUnmount(() => {
    // Reset the shared compliance context so other pages don't see stale
    // framework/finding data in the chat.
    setComplianceContext({})
    window.removeEventListener('oc:draft-procedure-from-chat', onDraftProcedureEvent)
    // Abort any in-flight draft stream — otherwise the fetch keeps
    // reading from the server after the component is gone.
    stopDraftStream()
    stopDocPoll()
  })

  return reactive({
    askAboutFinding,
    askAboutAnomaly,
    tabFromUrl,
    openFrameworksTab,
    openFindingsTab,
    openEvidenceTab,
    openDocumentsTab,
    onPopstate,
    loadFrameworkLibrary,
    onFrameworkUpload,
    dismissOnboarding,
    askAboutEditingFinding,
    uploadCertFile,
    resetStructForm,
    scrollToAnomalies,
    nextActionFor,
    copyCitation,
    _downloadBlob,
    _csvEscape,
    _slugify,
    exportCsv,
    exportJson,
    exportMarkdown,
    exportPdf,
    persistReport,
    verifyReport,
    loadDocuments,
    onDraftFromChat,
    createDoc,
    stopDraftStream,
    startDraftStream,
    closeDocModal,
    openDoc,
    documentsForFinding,
    openLinkedDocument,
    hasRemediationDocumentsForFinding,
    markFindingInProgress,
    stopDocPoll,
    startDocPoll,
    advanceDoc,
    rejectDoc,
    regenerateDraft,
    deleteDoc,
    canAdvance,
    canRegenerateDraft,
    canReject,
    nextActionLabel,
    toggleSort,
    sortArrow,
    coverageClass,
    navLinkClass,
    toggleExpanded,
    loadFrameworks,
    getOcSession,
    getAccessToken,
    getUsername,
    evidenceSearchLink,
    fileLinkFor,
    runScanIngest,
    loadCorpusStats,
    loadRunHistory,
    getTrend,
    loadAnomalies,
    anomalyDetailLine,
    submitStruct,
    loadExpiringCertificates,
    submitCert,
    buildEvidenceView,
    loadPersistedFindings,
    loadFindingsCount,
    openFindingEditor,
    draftRemediationDoc,
    saveFindingEdit,
    deleteFinding,
    toggleFindingSelection,
    toggleAllFilteredSelection,
    clearFindingSelection,
    bulkSetStatus,
    downloadAuditBinder,
    bulkDeleteSelected,
    runDelta,
    gapControlIds,
    streamGapAnalysis,
    runGapAnalysis,
    viewReport,
    saveState,
    restoreState,
    onDraftProcedureEvent,
    AGENT_URL,
    SEVERITY_ORDER,
    COVERAGE_ORDER,
    COVERED_THRESHOLD,
    PARTIAL_THRESHOLD,
    activeTab,
    routeSyncSilent,
    frameworkLibrary,
    frameworkLibraryLoading,
    frameworkUploading,
    frameworkUploadMessage,
    frameworkUploadOk,
    frameworksMissingCount,
    frameworks,
    loading,
    frameworkLoadError,
    analysisErrors,
    running,
    reports,
    activeReportSlug,
    filter,
    expanded,
    searchQuery,
    sortKey,
    sortDir,
    severityFilter,
    clausePrefix,
    noEvidenceOnly,
    copiedKey,
    corpusStats,
    showAllCorpusSources,
    ONBOARDING_DISMISSED_KEY,
    onboardingDismissed,
    onboardingState,
    showOnboarding,
    scanDialogOpen,
    scanPath,
    scanFramework,
    scanRunning,
    scanResult,
    scanError,
    runHistory,
    persistedFindings,
    findingsCount,
    findingsFilter,
    findingsSearch,
    filteredPersistedFindings,
    editingFinding,
    editNotes,
    editStatus,
    findingDetailTab,
    findingDetailTabs,
    evidenceGroups,
    expiringCerts,
    anomalies,
    certFormOpen,
    certSaving,
    certSaveError,
    newCert,
    certUploading,
    certUploadProgress,
    structFormOpen,
    structType,
    structTypeOptions,
    structSaving,
    structSaveError,
    structSavedCount,
    newStruct,
    canSaveStruct,
    expiryBucketOrder,
    progress,
    documents,
    activeDoc,
    draftExpanded,
    newDocOpen,
    newDoc,
    creatingDoc,
    advancing,
    docError,
    docPollTimer,
    grounding,
    verifying,
    activeReport,
    activeGrounding,
    summaryStats,
    chatContext,
    DOC_COLUMNS,
    documentColumns,
    documentsOpenCount,
    filteredFindings,
    isFiltered,
    degradedCount,
    draftStream,
    selectedFindingIds,
    bulkActionInFlight,
    bulkActionMessage,
    bulkActionOk,
    allFilteredSelected,
    someFilteredSelected,
    downloadingBinder,
    binderMessage,
    binderOk,
    STORAGE_KEY
  })
}

export type CompliancePageContext = ReturnType<typeof createCompliancePage>

const compliancePageKey: InjectionKey<CompliancePageContext> = Symbol('CompliancePageContext')

export function provideCompliancePage(context: CompliancePageContext): void {
  provide(compliancePageKey, context)
}

export function useCompliancePageContext(): CompliancePageContext {
  const context = inject(compliancePageKey)
  if (!context) {
    throw new Error('Compliance page context was not provided')
  }
  return context
}
