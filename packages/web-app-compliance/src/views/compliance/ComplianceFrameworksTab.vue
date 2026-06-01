<template>
  <!-- ===== FRAMEWORK LIBRARY TAB ===== -->
  <div v-if="activeTab === 'frameworks'">
    <h2 class="page-title">Framework Library</h2>
    <p class="page-sub">
      Upload licensed standard PDFs so the agent can ground gap analysis and document drafting in
      the actual normative text, then run gap analysis per framework from the cards below.
    </p>

    <nav class="framework-page-tabs" aria-label="Framework library views">
      <oc-list class="hidden sm:flex framework-tab-list">
        <li v-for="tab in frameworkLibraryTabs" :key="tab.id">
          <oc-button
            appearance="raw"
            class="framework-tab-button"
            :class="{ 'framework-tab-active': frameworkLibraryTab === tab.id }"
            @click="frameworkLibraryTab = tab.id"
          >
            <oc-icon :name="tab.icon" size="small" />
            <span>{{ tab.label }}</span>
          </oc-button>
        </li>
      </oc-list>
      <div class="framework-tabs-mobile block sm:hidden">
        <select v-model="frameworkLibraryTab" class="form-input">
          <option v-for="tab in frameworkLibraryTabs" :key="tab.id" :value="tab.id">
            {{ tab.label }}
          </option>
        </select>
      </div>
    </nav>

    <section v-if="frameworkLibraryTab === 'frameworks'" class="framework-library-panel">
      <div v-if="frameworkLoadError" class="oc-card card card-error">
        <div class="oc-card-body card-body error-body">
          <div><strong>Could not load frameworks:</strong> {{ frameworkLoadError }}</div>
          <button class="btn btn-sm btn-primary" @click="loadFrameworks">Retry</button>
        </div>
      </div>
      <div v-else-if="frameworks.length === 0 && !loading" class="oc-card card">
        <div class="oc-card-body card-body card-body-empty">
          <strong>No frameworks available.</strong>
          <div class="form-help" style="margin-top: 6px">
            Framework JSON definitions live in <code>ai/agent/frameworks/</code>. Make sure at least
            one framework file exists, then reload.
          </div>
        </div>
      </div>
      <template v-else-if="frameworks.length > 0">
        <div class="framework-tab-intro">
          <div>
            <h3>Frameworks</h3>
            <p>
              Run gap analysis from the framework cards. Categories are derived from framework
              metadata until the library exposes explicit domains.
            </p>
          </div>
          <span class="meta-pill">{{ frameworks.length }} frameworks</span>
        </div>

        <div class="framework-category-tabs" aria-label="Framework categories">
          <button
            v-for="category in frameworkCategoryOptions"
            :key="category.id"
            class="framework-category-tab"
            :class="{ active: selectedFrameworkCategory === category.id }"
            type="button"
            @click="frameworkCategoryFilter = category.id"
          >
            <span>{{ category.label }}</span>
            <span class="framework-category-count">{{ category.count }}</span>
          </button>
        </div>

        <div v-for="group in groupedFrameworks" :key="group.id" class="framework-category-section">
          <div class="framework-category-heading">
            <h3>{{ group.label }}</h3>
            <span>{{ group.items.length }} framework{{ group.items.length === 1 ? '' : 's' }}</span>
          </div>
          <div class="framework-grid">
            <div v-for="fw in group.items" :key="fw.slug" class="oc-card card framework-card">
              <div class="oc-card-header card-header">
                <span>{{ fw.name }}</span>
                <span class="form-help">v{{ fw.version }}</span>
              </div>
              <div class="oc-card-body card-body">
                <p class="framework-desc">{{ fw.description }}</p>
                <div class="framework-meta">
                  <span class="meta-pill">{{ fw.control_count }} controls</span>
                  <span
                    v-if="reports[fw.slug]"
                    class="meta-pill meta-pill-score"
                    :class="{
                      'meta-pill-good': reports[fw.slug].coverage_percent >= 75,
                      'meta-pill-warn':
                        reports[fw.slug].coverage_percent >= 50 &&
                        reports[fw.slug].coverage_percent < 75,
                      'meta-pill-bad': reports[fw.slug].coverage_percent < 50
                    }"
                  >
                    {{ reports[fw.slug].coverage_percent }}% covered
                  </span>
                  <span
                    v-if="getTrend(fw.slug)"
                    class="trend-indicator"
                    :class="'trend-' + getTrend(fw.slug)!.direction"
                  >
                    {{
                      getTrend(fw.slug)!.direction === 'up'
                        ? '▲'
                        : getTrend(fw.slug)!.direction === 'down'
                          ? '▼'
                          : '—'
                    }}
                    {{ Math.abs(getTrend(fw.slug)!.delta).toFixed(1) }}%
                  </span>
                </div>

                <div v-if="reports[fw.slug]" class="score-breakdown">
                  <div class="score-cell score-covered">
                    <div class="score-num">{{ reports[fw.slug].covered }}</div>
                    <div class="score-label">Covered</div>
                  </div>
                  <div class="score-cell score-partial">
                    <div class="score-num">{{ reports[fw.slug].partial }}</div>
                    <div class="score-label">Partial</div>
                  </div>
                  <div class="score-cell score-missing">
                    <div class="score-num">{{ reports[fw.slug].missing }}</div>
                    <div class="score-label">Missing</div>
                  </div>
                </div>

                <div v-if="progress && progress.slug === fw.slug" class="run-progress">
                  <div class="run-progress-label">
                    <span>{{ progress.current }} / {{ progress.total }}</span>
                    <span class="run-progress-control">{{ progress.label }}</span>
                  </div>
                  <div class="run-progress-bar">
                    <div
                      class="run-progress-fill"
                      :style="{
                        width:
                          progress.total > 0
                            ? `${(progress.current / progress.total) * 100}%`
                            : '0%'
                      }"
                    ></div>
                  </div>
                </div>

                <div v-if="analysisErrors[fw.slug]" class="framework-error">
                  <div><strong>Gap analysis failed:</strong> {{ analysisErrors[fw.slug] }}</div>
                  <button
                    class="btn btn-sm btn-primary"
                    :disabled="running[fw.slug]"
                    @click="runGapAnalysis(fw.slug)"
                  >
                    {{ running[fw.slug] ? 'Retrying…' : 'Retry' }}
                  </button>
                </div>

                <div class="framework-actions">
                  <button
                    class="btn btn-primary"
                    :disabled="running[fw.slug]"
                    @click="runGapAnalysis(fw.slug)"
                  >
                    {{
                      running[fw.slug]
                        ? 'Analyzing…'
                        : reports[fw.slug]
                          ? 'Re-run Analysis'
                          : 'Run Gap Analysis'
                    }}
                  </button>
                  <button
                    v-if="reports[fw.slug] && gapControlIds(fw.slug).length > 0"
                    class="btn btn-secondary"
                    :disabled="running[fw.slug]"
                    :title="
                      'Re-run only ' + gapControlIds(fw.slug).length + ' missing/partial controls'
                    "
                    @click="runGapAnalysis(fw.slug, gapControlIds(fw.slug))"
                  >
                    Re-run Gaps ({{ gapControlIds(fw.slug).length }})
                  </button>
                  <button
                    v-if="reports[fw.slug]"
                    class="btn btn-secondary"
                    @click="viewReport(fw.slug)"
                  >
                    View Findings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="loading && !frameworkLoadError" class="oc-card card">
        <div class="oc-card-body card-body card-body-empty">Loading frameworks…</div>
      </div>
    </section>

    <section v-else-if="frameworkLibraryTab === 'sourceDocuments'" class="framework-library-panel">
      <div class="framework-tab-intro">
        <div>
          <h3>Source Documents</h3>
          <p>
            Upload and track the required standards, mappings, and source texts that make each
            framework ready for grounded retrieval.
          </p>
        </div>
        <span class="meta-pill">{{ missingRequiredDocumentCount }} missing documents</span>
      </div>

      <div v-if="frameworkLibraryLoading" class="loading-inline">Loading frameworks…</div>

      <template v-else>
        <div class="framework-category-tabs" aria-label="Framework source document categories">
          <button
            v-for="category in frameworkCategoryOptions"
            :key="category.id"
            class="framework-category-tab"
            :class="{ active: selectedFrameworkCategory === category.id }"
            type="button"
            @click="frameworkCategoryFilter = category.id"
          >
            <span>{{ category.label }}</span>
            <span class="framework-category-count">{{ category.count }}</span>
          </button>
        </div>

        <div
          v-if="groupedFrameworkLibrary.length === 0"
          class="oc-card card framework-empty-category"
        >
          <div class="oc-card-body card-body card-body-empty">
            No source-document slots match this category.
          </div>
        </div>

        <div
          v-for="group in groupedFrameworkLibrary"
          :key="group.id"
          class="framework-category-section"
        >
          <div class="framework-category-heading">
            <h3>{{ group.label }}</h3>
            <span>{{ group.items.length }} framework{{ group.items.length === 1 ? '' : 's' }}</span>
          </div>
          <div class="framework-list">
            <div v-for="fw in group.items" :key="fw.slug" class="oc-card framework-card">
              <div class="oc-card-header framework-card-head">
                <div>
                  <h3>{{ fw.name }}</h3>
                  <div class="framework-sub">
                    {{ fw.version }} · {{ fw.control_count }} controls
                  </div>
                </div>
                <span
                  class="framework-badge"
                  :class="fw.all_required_ingested ? 'framework-badge-ok' : 'framework-badge-warn'"
                  >{{
                    fw.all_required_ingested ? 'Ready' : `${fw.missing_required.length} missing`
                  }}</span
                >
              </div>
              <div class="oc-card-body">
                <p class="framework-desc">{{ fw.description }}</p>
                <div class="framework-docs">
                  <div
                    v-for="d in fw.required_documents"
                    :key="d.key"
                    class="framework-doc"
                    :class="d.ingested ? 'framework-doc-ok' : 'framework-doc-missing'"
                  >
                    <div class="framework-doc-head">
                      <span class="framework-doc-icon" aria-hidden="true">{{
                        d.ingested ? '✓' : '!'
                      }}</span>
                      <div class="framework-doc-meta">
                        <div class="framework-doc-title">{{ d.title }}</div>
                        <div class="framework-doc-desc">{{ d.description }}</div>
                      </div>
                      <span class="framework-doc-role">{{ d.role }}</span>
                    </div>
                    <div v-if="d.ingested" class="framework-doc-status">
                      {{ d.chunks }} chunks indexed ·
                      <span v-for="(s, i) in d.sources.slice(0, 2)" :key="s"
                        >{{ i > 0 ? ', ' : '' }}<em>{{ s }}</em></span
                      >
                      <span v-if="d.sources.length > 2"> +{{ d.sources.length - 2 }} more</span>
                    </div>
                    <div v-else class="framework-doc-status framework-doc-status-missing">
                      Not ingested yet. Upload the PDF to enable grounded retrieval for this
                      framework.
                    </div>
                    <div class="framework-doc-actions">
                      <label class="btn btn-secondary framework-upload-btn">
                        <input
                          type="file"
                          accept=".pdf,.md,.txt,.docx,.odt,.html"
                          :disabled="frameworkUploading === `${fw.slug}:${d.key}`"
                          @change="onFrameworkUpload($event, fw.slug, d.key)"
                        />
                        {{
                          frameworkUploading === `${fw.slug}:${d.key}`
                            ? 'Uploading…'
                            : d.ingested
                              ? 'Replace / add'
                              : 'Upload PDF'
                        }}
                      </label>
                    </div>
                  </div>
                </div>

                <details v-if="fw.extras.length > 0" class="framework-extras">
                  <summary>
                    {{ fw.extras.reduce((n, e) => n + e.chunks, 0) }} other chunks tagged with this
                    framework
                  </summary>
                  <p class="framework-extras-note">
                    These were ingested before the Framework Library was added, or via a scan with
                    this framework set. They don't satisfy the required-document check but are
                    searchable.
                  </p>
                  <ul class="framework-extras-list">
                    <li v-for="(s, i) in fw.extras.flatMap((e) => e.sources).slice(0, 10)" :key="i">
                      {{ s }}
                    </li>
                    <li
                      v-if="fw.extras.flatMap((e) => e.sources).length > 10"
                      class="framework-extras-more"
                    >
                      … and {{ fw.extras.flatMap((e) => e.sources).length - 10 }} more
                    </li>
                  </ul>
                </details>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="frameworkUploadMessage"
        class="framework-upload-message"
        :class="frameworkUploadOk ? 'framework-upload-ok' : 'framework-upload-err'"
      >
        {{ frameworkUploadMessage }}
      </div>
    </section>

    <section v-else class="framework-library-panel">
      <div class="framework-tab-intro">
        <div>
          <h3>Ingested Corpus</h3>
          <p>
            Review indexed sources and scan Cloudbase folders when framework support files have been
            added or changed.
          </p>
        </div>
        <button class="btn btn-primary" :disabled="scanRunning" @click="scanDialogOpen = true">
          {{ scanRunning ? 'Scanning…' : 'Scan & ingest folder' }}
        </button>
      </div>

      <div v-if="corpusStats" class="oc-card corpus-card">
        <div class="corpus-header">
          <span class="corpus-label">Ingested Corpus</span>
          <span class="corpus-summary"
            >{{ corpusStats.total_chunks }} chunks from {{ corpusStats.sources.length }} source{{
              corpusStats.sources.length !== 1 ? 's' : ''
            }}</span
          >
        </div>
        <div v-if="corpusDocuments.length" class="corpus-document-list">
          <div class="corpus-document-list-head">
            <span>Document</span>
            <span>Framework</span>
            <span>Chunks</span>
            <span></span>
          </div>
          <div
            v-for="document in corpusDocuments"
            :key="document.source"
            class="corpus-document-row"
          >
            <div class="corpus-document-primary">
              <a :href="corpusSourceHref(document.source)" class="corpus-document-link">
                <oc-icon name="file-text" size="small" />
                <span>{{ corpusSourceName(document.source) }}</span>
              </a>
              <div v-if="corpusSourceLocation(document.source)" class="corpus-document-location">
                {{ corpusSourceLocation(document.source) }}
              </div>
            </div>
            <div>
              <span v-if="document.framework" class="meta-pill">{{ document.framework }}</span>
              <span v-else class="form-help">Unspecified</span>
            </div>
            <div class="corpus-document-chunks">{{ document.chunks }}</div>
            <div class="corpus-document-actions">
              <a class="btn btn-secondary btn-sm" :href="corpusSourceHref(document.source)">
                {{ corpusSourceActionLabel(document.source) }}
              </a>
            </div>
          </div>
        </div>
        <div v-else class="corpus-empty">
          No documents ingested yet. Upload compliance documents and run ingestion to populate the
          corpus.
        </div>
      </div>
      <div v-else class="oc-card card">
        <div class="oc-card-body card-body card-body-empty">Loading corpus metadata…</div>
      </div>
    </section>

    <div v-if="scanDialogOpen" class="edit-overlay" @click.self="scanDialogOpen = false">
      <div class="edit-modal">
        <h3>Scan folder for ingestion</h3>
        <p class="form-help">
          Walks a Cloudbase folder recursively and ingests every supported document (<code
            >.pdf .md .txt .docx .html .pptx .csv .rtf .odt</code
          >). Files already in the corpus are skipped.
        </p>
        <div class="edit-field">
          <label>Folder path</label>
          <input v-model="scanPath" class="form-input" placeholder="/" />
        </div>
        <div class="edit-field">
          <label>Framework (optional)</label>
          <select v-model="scanFramework" class="form-input">
            <option value="">— unspecified —</option>
            <option v-for="fw in frameworks" :key="fw.slug" :value="fw.slug">
              {{ fw.name }}
            </option>
          </select>
        </div>
        <div v-if="scanResult" class="scan-result">
          <strong>
            Ingested {{ scanResult.ingested }}, skipped {{ scanResult.skipped }}, errors
            {{ scanResult.errors }}
          </strong>
          <div v-if="scanResult.errors > 0" class="scan-errors">
            {{
              scanResult.results.filter(
                (r: any) => r.status !== 'ingested' && r.status !== 'skipped_existing'
              ).length
            }}
            failures — first 3:
            <ul>
              <li
                v-for="r in scanResult.results
                  .filter((r: any) => r.status === 'fetch_failed' || r.status === 'ingest_failed')
                  .slice(0, 3)"
                :key="r.name"
              >
                {{ r.name }}: {{ r.error }}
              </li>
            </ul>
          </div>
        </div>
        <div v-if="scanError" class="scan-errors">{{ scanError }}</div>
        <div class="edit-actions">
          <button
            class="btn btn-primary"
            :disabled="scanRunning || !scanPath.trim()"
            @click="runScanIngest()"
          >
            {{ scanRunning ? 'Scanning…' : 'Start scan' }}
          </button>
          <button class="btn btn-secondary" :disabled="scanRunning" @click="scanDialogOpen = false">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type {
  ComplianceFrameworkLibraryEntry,
  ComplianceFrameworkSummary
} from '../../composables/useComplianceFrameworks'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

