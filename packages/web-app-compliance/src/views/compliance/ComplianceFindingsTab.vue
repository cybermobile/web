<template>
  <!-- ===== FINDINGS TAB ===== -->
  <div v-if="activeTab === 'findings'">
    <h2 class="page-title">Findings Tracker</h2>
    <p class="form-help">
      All persisted findings from gap analysis runs. Update status, add notes, or close resolved
      items.
    </p>

    <!-- Filters -->
    <div class="findings-toolbar">
      <input
        v-model="findingsSearch"
        type="search"
        class="form-input findings-search"
        placeholder="Search control id, title, reasoning, notes…"
      />
      <select
        v-model="findingsFilter.framework"
        class="form-input filter-select"
        @change="loadPersistedFindings()"
      >
        <option value="">All Frameworks</option>
        <option v-for="fw in frameworks" :key="fw.slug" :value="fw.slug">
          {{ fw.name }}
        </option>
      </select>
      <select
        v-model="findingsFilter.status"
        class="form-input filter-select"
        @change="loadPersistedFindings()"
      >
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="closed">Closed</option>
      </select>
      <select
        v-model="findingsFilter.severity"
        class="form-input filter-select"
        @change="loadPersistedFindings()"
      >
        <option value="">All Severities</option>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
        <option value="observation">Observation</option>
      </select>
      <div class="findings-stats-bar">
        <span class="stat-chip stat-open">{{ findingsCount.open }} open</span>
        <span class="stat-chip stat-progress">{{ findingsCount.in_progress }} in progress</span>
        <span class="stat-chip stat-closed">{{ findingsCount.closed }} closed</span>
      </div>
    </div>

    <!-- Bulk select header — only shown when there's anything to select.
               Indeterminate state (some-but-not-all selected) is mapped onto
               the native checkbox via :indeterminate binding for accessibility. -->
    <div v-if="filteredPersistedFindings.length > 0" class="findings-bulk-header">
      <label class="findings-bulk-checkbox">
        <input
          type="checkbox"
          :checked="allFilteredSelected"
          :indeterminate.prop="someFilteredSelected && !allFilteredSelected"
          @change="toggleAllFilteredSelection()"
        />
        <span>{{
          selectedFindingIds.size > 0
            ? `${selectedFindingIds.size} selected`
            : `Select all ${filteredPersistedFindings.length} below`
        }}</span>
      </label>
    </div>

    <!-- Findings list -->
    <div v-if="filteredPersistedFindings.length === 0" class="oc-card card">
      <div class="oc-card-body card-body card-body-empty">
        <template v-if="findingsSearch"
          >No findings match <strong>"{{ findingsSearch }}"</strong>.</template
        >
        <template v-else>No findings match the current filters.</template>
      </div>
    </div>

    <div v-else class="findings-list">
      <div
        v-for="f in filteredPersistedFindings"
        :key="f.id"
        class="oc-card finding-card"
        :class="['finding-' + f.status, { 'finding-selected': selectedFindingIds.has(f.id) }]"
      >
        <div class="finding-card-header">
          <input
            type="checkbox"
            class="finding-card-check"
            :checked="selectedFindingIds.has(f.id)"
            :aria-label="`Select finding ${f.control_id}`"
            @click.stop="toggleFindingSelection(f.id)"
            @change.stop
          />
          <div class="finding-card-title">
            <span
              class="status-badge"
              :class="'status-' + f.coverage"
              title="Evidence coverage from the latest gap analysis"
              >{{ evidenceCoverageLabel(f.coverage) }}</span
            >
            <span class="severity-badge" :class="'severity-' + f.severity">{{ f.severity }}</span>
            <strong>{{ f.control_id }}</strong> — {{ f.control_title }}
          </div>
          <div class="finding-card-actions">
            <span class="finding-status-badge" :class="'fstatus-' + f.status">{{
              f.status.replace('_', ' ')
            }}</span>
            <span
              v-if="f.status === 'open' && hasRemediationDocumentsForFinding(f)"
              class="finding-status-badge fstatus-remediation"
            >
              remediation started
            </span>
            <button class="btn btn-sm" @click="openFindingEditor(f)">Edit</button>
            <button class="btn btn-sm btn-danger" @click="deleteFinding(f.id)">Delete</button>
          </div>
        </div>
        <div class="finding-card-body">
          <div class="finding-meta">
            <span>{{ f.framework }}</span>
            <span v-if="f.control_section">{{ f.control_section }}</span>
            <span>Score: {{ f.top_score.toFixed(3) }}</span>
            <span>Updated: {{ new Date(f.updated_at).toLocaleString() }}</span>
          </div>
          <div
            v-if="f.reasoning"
            class="finding-reasoning"
            :class="{ 'finding-ai-warning': isNoRetrievalEvidenceMessage(f.reasoning) }"
          >
            {{ formatFindingReasoning(f.reasoning, documentsForFinding(f).length) }}
          </div>
          <div v-if="f.notes" class="finding-notes"><strong>Notes:</strong> {{ f.notes }}</div>
          <div v-if="f.evidence && f.evidence.length > 0" class="finding-evidence-summary">
            Top evidence:
            <a
              class="evidence-source-link"
              :href="evidenceSearchLink(f.evidence[0].source)"
              target="_blank"
              >{{ f.evidence[0].source }}</a
            >
            <span v-if="f.evidence[0].clause"> clause {{ f.evidence[0].clause }}</span>
          </div>
          <div v-if="documentsForFinding(f).length > 0" class="finding-document-summary">
            {{ documentsForFinding(f).length }} remediation document{{
              documentsForFinding(f).length === 1 ? '' : 's'
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk action bar — floats at the bottom while any are selected.
               Fixed position so it stays in view no matter how far the user
               has scrolled down the list. -->
    <transition name="bulk-bar">
      <div v-if="selectedFindingIds.size > 0" class="findings-bulk-bar">
        <div class="findings-bulk-count">
          {{ selectedFindingIds.size }} finding{{ selectedFindingIds.size === 1 ? '' : 's' }}
          selected
        </div>
        <div class="findings-bulk-actions">
          <button class="btn btn-sm" :disabled="bulkActionInFlight" @click="bulkSetStatus('open')">
            Set Open
          </button>
          <button
            class="btn btn-sm"
            :disabled="bulkActionInFlight"
            @click="bulkSetStatus('in_progress')"
          >
            Set In Progress
          </button>
          <button
            class="btn btn-sm"
            :disabled="bulkActionInFlight"
            @click="bulkSetStatus('closed')"
          >
            Set Closed
          </button>
          <button
            class="btn btn-sm btn-danger"
            :disabled="bulkActionInFlight"
            @click="bulkDeleteSelected()"
          >
            Delete
          </button>
          <button class="btn btn-sm btn-secondary" @click="clearFindingSelection()">Clear</button>
        </div>
        <div
          v-if="bulkActionMessage"
          class="findings-bulk-message"
          :class="bulkActionOk ? 'findings-bulk-ok' : 'findings-bulk-err'"
        >
          {{ bulkActionMessage }}
        </div>
      </div>
    </transition>

    <!-- Finding detail — 5-tab view per PRD §8.2 -->
    <div v-if="editingFinding" class="edit-overlay" @click.self="editingFinding = null">
      <div class="edit-modal finding-detail-panel">
        <div class="finding-detail-header">
          <div>
            <h3>{{ editingFinding.control_id }} — {{ editingFinding.control_title }}</h3>
            <div class="finding-detail-subheader">
              <span
                class="status-badge"
                :class="'status-' + editingFinding.coverage"
                title="Evidence coverage from the latest gap analysis"
                >{{ evidenceCoverageLabel(editingFinding.coverage) }}</span
              >
              <span class="status-badge" :class="'severity-' + editingFinding.severity">{{
                editingFinding.severity
              }}</span>
              <span class="status-badge" :class="'finding-status-' + editingFinding.status">{{
                editingFinding.status.replace('_', ' ')
              }}</span>
              <span class="finding-detail-meta">{{ editingFinding.framework }}</span>
            </div>
          </div>
          <button class="btn-close" @click="editingFinding = null">×</button>
        </div>

        <div class="finding-tabs">
          <button
            v-for="t in findingDetailTabs"
            :key="t.id"
            class="finding-tab"
            :class="{ active: findingDetailTab === t.id }"
            @click="findingDetailTab = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Tab 1: Overview -->
        <div v-if="findingDetailTab === 'overview'" class="finding-tab-body">
          <div class="finding-stat-grid">
            <div class="finding-stat">
              <div class="finding-stat-label">Evidence coverage</div>
              <div class="finding-stat-value">
                {{ evidenceCoverageLabel(editingFinding.coverage) }}
              </div>
            </div>
            <div class="finding-stat">
              <div class="finding-stat-label">Severity</div>
              <div class="finding-stat-value">{{ editingFinding.severity }}</div>
            </div>
            <div class="finding-stat">
              <div class="finding-stat-label">Top score</div>
              <div class="finding-stat-value">{{ editingFinding.top_score.toFixed(3) }}</div>
            </div>
            <div class="finding-stat">
              <div class="finding-stat-label">Source citations</div>
              <div class="finding-stat-value">{{ editingFinding.evidence.length }}</div>
            </div>
          </div>
          <div class="finding-section">
            <div class="finding-section-label">Control section</div>
            <div class="finding-section-body">
              {{ editingFinding.control_section || '—' }}
            </div>
          </div>
          <div class="finding-section">
            <div class="finding-section-label">Framework</div>
            <div class="finding-section-body">{{ editingFinding.framework }}</div>
          </div>
          <div v-if="documentsForFinding(editingFinding).length > 0" class="finding-section">
            <div class="finding-section-label">Remediation documents</div>
            <div class="finding-linked-doc-list">
              <button
                v-for="doc in documentsForFinding(editingFinding)"
                :key="doc.id"
                type="button"
                class="finding-linked-doc"
                @click="openLinkedDocument(doc)"
              >
                <span class="finding-linked-doc-title">{{ doc.title }}</span>
                <span class="finding-linked-doc-meta">
                  {{ doc.stage.replace('_', ' ') }}
                  <template v-if="doc.file_path"> · saved to Files</template>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 2: AI reasoning -->
        <div v-if="findingDetailTab === 'reasoning'" class="finding-tab-body">
          <div class="finding-section">
            <div class="finding-section-label">Agent reasoning</div>
            <div
              v-if="isAiServiceConnectionError(editingFinding.reasoning)"
              class="finding-section-body finding-ai-warning"
            >
              AI reasoning is unavailable because the agent service could not connect to Ollama.
              Check that Ollama is installed, running, and reachable by the AI agent runtime.
            </div>
            <div
              v-else-if="isNoRetrievalEvidenceMessage(editingFinding.reasoning)"
              class="finding-section-body finding-ai-warning"
            >
              {{
                formatFindingReasoning(
                  editingFinding.reasoning,
                  documentsForFinding(editingFinding).length
                )
              }}
            </div>
            <div v-else class="finding-section-body finding-reasoning">
              {{ editingFinding.reasoning || 'No reasoning recorded.' }}
            </div>
          </div>
          <div class="finding-section">
            <div class="finding-section-label">Classification thresholds</div>
            <div class="finding-threshold-info">
              <div>
                Top-hit score <strong>{{ editingFinding.top_score.toFixed(3) }}</strong> vs. covered
                threshold {{ COVERED_THRESHOLD }} / partial threshold {{ PARTIAL_THRESHOLD }}.
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Linked evidence -->
        <div v-if="findingDetailTab === 'evidence'" class="finding-tab-body">
          <div v-if="editingFinding.evidence.length === 0" class="finding-empty">
            No source evidence was retrieved for this control. Remediation documents are tracked on
            the Remediation tab, but they do not change evidence coverage until relevant source
            documents are ingested and analysis is rerun.
          </div>
          <div v-else class="finding-evidence-list">
            <div v-for="(ev, i) in editingFinding.evidence" :key="i" class="finding-evidence-card">
              <div class="finding-evidence-header">
                <a
                  :href="evidenceSearchLink(ev.source)"
                  target="_blank"
                  class="finding-evidence-source"
                  >{{ ev.source }}</a
                >
                <span v-if="ev.clause" class="finding-evidence-clause">clause {{ ev.clause }}</span>
                <span class="finding-evidence-score">{{ ev.score.toFixed(3) }}</span>
              </div>
              <div v-if="ev.section_title" class="finding-evidence-section">
                {{ ev.section_title }}
              </div>
              <div class="finding-evidence-text">{{ ev.text }}</div>
            </div>
          </div>
        </div>

        <!-- Tab 4: Remediation -->
        <div v-if="findingDetailTab === 'remediation'" class="finding-tab-body">
          <div
            v-if="
              editingFinding.status === 'open' && hasRemediationDocumentsForFinding(editingFinding)
            "
            class="finding-remediation-hint"
          >
            <span>A remediation document exists, but this finding is still marked open.</span>
            <button class="btn btn-sm btn-primary" @click="markFindingInProgress(editingFinding)">
              Mark in progress
            </button>
          </div>
          <div class="edit-field">
            <label>Status</label>
            <select v-model="editStatus" class="form-input">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div class="edit-field">
            <label>Remediation notes</label>
            <textarea
              v-model="editNotes"
              class="form-input edit-textarea"
              rows="6"
              placeholder="Who is responsible, what action is being taken, target date, blockers…"
            ></textarea>
          </div>
          <div class="finding-section finding-linked-actions">
            <div class="finding-section-label">Linked actions</div>
            <button class="btn btn-sm" @click="draftRemediationDoc(editingFinding)">
              Draft procedure with agent
            </button>
            <button class="btn btn-sm" @click="askAboutEditingFinding">
              Ask AI about this finding
            </button>
          </div>
          <div class="finding-section">
            <div class="finding-section-label">Remediation documents</div>
            <div v-if="documentsForFinding(editingFinding).length === 0" class="finding-empty">
              No remediation document has been created for this finding yet.
            </div>
            <div v-else class="finding-linked-doc-list">
              <button
                v-for="doc in documentsForFinding(editingFinding)"
                :key="doc.id"
                type="button"
                class="finding-linked-doc"
                @click="openLinkedDocument(doc)"
              >
                <span class="finding-linked-doc-title">{{ doc.title }}</span>
                <span class="finding-linked-doc-meta">
                  {{ doc.stage.replace('_', ' ') }}
                  <template v-if="doc.file_path"> · saved to Files</template>
                </span>
              </button>
            </div>
          </div>
          <div class="edit-actions">
            <button class="btn btn-primary" @click="saveFindingEdit()">Save remediation</button>
            <button class="btn btn-secondary" @click="editingFinding = null">Close</button>
          </div>
        </div>

        <!-- Tab 5: Timeline -->
        <div v-if="findingDetailTab === 'timeline'" class="finding-tab-body">
          <ul class="finding-timeline">
            <li>
              <span class="finding-timeline-stage">Created</span>
              <span class="finding-timeline-time">{{
                new Date(editingFinding.created_at).toLocaleString()
              }}</span>
            </li>
            <li>
              <span class="finding-timeline-stage">Last updated</span>
              <span class="finding-timeline-time">{{
                new Date(editingFinding.updated_at).toLocaleString()
              }}</span>
            </li>
            <li v-if="editingFinding.notes">
              <span class="finding-timeline-stage">Notes</span>
              <span class="finding-timeline-note">{{ editingFinding.notes }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

const compliancePage = useCompliancePageContext()
const COVERED_THRESHOLD = toRef(compliancePage, 'COVERED_THRESHOLD')
const PARTIAL_THRESHOLD = toRef(compliancePage, 'PARTIAL_THRESHOLD')
const activeTab = toRef(compliancePage, 'activeTab')
const frameworks = toRef(compliancePage, 'frameworks')
const findingsCount = toRef(compliancePage, 'findingsCount')
const findingsFilter = toRef(compliancePage, 'findingsFilter')
const findingsSearch = toRef(compliancePage, 'findingsSearch')
const filteredPersistedFindings = toRef(compliancePage, 'filteredPersistedFindings')
const editingFinding = toRef(compliancePage, 'editingFinding')
const editNotes = toRef(compliancePage, 'editNotes')
const editStatus = toRef(compliancePage, 'editStatus')
const findingDetailTab = toRef(compliancePage, 'findingDetailTab')
const findingDetailTabs = toRef(compliancePage, 'findingDetailTabs')
const selectedFindingIds = toRef(compliancePage, 'selectedFindingIds')
const bulkActionInFlight = toRef(compliancePage, 'bulkActionInFlight')
const bulkActionMessage = toRef(compliancePage, 'bulkActionMessage')
const bulkActionOk = toRef(compliancePage, 'bulkActionOk')
const allFilteredSelected = toRef(compliancePage, 'allFilteredSelected')
const someFilteredSelected = toRef(compliancePage, 'someFilteredSelected')
const askAboutEditingFinding = compliancePage.askAboutEditingFinding
const documentsForFinding = compliancePage.documentsForFinding
const hasRemediationDocumentsForFinding = compliancePage.hasRemediationDocumentsForFinding
const evidenceSearchLink = compliancePage.evidenceSearchLink
const loadPersistedFindings = compliancePage.loadPersistedFindings
const openFindingEditor = compliancePage.openFindingEditor
const openLinkedDocument = compliancePage.openLinkedDocument
const markFindingInProgress = compliancePage.markFindingInProgress
const draftRemediationDoc = compliancePage.draftRemediationDoc
const saveFindingEdit = compliancePage.saveFindingEdit
const deleteFinding = compliancePage.deleteFinding
const toggleFindingSelection = compliancePage.toggleFindingSelection
const toggleAllFilteredSelection = compliancePage.toggleAllFilteredSelection
const clearFindingSelection = compliancePage.clearFindingSelection
const bulkSetStatus = compliancePage.bulkSetStatus
const bulkDeleteSelected = compliancePage.bulkDeleteSelected

function isAiServiceConnectionError(reasoning?: string): boolean {
  if (!reasoning) {
    return false
  }

  return /failed to connect to ollama/i.test(reasoning)
}

function isNoRetrievalEvidenceMessage(reasoning?: string): boolean {
  if (!reasoning) {
    return false
  }

  const normalizedReasoning = reasoning.toLowerCase()
  return (
    normalizedReasoning.includes('no retrieval hits returned') ||
    normalizedReasoning.includes('not represented in the ingested corpus')
  )
}

function formatFindingReasoning(reasoning?: string, remediationDocumentCount = 0): string {
  if (isNoRetrievalEvidenceMessage(reasoning)) {
    if (remediationDocumentCount > 0) {
      return `${remediationDocumentCount} remediation document${remediationDocumentCount === 1 ? '' : 's'} linked. Source evidence is still missing for this control: remediation documents track corrective work, but they do not replace uploaded framework/source evidence. Upload or map the relevant source document, then rerun analysis for this framework.`
    }

    return 'No matching source evidence was found for this control in the uploaded compliance documents. This finding is not evidence-backed yet; upload or map the relevant framework/source document, then rerun analysis for this framework.'
  }

  return reasoning || 'No reasoning recorded.'
}

function evidenceCoverageLabel(coverage?: string): string {
  if (coverage === 'covered') {
    return 'evidence covered'
  }
  if (coverage === 'partial') {
    return 'evidence partial'
  }
  if (coverage === 'missing') {
    return 'evidence missing'
  }

  return coverage || 'evidence unknown'
}
</script>
