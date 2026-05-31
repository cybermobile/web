<template>
  <!-- ===== AUDIT PREP TAB ===== -->
  <div v-if="activeTab === 'audit'">
    <div class="page-title-row">
      <h2 class="page-title">
        Audit Prep
        <span v-if="activeReport" class="page-title-sub">— {{ activeReport.framework }}</span>
      </h2>
      <button
        v-if="activeReportSlug"
        class="btn btn-secondary btn-sm"
        :disabled="downloadingBinder"
        title="Export every persisted finding for this framework into a single auditor-ready PDF"
        @click="downloadAuditBinder(activeReportSlug)"
      >
        {{ downloadingBinder ? 'Preparing PDF…' : 'Download binder PDF' }}
      </button>
    </div>
    <div
      v-if="binderMessage"
      class="bulk-inline-message"
      :class="binderOk ? 'findings-bulk-ok' : 'findings-bulk-err'"
    >
      {{ binderMessage }}
    </div>

    <!-- Coverage warning: shown when any framework has missing required
               docs. Drives users into the Framework Library to upload before
               they run a gap analysis against an unindexed standard. -->
    <div v-if="frameworksMissingCount > 0" class="framework-banner">
      <div class="framework-banner-icon" aria-hidden="true">⚠</div>
      <div class="framework-banner-body">
        <div class="framework-banner-title">
          {{ frameworksMissingCount }} required document{{
            frameworksMissingCount === 1 ? '' : 's'
          }}
          not yet ingested
        </div>
        <div class="framework-banner-text">
          Gap analysis will fall back to control-title-only retrieval for frameworks without their
          source PDF indexed, producing mostly "unverifiable" results.
        </div>
      </div>
      <button class="btn btn-primary framework-banner-cta" @click="openFrameworksTab">
        Open Framework Library
      </button>
    </div>

    <div v-if="!activeReport" class="oc-card card">
      <div class="oc-card-body card-body card-body-empty">
        Run gap analysis on a framework from the
        <a href="#" class="link" @click.prevent="activeTab = 'dashboard'">Dashboard</a> to see
        findings here.
      </div>
    </div>

    <div v-else>
      <div class="oc-card card summary-card">
        <div class="oc-card-body card-body">
          <div class="summary-top">
            <div class="summary-pct" :class="coverageClass(activeReport.coverage_percent)">
              {{ activeReport.coverage_percent }}%
            </div>
            <div class="summary-text">
              <div class="summary-title">{{ activeReport.framework }}</div>
              <div class="summary-sub">
                {{ activeReport.covered }} / {{ activeReport.total_controls }} controls have
                verified evidence
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- A13: degraded-results banner (shown when any control failed evaluation) -->
      <div v-if="degradedCount > 0" class="oc-card card card-warning">
        <div class="oc-card-body card-body">
          <strong>⚠ Degraded results:</strong>
          {{ degradedCount }} {{ degradedCount === 1 ? 'control' : 'controls' }}
          could not be evaluated (classified as "observation"). Re-run analysis or check ai-agent
          logs to diagnose.
        </div>
      </div>

      <!-- M10: citation grounding banner -->
      <div
        v-if="activeGrounding"
        class="oc-card card"
        :class="activeGrounding.grounding_percent === 100 ? 'card-ok' : 'card-warning'"
      >
        <div class="oc-card-header card-header">
          <span>
            Citation grounding
            <span v-if="activeGrounding.grounding_percent === 100"
              >— all {{ activeGrounding.total_citations }} citations verified against corpus</span
            >
            <span v-else
              >— {{ activeGrounding.hallucinations.length }} of
              {{ activeGrounding.total_citations }} citations unverified</span
            >
          </span>
          <div class="card-header-actions">
            <span
              class="grounding-pct"
              :class="activeGrounding.grounding_percent === 100 ? 'coverage-good' : 'coverage-warn'"
            >
              {{ activeGrounding.grounding_percent }}%
            </span>
            <button
              v-if="activeReport"
              class="btn btn-sm"
              :disabled="!!verifying[activeReportSlug]"
              @click="verifyReport(activeReportSlug, activeReport)"
            >
              {{ verifying[activeReportSlug] ? 'Verifying…' : 'Re-verify' }}
            </button>
          </div>
        </div>
        <div v-if="activeGrounding.hallucinations.length > 0" class="oc-card-body card-body">
          <p class="form-help">
            The following citations could not be verified against the ingested corpus. Treat the
            affected findings with caution — the claimed evidence may not exist.
          </p>
          <ul class="grounding-issues">
            <li v-for="(h, idx) in activeGrounding.hallucinations.slice(0, 10)" :key="idx">
              <strong>{{ h.control_id }}</strong> — {{ h.control_title }}
              <span
                class="status-badge"
                :class="'grounding-' + h.check.status"
                style="margin-left: 6px"
                >{{ h.check.status }}</span
              >
              <div class="grounding-detail">{{ h.check.mismatches.join('; ') }}</div>
            </li>
            <li v-if="activeGrounding.hallucinations.length > 10">
              …and {{ activeGrounding.hallucinations.length - 10 }} more.
            </li>
          </ul>
        </div>
      </div>
      <div v-else-if="verifying[activeReportSlug]" class="oc-card card">
        <div class="oc-card-body card-body card-body-empty">Verifying citations…</div>
      </div>

      <div class="oc-card card">
        <div class="oc-card-header card-header">
          <span>Findings</span>
          <div class="card-header-actions">
            <!-- A10/A11/A12: export group -->
            <div class="export-group">
              <button class="btn btn-sm" title="Download findings as CSV" @click="exportCsv">
                CSV
              </button>
              <button class="btn btn-sm" title="Download report as JSON" @click="exportJson">
                JSON
              </button>
              <button
                class="btn btn-sm"
                title="Download audit-ready Markdown report"
                @click="exportMarkdown"
              >
                MD
              </button>
              <button class="btn btn-sm" title="Print/save as PDF" @click="exportPdf">PDF</button>
            </div>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': filter === 'all' }"
              @click="filter = 'all'"
            >
              All ({{ activeReport.findings.length }})
            </button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': filter === 'covered' }"
              @click="filter = 'covered'"
            >
              Covered ({{ activeReport.covered }})
            </button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': filter === 'partial' }"
              @click="filter = 'partial'"
            >
              Partial ({{ activeReport.partial }})
            </button>
            <button
              class="btn btn-sm"
              :class="{ 'btn-primary': filter === 'missing' }"
              @click="filter = 'missing'"
            >
              Missing ({{ activeReport.missing }})
            </button>
          </div>
        </div>

        <!-- A6/A7: Search + filter toolbar -->
        <div class="findings-toolbar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search title, clause, reasoning, or evidence…"
            class="form-input findings-search"
          />
          <select v-model="severityFilter" class="form-input filter-select" title="Severity">
            <option value="all">All severities</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
            <option value="observation">Observation only</option>
            <option value="none">No severity</option>
          </select>
          <input
            v-model="clausePrefix"
            type="text"
            placeholder="Clause prefix (e.g. 10.)"
            class="form-input filter-prefix"
            title="Filter by clause ID prefix"
          />
          <label class="filter-toggle" title="Show only controls with no evidence">
            <input v-model="noEvidenceOnly" type="checkbox" />
            <span>No evidence only</span>
          </label>
          <span v-if="isFiltered" class="form-help findings-search-count">
            {{ filteredFindings.length }} of {{ activeReport.findings.length }} match
          </span>
        </div>

        <div class="oc-card-body card-body card-body-table">
          <table class="data-table">
            <thead>
              <tr>
                <th class="th-sort" @click="toggleSort('coverage')">
                  Status<span class="sort-arrow">{{ sortArrow('coverage') }}</span>
                </th>
                <th class="th-sort" @click="toggleSort('severity')">
                  Severity<span class="sort-arrow">{{ sortArrow('severity') }}</span>
                </th>
                <th class="th-sort" @click="toggleSort('control_id')">
                  Clause<span class="sort-arrow">{{ sortArrow('control_id') }}</span>
                </th>
                <th class="th-sort" @click="toggleSort('control_title')">
                  Title<span class="sort-arrow">{{ sortArrow('control_title') }}</span>
                </th>
                <th class="th-sort" @click="toggleSort('top_score')">
                  Score<span class="sort-arrow">{{ sortArrow('top_score') }}</span>
                </th>
                <th class="th-sort" @click="toggleSort('source')">
                  Top Evidence<span class="sort-arrow">{{ sortArrow('source') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="f in filteredFindings" :key="f.control_id">
                <tr class="finding-row" @click="toggleExpanded(f.control_id)">
                  <td>
                    <span class="status-badge" :class="'status-' + f.status">
                      {{ f.status }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-if="f.severity !== 'none'"
                      class="severity-badge"
                      :class="'severity-' + f.severity"
                    >
                      {{ f.severity }}
                    </span>
                    <span v-else class="form-help">—</span>
                  </td>
                  <td class="cell-mono">{{ f.control_id }}</td>
                  <td class="cell-name">{{ f.control_title }}</td>
                  <td class="cell-meta">{{ f.top_score.toFixed(3) }}</td>
                  <td class="cell-meta">
                    <span v-if="f.evidence.length > 0 && f.evidence[0].source">
                      <a
                        class="evidence-source-link"
                        :href="evidenceSearchLink(f.evidence[0].source)"
                        target="_blank"
                        >{{ f.evidence[0].source }}</a
                      ><span v-if="f.evidence[0].clause"> — {{ f.evidence[0].clause }}</span>
                    </span>
                    <span v-else class="form-help">no evidence</span>
                  </td>
                </tr>
                <tr v-if="expanded[f.control_id]" class="finding-detail-row">
                  <td colspan="6">
                    <div class="finding-detail">
                      <div class="detail-section">
                        <div class="detail-label">Section</div>
                        <div class="detail-value">{{ f.control_section }}</div>
                      </div>

                      <!-- A8: Next action text (only for partial/missing/observation) -->
                      <div v-if="f.status !== 'covered'" class="detail-section next-action">
                        <div class="detail-label">Next action</div>
                        <div class="detail-value">{{ nextActionFor(f) }}</div>
                      </div>

                      <div class="detail-section">
                        <div class="detail-label">Reasoning</div>
                        <div class="detail-value">{{ f.reasoning }}</div>
                      </div>
                      <div v-if="f.evidence.length > 0" class="detail-section">
                        <div class="detail-label">Evidence ({{ f.evidence.length }} hits)</div>
                        <ol class="evidence-list">
                          <li v-for="(ev, i) in f.evidence" :key="i" class="evidence-item">
                            <div class="evidence-header">
                              <a
                                v-if="ev.source"
                                class="evidence-source-link"
                                :href="evidenceSearchLink(ev.source)"
                                target="_blank"
                                :title="'Open ' + ev.source + ' in Cloudbase'"
                                >{{ ev.source }}</a
                              >
                              <strong v-else>(unknown source)</strong>
                              <span v-if="ev.clause">clause {{ ev.clause }}</span>
                              <span class="evidence-score">{{ ev.score.toFixed(3) }}</span>
                              <button
                                class="btn btn-sm copy-btn"
                                title="Copy citation"
                                @click.stop="copyCitation(f, ev)"
                              >
                                {{ copiedKey === `${f.control_id}-${i}` ? '✓ Copied' : 'Copy' }}
                              </button>
                            </div>
                            <div v-if="ev.section_title" class="evidence-section">
                              {{ ev.section_title }}
                            </div>
                            <div class="evidence-text">{{ ev.text }}</div>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Run History — relocated from Dashboard (2026-04-17 review).
               Belongs here because it's about audit runs over time, not
               the current state overview. Only shows once at least one
               run exists. -->
    <div v-if="runHistory.length > 0" class="run-history-section">
      <div class="legend-header">Run History</div>
      <table class="run-history-table">
        <thead>
          <tr>
            <th>Framework</th>
            <th>Date</th>
            <th>Covered</th>
            <th>Partial</th>
            <th>Missing</th>
            <th>Coverage</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(run, idx) in runHistory" :key="run.id" class="run-row">
            <td>{{ run.framework }}</td>
            <td>{{ new Date(run.run_at).toLocaleString() }}</td>
            <td>
              <span class="status-badge status-covered">{{ run.covered }}</span>
            </td>
            <td>
              <span class="status-badge status-partial">{{ run.partial }}</span>
            </td>
            <td>
              <span class="status-badge status-missing">{{ run.missing }}</span>
            </td>
            <td :class="coverageClass(run.coverage_percent)">
              {{ run.coverage_percent.toFixed(1) }}%
            </td>
            <td>
              <span v-if="runDelta(run, idx)" :class="'trend-' + runDelta(run, idx)!.direction">
                {{ runDelta(run, idx)!.direction === 'up' ? '+' : ''
                }}{{ runDelta(run, idx)!.delta.toFixed(1) }}%
              </span>
              <span v-else class="form-help">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

const compliancePage = useCompliancePageContext()
const activeTab = toRef(compliancePage, 'activeTab')
const frameworksMissingCount = toRef(compliancePage, 'frameworksMissingCount')
const activeReportSlug = toRef(compliancePage, 'activeReportSlug')
const filter = toRef(compliancePage, 'filter')
const expanded = toRef(compliancePage, 'expanded')
const searchQuery = toRef(compliancePage, 'searchQuery')
const severityFilter = toRef(compliancePage, 'severityFilter')
const clausePrefix = toRef(compliancePage, 'clausePrefix')
const noEvidenceOnly = toRef(compliancePage, 'noEvidenceOnly')
const copiedKey = toRef(compliancePage, 'copiedKey')
const runHistory = toRef(compliancePage, 'runHistory')
const verifying = toRef(compliancePage, 'verifying')
const activeReport = toRef(compliancePage, 'activeReport')
const activeGrounding = toRef(compliancePage, 'activeGrounding')
const filteredFindings = toRef(compliancePage, 'filteredFindings')
const isFiltered = toRef(compliancePage, 'isFiltered')
const degradedCount = toRef(compliancePage, 'degradedCount')
const downloadingBinder = toRef(compliancePage, 'downloadingBinder')
const binderMessage = toRef(compliancePage, 'binderMessage')
const binderOk = toRef(compliancePage, 'binderOk')
const openFrameworksTab = compliancePage.openFrameworksTab
const nextActionFor = compliancePage.nextActionFor
const copyCitation = compliancePage.copyCitation
const exportCsv = compliancePage.exportCsv
const exportJson = compliancePage.exportJson
const exportMarkdown = compliancePage.exportMarkdown
const exportPdf = compliancePage.exportPdf
const verifyReport = compliancePage.verifyReport
const toggleSort = compliancePage.toggleSort
const sortArrow = compliancePage.sortArrow
const coverageClass = compliancePage.coverageClass
const toggleExpanded = compliancePage.toggleExpanded
const evidenceSearchLink = compliancePage.evidenceSearchLink
const downloadAuditBinder = compliancePage.downloadAuditBinder
const runDelta = compliancePage.runDelta
</script>