type FrameworkLibraryTabId = 'frameworks' | 'sourceDocuments' | 'corpus'
type FrameworkCategoryId =
  | 'all'
  | 'cybersecurity'
  | 'information-security'
  | 'maritime-safety'
  | 'governance'
  | 'general'
type CategorizedFramework = Pick<
  ComplianceFrameworkSummary | ComplianceFrameworkLibraryEntry,
  'slug' | 'name' | 'description'
>
type FrameworkCategoryOption = {
  id: FrameworkCategoryId
  label: string
  count: number
}
type FrameworkCategoryGroup<T> = {
  id: FrameworkCategoryId
  label: string
  items: T[]
}
type CorpusDocument = {
  source: string
  framework: string
  chunks: number
}

const compliancePage = useCompliancePageContext()
const activeTab = toRef(compliancePage, 'activeTab')
const frameworkLibrary = toRef(compliancePage, 'frameworkLibrary')
const frameworkLibraryLoading = toRef(compliancePage, 'frameworkLibraryLoading')
const frameworkUploading = toRef(compliancePage, 'frameworkUploading')
const frameworkUploadMessage = toRef(compliancePage, 'frameworkUploadMessage')
const frameworkUploadOk = toRef(compliancePage, 'frameworkUploadOk')
const frameworks = toRef(compliancePage, 'frameworks')
const loading = toRef(compliancePage, 'loading')
const frameworkLoadError = toRef(compliancePage, 'frameworkLoadError')
const analysisErrors = toRef(compliancePage, 'analysisErrors')
const running = toRef(compliancePage, 'running')
const reports = toRef(compliancePage, 'reports')
const corpusStats = toRef(compliancePage, 'corpusStats')
const scanDialogOpen = toRef(compliancePage, 'scanDialogOpen')
const scanPath = toRef(compliancePage, 'scanPath')
const scanFramework = toRef(compliancePage, 'scanFramework')
const scanRunning = toRef(compliancePage, 'scanRunning')
const scanResult = toRef(compliancePage, 'scanResult')
const scanError = toRef(compliancePage, 'scanError')
const progress = toRef(compliancePage, 'progress')
const onFrameworkUpload = compliancePage.onFrameworkUpload
const loadFrameworks = compliancePage.loadFrameworks
const getTrend = compliancePage.getTrend
const gapControlIds = compliancePage.gapControlIds
const runGapAnalysis = compliancePage.runGapAnalysis
const runScanIngest = compliancePage.runScanIngest
const viewReport = compliancePage.viewReport
const evidenceSearchLink = compliancePage.evidenceSearchLink
const fileLinkFor = compliancePage.fileLinkFor

