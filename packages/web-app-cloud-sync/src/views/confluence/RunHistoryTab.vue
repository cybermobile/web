<template>
  <div class="run-history-tab">
    <!-- Header row with job selector -->
    <div class="section-header">
      <span>Run History</span>
      <div class="header-controls">
        <select
          v-model="selectedJobId"
          class="form-select"
          :disabled="loadingJobs"
          @change="onJobChange"
        >
          <option value="">— Select a job —</option>
          <option v-for="job in jobs" :key="job.id" :value="job.id">{{ job.name }}</option>
        </select>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="!selectedJobId || loadingRuns"
          @click="loadRuns"
        >
          {{ loadingRuns ? '...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

    <!-- Runs table -->
    <div class="card">
      <div v-if="runs.length > 0" class="card-body card-body-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Status</th>
              <th>Added</th>
              <th>Updated</th>
              <th>Deleted</th>
              <th>Attachments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="run.id">
              <td class="cell-name">{{ selectedJobName }}</td>
              <td class="cell-meta">{{ formatDate(run.started_at) }}</td>
              <td class="cell-meta">{{ run.finished_at ? formatDate(run.finished_at) : '—' }}</td>
              <td>
                <span class="status-badge" :class="statusClass(run.status)">{{ run.status }}</span>
              </td>
              <td class="cell-meta cell-center">{{ run.pages_added }}</td>
              <td class="cell-meta cell-center">{{ run.pages_updated }}</td>
              <td class="cell-meta cell-center">{{ run.pages_deleted }}</td>
              <td class="cell-meta cell-center">{{ run.attachments_synced }}</td>
              <td class="cell-actions">
                <button class="btn btn-secondary btn-sm" @click="openDrawer(run)">View Logs</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="loadingRuns" class="card-body card-body-empty">Loading runs...</div>
      <div v-else-if="selectedJobId" class="card-body card-body-empty">
        No runs found for this job.
      </div>
      <div v-else class="card-body card-body-empty">
        Select a job above to view its run history.
      </div>
    </div>

    <!-- Log drawer overlay -->
    <div v-if="drawerRun" class="drawer-overlay" @click.self="closeDrawer">
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Run Details</span>
          <button class="btn btn-secondary btn-sm" @click="closeDrawer">Close</button>
        </div>
        <div class="drawer-body">
          <!-- Run metadata -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Job</span>
              <span class="meta-value">{{ selectedJobName }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="status-badge" :class="statusClass(drawerRun.status)">{{
                drawerRun.status
              }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Started</span>
              <span class="meta-value">{{ formatDateFull(drawerRun.started_at) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Finished</span>
              <span class="meta-value">{{
                drawerRun.finished_at ? formatDateFull(drawerRun.finished_at) : '—'
              }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Pages Added</span>
              <span class="meta-value">{{ drawerRun.pages_added }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Pages Updated</span>
              <span class="meta-value">{{ drawerRun.pages_updated }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Pages Deleted</span>
              <span class="meta-value">{{ drawerRun.pages_deleted }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Attachments Synced</span>
              <span class="meta-value">{{ drawerRun.attachments_synced }}</span>
            </div>
          </div>

          <!-- Error summary -->
          <div v-if="drawerRun.error_summary" class="error-banner error-banner-detail">
            <strong>Error:</strong> {{ drawerRun.error_summary }}
          </div>

          <!-- Log panel -->
          <div class="log-section">
            <div class="log-header">
              <span class="log-title">Log Output</span>
              <span v-if="drawerRun.status === 'running'" class="live-badge">LIVE</span>
            </div>
            <pre ref="logEl" class="log-pre">{{ logContent || '(no log output)' }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { listJobs, listRuns, streamRunLogs } from './api'
import type { ImportJob, ImportRun } from './api'

// ─── State ────────────────────────────────────────────────────────────────────

const jobs = ref<ImportJob[]>([])
const loadingJobs = ref(false)

const selectedJobId = ref('')
const runs = ref<ImportRun[]>([])
const loadingRuns = ref(false)

const errorMsg = ref('')

const drawerRun = ref<ImportRun | null>(null)
const logContent = ref('')
const logEl = ref<HTMLPreElement | null>(null)

let sseCleanup: (() => void) | null = null

// ─── Computed ─────────────────────────────────────────────────────────────────

const selectedJobName = computed(() => {
  const job = jobs.value.find((j) => j.id === selectedJobId.value)
  return job?.name ?? selectedJobId.value
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadJobs()
})

onUnmounted(() => {
  stopStream()
})

// ─── Methods ──────────────────────────────────────────────────────────────────

async function loadJobs() {
  loadingJobs.value = true
  errorMsg.value = ''
  try {
    jobs.value = await listJobs()
  } catch (e: any) {
    errorMsg.value = `Failed to load jobs: ${e?.message || 'Unknown error'}`
  } finally {
    loadingJobs.value = false
  }
}

function onJobChange() {
  runs.value = []
  if (selectedJobId.value) loadRuns()
}

async function loadRuns() {
  if (!selectedJobId.value) return
  loadingRuns.value = true
  errorMsg.value = ''
  try {
    runs.value = await listRuns(selectedJobId.value)
  } catch (e: any) {
    errorMsg.value = `Failed to load runs: ${e?.message || 'Unknown error'}`
  } finally {
    loadingRuns.value = false
  }
}

function openDrawer(run: ImportRun) {
  stopStream()
  drawerRun.value = run

  if (run.status === 'running') {
    // Live SSE stream
    logContent.value = ''
    sseCleanup = streamRunLogs(
      run.id,
      run.job_id,
      (line: string) => {
        logContent.value += (logContent.value ? '\n' : '') + line
        scrollLogToBottom()
      },
      () => {
        sseCleanup = null
        // Reload the run to get final state
        loadRuns()
      }
    )
  } else {
    // Static log from run object
    logContent.value = run.log || ''
    nextTick(() => scrollLogToBottom())
  }
}

function closeDrawer() {
  stopStream()
  drawerRun.value = null
  logContent.value = ''
}

function stopStream() {
  if (sseCleanup) {
    sseCleanup()
    sseCleanup = null
  }
}

function scrollLogToBottom() {
  nextTick(() => {
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusClass(status: string): string {
  switch (status) {
    case 'running':
      return 'status-running'
    case 'success':
      return 'status-success'
    case 'partial':
      return 'status-partial'
    case 'failed':
      return 'status-failed'
    default:
      return ''
  }
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDateFull(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.run-history-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-header > span {
  font-size: 13px;
  font-weight: 600;
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-banner {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: var(--oc-role-error, #dc2626);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}
.error-banner-detail {
  margin-bottom: 0;
}

/* Form controls */
.form-select {
  padding: 4px 8px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 5px;
  font-size: 13px;
  background: transparent;
  color: inherit;
  outline: none;
  cursor: pointer;
  min-width: 200px;
}
.form-select:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
.form-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Card */
.card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.06);
}
.card-body {
  padding: 14px;
}
.card-body-table {
  padding: 0;
}
.card-body-empty {
  padding: 24px 14px;
  text-align: center;
  opacity: 0.5;
  font-size: 13px;
}

/* Buttons */
.btn {
  padding: 7px 14px;
  border: none;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn:hover:not(:disabled) {
  opacity: 0.85;
}
.btn-primary {
  background: var(--oc-role-primary, #0d856f);
  color: #fff;
}
.btn-secondary {
  background: transparent;
  color: inherit;
  border: 1px solid rgba(128, 128, 128, 0.3);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

/* Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th {
  text-align: left;
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}
.data-table td {
  padding: 7px 14px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}
.data-table tbody tr:last-child td {
  border-bottom: none;
}
.data-table tbody tr:hover td {
  background: rgba(128, 128, 128, 0.05);
}
.cell-name {
  font-weight: 500;
}
.cell-meta {
  opacity: 0.6;
  white-space: nowrap;
}
.cell-center {
  text-align: center;
}
.cell-actions {
  display: flex;
  gap: 4px;
}

/* Status badges */
.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.status-running {
  color: #1976d2;
  background: rgba(25, 118, 210, 0.12);
}
.status-success {
  color: var(--oc-role-primary, #0d856f);
  background: rgba(13, 133, 111, 0.1);
}
.status-partial {
  color: #e6a817;
  background: rgba(230, 168, 23, 0.12);
}
.status-failed {
  color: var(--oc-role-error, #dc2626);
  background: rgba(220, 53, 69, 0.1);
}

/* Drawer overlay */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

/* Drawer panel */
.drawer {
  width: min(680px, 95vw);
  height: 100%;
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #191c1d);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  border-left: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  flex-shrink: 0;
}
.drawer-title {
  font-size: 15px;
  font-weight: 700;
}
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Metadata grid */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 20px;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.meta-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
}
.meta-value {
  font-size: 13px;
}

/* Log panel */
.log-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
}
.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.log-title {
  font-size: 13px;
  font-weight: 600;
}
.live-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #1976d2;
  background: rgba(25, 118, 210, 0.12);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.log-pre {
  flex: 1;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 6px;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Fira Mono', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  min-height: 200px;
  max-height: 60vh;
  color: inherit;
}
</style>
