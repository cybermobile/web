<template>
  <!-- ===== DASHBOARD TAB ===== -->
  <div v-if="activeTab === 'dashboard'">
    <h2 class="page-title">Compliance Dashboard</h2>
    <p class="form-help">
      Run AI-driven gap analysis against your ingested compliance corpus. Controls are classified as
      covered, partial, or missing based on semantic retrieval scores.
    </p>

    <!-- One-glance summary card: frameworks + findings + anomalies + corpus size -->
    <div class="summary-card">
      <div class="oc-card summary-tile" @click="activeTab = 'audit'">
        <div class="summary-tile-value">{{ summaryStats.frameworks }}</div>
        <div class="summary-tile-label">Frameworks</div>
        <div class="summary-tile-sub">{{ summaryStats.totalControls }} controls</div>
      </div>
      <div class="oc-card summary-tile summary-tile-warn" @click="activeTab = 'findings'">
        <div class="summary-tile-value">
          {{ findingsCount.open + findingsCount.in_progress }}
        </div>
        <div class="summary-tile-label">Open findings</div>
        <div class="summary-tile-sub">{{ findingsCount.closed }} closed</div>
      </div>
      <div
        class="oc-card summary-tile"
        :class="summaryStats.anomalyCount > 0 ? 'summary-tile-danger' : ''"
        @click="summaryStats.anomalyCount > 0 ? scrollToAnomalies() : null"
      >
        <div class="summary-tile-value">{{ summaryStats.anomalyCount }}</div>
        <div class="summary-tile-label">Anomalies</div>
        <div class="summary-tile-sub">{{ summaryStats.expiringCount }} certs expiring</div>
      </div>
      <div class="oc-card summary-tile" @click="activeTab = 'documents'">
        <div class="summary-tile-value">{{ documentsOpenCount }}</div>
        <div class="summary-tile-label">Documents in flight</div>
        <div class="summary-tile-sub">{{ summaryStats.corpusChunks }} chunks indexed</div>
      </div>
    </div>

    <!-- First-run onboarding. Shows a 3-step checklist until the
               user has (a) ingested at least one framework source doc,
               (b) run a gap analysis, (c) acknowledged findings. Each
               step has a direct CTA so the user doesn't have to hunt
               for the action. Hides entirely once all three are done. -->
    <div v-if="showOnboarding" class="oc-card onboarding-card">
      <div class="onboarding-head">
        <h3>Get started</h3>
        <button
          class="btn-link onboarding-dismiss"
          title="Dismiss onboarding (you can re-open it from the help menu)"
          @click="dismissOnboarding()"
        >
          Dismiss
        </button>
      </div>
      <ol class="onboarding-steps">
        <li :class="{ 'onboarding-done': onboardingState.framework }">
          <span class="onboarding-step-marker">{{ onboardingState.framework ? '✓' : '1' }}</span>
          <div class="onboarding-step-body">
            <div class="onboarding-step-title">Upload a framework's source text</div>
            <div class="onboarding-step-desc">
              ISO 27001 / 27002 or ISM Code PDFs. Without these, gap analysis has no corpus to cite.
            </div>
          </div>
          <button
            v-if="!onboardingState.framework"
            class="btn btn-primary btn-sm"
            @click="openFrameworksTab"
          >
            Upload
          </button>
        </li>
        <li :class="{ 'onboarding-done': onboardingState.analysis }">
          <span class="onboarding-step-marker">{{ onboardingState.analysis ? '✓' : '2' }}</span>
          <div class="onboarding-step-body">
            <div class="onboarding-step-title">Run gap analysis</div>
            <div class="onboarding-step-desc">
              Scores every control in a framework as covered / partial / missing.
            </div>
          </div>
          <button
            v-if="onboardingState.framework && !onboardingState.analysis"
            class="btn btn-primary btn-sm"
            @click="activeTab = 'frameworks'"
          >
            Run
          </button>
        </li>
        <li :class="{ 'onboarding-done': onboardingState.findings }">
          <span class="onboarding-step-marker">{{ onboardingState.findings ? '✓' : '3' }}</span>
          <div class="onboarding-step-body">
            <div class="onboarding-step-title">Review findings</div>
            <div class="onboarding-step-desc">
              Triage each gap — draft a remediation procedure, reassign, or close.
            </div>
          </div>
          <button
            v-if="onboardingState.analysis && !onboardingState.findings"
            class="btn btn-primary btn-sm"
            @click="openFindingsTab"
          >
            Review
          </button>
        </li>
      </ol>
    </div>

    <!-- Compact helper line — replaces the big legend card with a
               single line + popover. Users who need the detail can
               hover; everyone else gets back the vertical real estate. -->
    <div class="dashboard-helper">
      <span class="dashboard-helper-text">
        Controls classified as
        <span class="status-badge status-covered">covered</span>
        <span class="status-badge status-partial">partial</span>
        <span class="status-badge status-missing">missing</span>
      </span>
      <span
        class="dashboard-helper-tooltip"
        :title="`covered: retrieval score ≥ ${COVERED_THRESHOLD}\npartial: ${PARTIAL_THRESHOLD}–${COVERED_THRESHOLD}\nmissing: < ${PARTIAL_THRESHOLD}`"
        >ⓘ</span
      >
    </div>

    <!-- Anomalies card (PRD §6.2 statistical baseline over structured data) -->
    <div v-if="anomalies && anomalies.total > 0" class="oc-card card anomalies-card">
      <div class="oc-card-header card-header">
        <span>⚠ Anomalies detected — {{ anomalies.total }}</span>
        <button class="btn btn-sm" @click="loadAnomalies()">Refresh</button>
      </div>
      <div class="oc-card-body card-body">
        <ul class="anomaly-list">
          <li v-for="(a, i) in anomalies.anomalies.slice(0, 8)" :key="i" class="anomaly-row">
            <span
              class="status-badge"
              :class="a.severity === 'error' ? 'severity-major' : 'severity-minor'"
              >{{ a.severity }}</span
            >
            <span class="anomaly-kind">{{ a.kind.replace(/_/g, ' ') }}</span>
            <span class="anomaly-detail">{{ anomalyDetailLine(a) }}</span>
            <button
              class="btn btn-sm anomaly-ask-btn"
              title="Ask the compliance assistant about this"
              @click="askAboutAnomaly(a)"
            >
              Ask AI
            </button>
          </li>
          <li v-if="anomalies.anomalies.length > 8" class="anomaly-more">
            …and {{ anomalies.anomalies.length - 8 }} more.
          </li>
        </ul>
      </div>
    </div>

    <!-- Framework grid, error + empty states, and Run History
               moved to the Frameworks and Audit Prep tabs respectively
               (see dashboard review 2026-04-17). The Dashboard now
               focuses on overview signal — tiles, anomalies, onboarding. -->
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

const compliancePage = useCompliancePageContext()
const COVERED_THRESHOLD = toRef(compliancePage, 'COVERED_THRESHOLD')
const PARTIAL_THRESHOLD = toRef(compliancePage, 'PARTIAL_THRESHOLD')
const activeTab = toRef(compliancePage, 'activeTab')
const onboardingState = toRef(compliancePage, 'onboardingState')
const showOnboarding = toRef(compliancePage, 'showOnboarding')
const findingsCount = toRef(compliancePage, 'findingsCount')
const anomalies = toRef(compliancePage, 'anomalies')
const summaryStats = toRef(compliancePage, 'summaryStats')
const documentsOpenCount = toRef(compliancePage, 'documentsOpenCount')
const askAboutAnomaly = compliancePage.askAboutAnomaly
const openFrameworksTab = compliancePage.openFrameworksTab
const openFindingsTab = compliancePage.openFindingsTab
const dismissOnboarding = compliancePage.dismissOnboarding
const scrollToAnomalies = compliancePage.scrollToAnomalies
const loadAnomalies = compliancePage.loadAnomalies
const anomalyDetailLine = compliancePage.anomalyDetailLine
</script>