const frameworkLibraryTab = ref<FrameworkLibraryTabId>('frameworks')
const frameworkCategoryFilter = ref<FrameworkCategoryId>('all')

const frameworkLibraryTabs: { id: FrameworkLibraryTabId; label: string; icon: string }[] = [
  { id: 'frameworks', label: 'Frameworks', icon: 'layout-grid' },
  { id: 'sourceDocuments', label: 'Source Documents', icon: 'file-text' },
  { id: 'corpus', label: 'Ingested Corpus', icon: 'archive' }
]

const orderedCategoryIds: Exclude<FrameworkCategoryId, 'all'>[] = [
  'cybersecurity',
  'information-security',
  'maritime-safety',
  'governance',
  'general'
]

const categoryLabelById: Record<FrameworkCategoryId, string> = {
  all: 'All',
  cybersecurity: 'Cybersecurity',
  'information-security': 'Information Security',
  'maritime-safety': 'Maritime / Safety',
  governance: 'Governance',
  general: 'General'
}

const currentCategoryItems = computed<CategorizedFramework[]>(() => {
  if (frameworkLibraryTab.value === 'sourceDocuments') {
    return frameworkLibrary.value
  }

  return frameworks.value
})

const frameworkCategoryOptions = computed<FrameworkCategoryOption[]>(() => {
  const counts = countFrameworkCategories(currentCategoryItems.value)

  return [
    { id: 'all', label: categoryLabelById.all, count: currentCategoryItems.value.length },
    ...orderedCategoryIds
      .map((id) => ({ id, label: categoryLabelById[id], count: counts[id] || 0 }))
      .filter((category) => category.count > 0)
  ]
})

const selectedFrameworkCategory = computed<FrameworkCategoryId>(() => {
  const selected = frameworkCategoryFilter.value
  const available = frameworkCategoryOptions.value.some((category) => category.id === selected)

  return available ? selected : 'all'
})

const groupedFrameworks = computed<FrameworkCategoryGroup<ComplianceFrameworkSummary>[]>(() => {
  return groupFrameworksByCategory(frameworks.value)
})

const groupedFrameworkLibrary = computed<FrameworkCategoryGroup<ComplianceFrameworkLibraryEntry>[]>(
  () => {
    return groupFrameworksByCategory(frameworkLibrary.value)
  }
)

const missingRequiredDocumentCount = computed(() => {
  return frameworkLibrary.value.reduce(
    (count, framework) => count + framework.missing_required.length,
    0
  )
})

const corpusDocuments = computed<CorpusDocument[]>(() => {
  return [...(corpusStats.value?.sources || [])].sort((a, b) => {
    return corpusSourceName(a.source).localeCompare(corpusSourceName(b.source))
  })
})

function countFrameworkCategories(
  items: CategorizedFramework[]
): Record<FrameworkCategoryId, number> {
  return items.reduce(
    (counts, item) => {
      const category = getFrameworkCategory(item)
      counts[category] = (counts[category] || 0) + 1
      return counts
    },
    {
      all: items.length,
      cybersecurity: 0,
      'information-security': 0,
      'maritime-safety': 0,
      governance: 0,
      general: 0
    } as Record<FrameworkCategoryId, number>
  )
}

function groupFrameworksByCategory<T extends CategorizedFramework>(
  items: T[]
): FrameworkCategoryGroup<T>[] {
  const selected = selectedFrameworkCategory.value
  const categories = selected === 'all' ? orderedCategoryIds : [selected]

  return categories
    .map((id) => ({
      id,
      label: categoryLabelById[id],
      items: items.filter((item) => getFrameworkCategory(item) === id)
    }))
    .filter((group) => group.items.length > 0)
}

function getFrameworkCategory(
  framework: CategorizedFramework
): Exclude<FrameworkCategoryId, 'all'> {
  const text = `${framework.slug} ${framework.name} ${framework.description || ''}`.toLowerCase()

  if (
    includesAny(text, [
      'iacs',
      'ism code',
      'ism_code',
      'maritime',
      'imo',
      'ship',
      'vessel',
      'class society',
      'safety management',
      'sms'
    ])
  ) {
    return 'maritime-safety'
  }

  if (includesAny(text, ['nist', 'cyber', 'iec 62443', 'iec_62443', '62443', 'rcc'])) {
    return 'cybersecurity'
  }

  if (includesAny(text, ['iso 27001', 'iso_27001', '27001', '27002', 'isms'])) {
    return 'information-security'
  }

  if (includesAny(text, ['governance', 'policy', 'audit', 'risk', 'control'])) {
    return 'governance'
  }

  return 'general'
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term))
}

function corpusSourceHref(source: string): string {
  const trimmed = source.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return fileLinkFor(trimmed)
  }

  return evidenceSearchLink(trimmed)
}

function corpusSourceActionLabel(source: string): string {
  const trimmed = source.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return 'Open source'
  }

  if (trimmed.startsWith('/')) {
    return 'Open in Files'
  }

  return 'Find in Files'
}

function corpusSourceName(source: string): string {
  const trimmed = source.trim()
  const normalized = trimmed.replace(/\\/g, '/')
  const name = normalized.split('/').filter(Boolean).pop()

  return name || trimmed
}

function corpusSourceLocation(source: string): string {
  const trimmed = source.trim()
  const normalized = trimmed.replace(/\\/g, '/')

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).host
    } catch {
      return ''
    }
  }

  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 1) {
    return ''
  }

  return normalized.startsWith('/')
    ? `/${parts.slice(0, -1).join('/')}`
    : parts.slice(0, -1).join('/')
}
</script>
