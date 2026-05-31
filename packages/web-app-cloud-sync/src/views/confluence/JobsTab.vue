<template>
  <div class="jobs-tab">
    <!-- Header row -->
    <div class="section-header">
      <span>Import Jobs</span>
      <button class="btn btn-secondary btn-sm" @click="openAddWizard">+ Add Job</button>
    </div>

    <!-- Error banner -->
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

    <!-- Toast notification -->
    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>

    <!-- Jobs table -->
    <div class="card">
      <div v-if="jobs.length > 0" class="card-body card-body-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Connection</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Schedule</th>
              <th>Enabled</th>
              <th>Last Run</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id">
              <td class="cell-name">{{ job.name }}</td>
              <td class="cell-meta">{{ connectionName(job.connection_id) }}</td>
              <td class="cell-meta">{{ sourceLabel(job) }}</td>
              <td class="cell-meta">{{ destinationLabel(job) }}</td>
              <td class="cell-meta">{{ humanSchedule(job.schedule) }}</td>
              <td>
                <button
                  class="toggle-btn"
                  :class="job.enabled ? 'toggle-on' : 'toggle-off'"
                  :disabled="togglingId === job.id"
                  :title="job.enabled ? 'Disable' : 'Enable'"
                  @click="handleToggleEnabled(job)"
                >
                  {{ job.enabled ? 'On' : 'Off' }}
                </button>
              </td>
              <td class="cell-meta">
                {{ job.last_run_at ? formatDate(job.last_run_at) : 'Never' }}
              </td>
              <td class="cell-actions">
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="runningId === job.id"
                  @click="handleRunNow(job.id)"
                >
                  {{ runningId === job.id ? '...' : 'Run Now' }}
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="dryRunningId === job.id"
                  @click="handleDryRun(job.id)"
                >
                  {{ dryRunningId === job.id ? '...' : 'Dry Run' }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="openEditWizard(job)">Edit</button>
                <button
                  class="btn btn-danger btn-sm"
                  :disabled="deletingId === job.id"
                  @click="handleDelete(job.id)"
                >
                  {{ deletingId === job.id ? '...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="loading" class="card-body card-body-empty">Loading jobs...</div>
      <div v-else class="card-body card-body-empty">
        No import jobs configured. Add one to get started.
      </div>
    </div>

    <!-- Dry Run Result panel -->
    <div v-if="dryRunResult" class="card dry-run-card">
      <div class="card-header">
        <span>Dry Run Preview — {{ dryRunJobName }}</span>
        <button class="btn btn-secondary btn-sm" @click="dryRunResult = null">Close</button>
      </div>
      <div class="card-body">
        <div class="dry-run-stats">
          <div class="dry-run-stat">
            <span class="stat-num stat-add">+{{ dryRunResult.add }}</span
            ><span>pages to add</span>
          </div>
          <div class="dry-run-stat">
            <span class="stat-num stat-upd">~{{ dryRunResult.update }}</span
            ><span>pages to update</span>
          </div>
          <div class="dry-run-stat">
            <span class="stat-num stat-del">-{{ dryRunResult.delete }}</span
            ><span>pages to delete</span>
          </div>
        </div>
        <div v-if="dryRunResult.sample_adds.length" class="dry-run-samples">
          <div class="sample-heading">Sample additions</div>
          <ul class="sample-list">
            <li v-for="s in dryRunResult.sample_adds" :key="s">{{ s }}</li>
          </ul>
        </div>
        <div v-if="dryRunResult.sample_updates.length" class="dry-run-samples">
          <div class="sample-heading">Sample updates</div>
          <ul class="sample-list">
            <li v-for="s in dryRunResult.sample_updates" :key="s">{{ s }}</li>
          </ul>
        </div>
        <div v-if="dryRunResult.sample_deletes.length" class="dry-run-samples">
          <div class="sample-heading">Sample deletions</div>
          <ul class="sample-list">
            <li v-for="s in dryRunResult.sample_deletes" :key="s">{{ s }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ─── Wizard overlay ─────────────────────────────────────────────────── -->
    <div v-if="wizardOpen" class="wizard-overlay" @click.self="closeWizard">
      <div class="wizard-drawer">
        <div class="wizard-header">
          <span>{{ editingJob ? 'Edit Import Job' : 'New Import Job' }}</span>
          <button class="btn btn-secondary btn-sm" @click="closeWizard">Cancel</button>
        </div>

        <!-- Step indicator -->
        <div class="step-bar">
          <div
            v-for="(label, i) in stepLabels"
            :key="i"
            class="step-item"
            :class="{ 'step-active': wizardStep === i + 1, 'step-done': wizardStep > i + 1 }"
          >
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-label">{{ label }}</span>
          </div>
        </div>

        <div class="wizard-body">
          <div v-if="wizardError" class="error-banner" style="margin-bottom: 14px">
            {{ wizardError }}
          </div>

          <!-- Step 1: Connection -->
          <div v-if="wizardStep === 1">
            <div class="form-row">
              <label class="form-label">Connection <span class="form-required">*</span></label>
              <select v-model="wiz.connectionId" class="form-select" :disabled="connectionsLoading">
                <option value="">
                  {{ connectionsLoading ? 'Loading...' : '— select a connection —' }}
                </option>
                <option v-for="c in connections" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <p v-if="connections.length === 0 && !connectionsLoading" class="form-help">
                No connections found. Go to the Connections tab to add one.
              </p>
            </div>
          </div>

          <!-- Step 2: Source -->
          <div v-if="wizardStep === 2">
            <div class="form-row">
              <label class="form-label">Space <span class="form-required">*</span></label>
              <select
                v-model="wiz.spaceKey"
                class="form-select"
                :disabled="spacesLoading"
                @change="onSpaceChange"
              >
                <option value="">
                  {{ spacesLoading ? 'Loading spaces...' : '— select a space —' }}
                </option>
                <option v-for="s in spaces" :key="s.key" :value="s.key">
                  {{ s.name }} ({{ s.key }})
                </option>
              </select>
            </div>
            <div v-if="wiz.spaceKey" class="form-row">
              <label class="form-label">Scope</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input v-model="wiz.scopeMode" type="radio" value="space" />
                  <span>Whole space</span>
                </label>
                <label class="radio-option">
                  <input v-model="wiz.scopeMode" type="radio" value="subtree" />
                  <span>Select subtree root</span>
                </label>
              </div>
            </div>
            <div v-if="wiz.scopeMode === 'subtree' && wiz.spaceKey" class="form-row">
              <label class="form-label">Subtree Root</label>
              <BrowseTreePicker
                v-model="wiz.subtreeRootId"
                :connection-id="wiz.connectionId"
                :space-key="wiz.spaceKey"
              />
            </div>
          </div>

          <!-- Step 3: Destination -->
          <div v-if="wizardStep === 3">
            <div class="form-row">
              <label class="form-label">Destination</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    v-model="wiz.destinationMode"
                    type="radio"
                    value="new_space"
                    @change="onDestModeChange"
                  />
                  <span>New Space</span>
                </label>
                <label class="radio-option">
                  <input
                    v-model="wiz.destinationMode"
                    type="radio"
                    value="existing_folder"
                    @change="onDestModeChange"
                  />
                  <span>Existing Folder</span>
                </label>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">
                {{ wiz.destinationMode === 'new_space' ? 'New Space Name' : 'Folder Path' }}
                <span class="form-required">*</span>
              </label>
              <input
                v-model="wiz.destinationRef"
                class="form-input"
                :placeholder="
                  wiz.destinationMode === 'new_space'
                    ? 'Confluence: My Space'
                    : '/Documents/Confluence'
                "
              />
              <p v-if="wiz.destinationMode === 'new_space'" class="form-help">
                A new Cloudbase space will be created with this name.
              </p>
              <p v-else class="form-help">
                Specify the path of an existing folder in Cloudbase (e.g. /Personal/Confluence).
              </p>
            </div>
          </div>

          <!-- Step 4: Schedule -->
          <div v-if="wizardStep === 4">
            <div class="form-row">
              <label class="form-label">Schedule Preset</label>
              <div class="preset-btns">
                <button
                  v-for="p in schedulePresets"
                  :key="p.cron"
                  class="btn btn-secondary btn-sm preset-btn"
                  :class="{
                    'preset-active': wiz.scheduleCron === p.cron && wiz.scheduleMode !== 'custom'
                  }"
                  @click="selectPreset(p.cron)"
                >
                  {{ p.label }}
                </button>
                <button
                  class="btn btn-secondary btn-sm preset-btn"
                  :class="{ 'preset-active': wiz.scheduleMode === 'custom' }"
                  @click="wiz.scheduleMode = 'custom'"
                >
                  Custom
                </button>
              </div>
            </div>
            <div v-if="wiz.scheduleMode === 'custom'" class="form-row">
              <label class="form-label">Cron Expression <span class="form-required">*</span></label>
              <input v-model="wiz.scheduleCron" class="form-input" placeholder="e.g. 0 3 * * *" />
              <p class="form-help">
                Standard 5-field cron syntax (minute hour day-of-month month day-of-week).
              </p>
            </div>
            <div v-else-if="wiz.scheduleCron" class="form-row">
              <p class="schedule-summary">
                Will run: <strong>{{ humanSchedule(wiz.scheduleCron) }}</strong>
              </p>
            </div>
          </div>

          <!-- Step 5: Review -->
          <div v-if="wizardStep === 5">
            <div class="review-table">
              <div class="review-row">
                <span class="review-key">Job Name</span>
                <span class="review-val">{{ wiz.name }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Connection</span>
                <span class="review-val">{{ connectionName(wiz.connectionId) }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Source</span>
                <span class="review-val">{{
                  wiz.scopeMode === 'subtree'
                    ? `Subtree: ${wiz.subtreeRootId}`
                    : `Space: ${wiz.spaceKey}`
                }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Destination</span>
                <span class="review-val">{{
                  wiz.destinationMode === 'new_space'
                    ? `New Space: ${wiz.destinationRef}`
                    : `Folder: ${wiz.destinationRef}`
                }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Schedule</span>
                <span class="review-val">{{ humanSchedule(wiz.scheduleCron) }}</span>
              </div>
            </div>
            <div class="form-row" style="margin-top: 16px">
              <label class="form-label">Job Name <span class="form-required">*</span></label>
              <input v-model="wiz.name" class="form-input" placeholder="e.g. ENG Wiki Import" />
            </div>
          </div>
        </div>

        <!-- Wizard footer navigation -->
        <div class="wizard-footer">
          <button v-if="wizardStep > 1" class="btn btn-secondary" @click="wizardStep--">
            Back
          </button>
          <span style="flex: 1" />
          <button
            v-if="wizardStep < 5"
            class="btn btn-primary"
            :disabled="!canAdvance"
            @click="handleWizardNext"
          >
            Next
          </button>
          <button v-else class="btn btn-primary" :disabled="saving" @click="handleWizardSave">
            {{ saving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Job' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  runJob,
  dryRunJob,
  listConnections,
  listSpaces
} from './api'
import type { ImportJob, Connection, ConfluenceSpace, DryRunResult } from './api'
import BrowseTreePicker from './BrowseTreePicker.vue'

// ─── State ────────────────────────────────────────────────────────────────────

const jobs = ref<ImportJob[]>([])
const connections = ref<Connection[]>([])
const spaces = ref<ConfluenceSpace[]>([])

const loading = ref(false)
const connectionsLoading = ref(false)
const spacesLoading = ref(false)

const errorMsg = ref('')
const toastMsg = ref('')
const toastType = ref<'toast-ok' | 'toast-err'>('toast-ok')

const deletingId = ref<string | null>(null)
const runningId = ref<string | null>(null)
const dryRunningId = ref<string | null>(null)
const togglingId = ref<string | null>(null)

const dryRunResult = ref<DryRunResult | null>(null)
const dryRunJobName = ref('')

// ─── Wizard state ─────────────────────────────────────────────────────────────

const wizardOpen = ref(false)
const wizardStep = ref(1)
const wizardError = ref('')
const saving = ref(false)
const editingJob = ref<ImportJob | null>(null)

const emptyWiz = () => ({
  connectionId: '',
  spaceKey: '',
  scopeMode: 'space' as 'space' | 'subtree',
  subtreeRootId: null as string | null,
  destinationMode: 'new_space' as 'new_space' | 'existing_folder',
  destinationRef: '',
  scheduleMode: 'preset' as 'preset' | 'custom',
  scheduleCron: '0 2 * * *',
  name: ''
})

const wiz = ref(emptyWiz())

const stepLabels = ['Connection', 'Source', 'Destination', 'Schedule', 'Review']

const schedulePresets = [
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily', cron: '0 2 * * *' },
  { label: 'Weekly', cron: '0 2 * * 0' }
]

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadJobs()
  loadConnections()
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const canAdvance = computed(() => {
  switch (wizardStep.value) {
    case 1:
      return !!wiz.value.connectionId
    case 2:
      return !!wiz.value.spaceKey && (wiz.value.scopeMode === 'space' || !!wiz.value.subtreeRootId)
    case 3:
      return !!wiz.value.destinationRef.trim()
    case 4:
      return !!wiz.value.scheduleCron.trim()
    default:
      return true
  }
})

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadJobs() {
  loading.value = true
  errorMsg.value = ''
  try {
    jobs.value = await listJobs()
  } catch (e: any) {
    errorMsg.value = `Failed to load jobs: ${e?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

async function loadConnections() {
  connectionsLoading.value = true
  try {
    connections.value = await listConnections()
  } catch {
    // silent — table will show no connections
  } finally {
    connectionsLoading.value = false
  }
}

async function loadSpaces(cid: string) {
  spacesLoading.value = true
  spaces.value = []
  try {
    spaces.value = await listSpaces(cid)
  } catch (e: any) {
    wizardError.value = `Failed to load spaces: ${e?.message || 'Unknown error'}`
  } finally {
    spacesLoading.value = false
  }
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function openAddWizard() {
  editingJob.value = null
  wiz.value = emptyWiz()
  wizardError.value = ''
  wizardStep.value = 1
  wizardOpen.value = true
}

function openEditWizard(job: ImportJob) {
  editingJob.value = job
  const preset = schedulePresets.find((p) => p.cron === job.schedule)
  wiz.value = {
    connectionId: job.connection_id,
    spaceKey: job.source_key,
    scopeMode: job.source_type === 'subtree' ? 'subtree' : 'space',
    subtreeRootId: job.source_type === 'subtree' ? job.source_key : null,
    destinationMode: job.destination_mode,
    destinationRef: job.destination_ref,
    scheduleMode: preset ? 'preset' : 'custom',
    scheduleCron: job.schedule || '0 2 * * *',
    name: job.name
  }
  wizardError.value = ''
  wizardStep.value = 1
  wizardOpen.value = true
  loadSpaces(job.connection_id)
}

function closeWizard() {
  wizardOpen.value = false
  editingJob.value = null
}

async function handleWizardNext() {
  wizardError.value = ''

  if (wizardStep.value === 1 && wiz.value.connectionId) {
    // Load spaces when moving past step 1
    await loadSpaces(wiz.value.connectionId)
  }

  if (wizardStep.value === 2 && wiz.value.spaceKey && wiz.value.destinationMode === 'new_space') {
    // Pre-fill destination name from selected space
    const space = spaces.value.find((s) => s.key === wiz.value.spaceKey)
    if (space && !wiz.value.destinationRef) {
      wiz.value.destinationRef = `Confluence: ${space.name}`
    }
    // Pre-fill job name from space
    if (space && !wiz.value.name) {
      wiz.value.name = `${space.name} Import`
    }
  }

  wizardStep.value++
}

function onSpaceChange() {
  wiz.value.subtreeRootId = null
  wiz.value.destinationRef = ''
  wiz.value.name = ''
}

function onDestModeChange() {
  // Reset destinationRef when mode changes so prefill can re-run if needed
  wiz.value.destinationRef = ''
}

function selectPreset(cron: string) {
  wiz.value.scheduleCron = cron
  wiz.value.scheduleMode = 'preset'
}

async function handleWizardSave() {
  wizardError.value = ''
  if (!wiz.value.name.trim()) {
    wizardError.value = 'Please enter a job name.'
    return
  }

  saving.value = true
  try {
    if (editingJob.value) {
      await updateJob(editingJob.value.id, {
        name: wiz.value.name.trim(),
        schedule: wiz.value.scheduleCron,
        destination_mode: wiz.value.destinationMode,
        destination_ref: wiz.value.destinationRef.trim()
      })
      showToast('Job updated successfully.', 'toast-ok')
    } else {
      await createJob({
        connection_id: wiz.value.connectionId,
        name: wiz.value.name.trim(),
        source_type: wiz.value.scopeMode === 'subtree' ? 'subtree' : 'space',
        source_key:
          wiz.value.scopeMode === 'subtree'
            ? (wiz.value.subtreeRootId ?? wiz.value.spaceKey)
            : wiz.value.spaceKey,
        destination_mode: wiz.value.destinationMode,
        destination_ref: wiz.value.destinationRef.trim(),
        schedule: wiz.value.scheduleCron,
        enabled: true
      })
      showToast('Job created successfully.', 'toast-ok')
    }
    closeWizard()
    await loadJobs()
  } catch (e: any) {
    wizardError.value = `Failed to save: ${e?.message || 'Unknown error'}`
  } finally {
    saving.value = false
  }
}

// ─── Table actions ────────────────────────────────────────────────────────────

async function handleDelete(id: string) {
  deletingId.value = id
  errorMsg.value = ''
  try {
    await deleteJob(id)
    await loadJobs()
  } catch (e: any) {
    errorMsg.value = `Failed to delete job: ${e?.message || 'Unknown error'}`
  } finally {
    deletingId.value = null
  }
}

async function handleRunNow(id: string) {
  runningId.value = id
  try {
    await runJob(id)
    showToast('Run started.', 'toast-ok')
    await loadJobs()
  } catch (e: any) {
    showToast(`Failed to start run: ${e?.message || 'Unknown error'}`, 'toast-err')
  } finally {
    runningId.value = null
  }
}

async function handleDryRun(id: string) {
  dryRunningId.value = id
  dryRunResult.value = null
  const job = jobs.value.find((j) => j.id === id)
  dryRunJobName.value = job?.name ?? id
  try {
    dryRunResult.value = await dryRunJob(id)
  } catch (e: any) {
    showToast(`Dry run failed: ${e?.message || 'Unknown error'}`, 'toast-err')
  } finally {
    dryRunningId.value = null
  }
}

async function handleToggleEnabled(job: ImportJob) {
  togglingId.value = job.id
  try {
    await updateJob(job.id, { enabled: !job.enabled })
    await loadJobs()
  } catch (e: any) {
    showToast(`Failed to update job: ${e?.message || 'Unknown error'}`, 'toast-err')
  } finally {
    togglingId.value = null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function connectionName(cid: string): string {
  return connections.value.find((c) => c.id === cid)?.name ?? cid
}

function sourceLabel(job: ImportJob): string {
  return job.source_type === 'subtree' ? `Subtree: ${job.source_key}` : `Space: ${job.source_key}`
}

function destinationLabel(job: ImportJob): string {
  return job.destination_mode === 'new_space'
    ? `New: ${job.destination_ref}`
    : `Folder: ${job.destination_ref}`
}

function humanSchedule(cron: string): string {
  if (!cron) return '-'
  const map: Record<string, string> = {
    '0 * * * *': 'Hourly',
    '0 2 * * *': 'Daily at 02:00',
    '0 2 * * 0': 'Weekly (Sun 02:00)'
  }
  return map[cron] ?? cron
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'toast-ok' | 'toast-err') {
  toastMsg.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 3500)
}
</script>

<style scoped>
.jobs-tab {
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

.error-banner {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: var(--oc-role-error, #dc2626);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
}

.toast {
  position: fixed;
  top: 16px;
  right: 24px;
  z-index: 1200;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  animation: fadeIn 0.2s ease;
}
.toast-ok {
  background: var(--oc-role-primary, #0d856f);
  color: #fff;
}
.toast-err {
  background: var(--oc-role-error, #dc2626);
  color: #fff;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ─── Card ──────────────────────────────────────────────────────────────────── */
.card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.06);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
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

/* ─── Table ─────────────────────────────────────────────────────────────────── */
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
  vertical-align: middle;
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
.cell-actions {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}

/* ─── Toggle button ─────────────────────────────────────────────────────────── */
.toggle-btn {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: none;
}
.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toggle-on {
  background: rgba(13, 133, 111, 0.15);
  color: var(--oc-role-primary, #0d856f);
}
.toggle-off {
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  opacity: 0.6;
}
.toggle-on:hover:not(:disabled) {
  background: rgba(13, 133, 111, 0.25);
}
.toggle-off:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.25);
}

/* ─── Dry-run result panel ──────────────────────────────────────────────────── */
.dry-run-card {
}
.dry-run-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
}
.dry-run-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
}
.stat-add {
  color: var(--oc-role-primary, #0d856f);
}
.stat-upd {
  color: #f0a500;
}
.stat-del {
  color: var(--oc-role-error, #dc2626);
}
.dry-run-stat span:last-child {
  font-size: 11px;
  opacity: 0.6;
}
.dry-run-samples {
  margin-bottom: 10px;
}
.sample-heading {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  margin-bottom: 4px;
}
.sample-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  opacity: 0.8;
}
.sample-list li {
  margin-bottom: 2px;
}

/* ─── Wizard ────────────────────────────────────────────────────────────────── */
.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

/* Wizard drawer is themed against OpenCloud's role tokens (--oc-role-*)
   so it follows the active light/dark theme and inherits the platform's
   surface/on-surface contrast guarantees — previously hardcoded
   `--oc-color-*` names, which don't exist in the design system, so the
   dark-fallback #1e1e2e background combined with a dark-inherited text
   color rendered the drawer effectively unreadable. */
.wizard-drawer {
  width: 520px;
  max-width: 95vw;
  height: 100%;
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #191c1d);
  border-left: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.2);
}

.wizard-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 700;
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  flex-shrink: 0;
}

/* Step indicator */
.step-bar {
  display: flex;
  padding: 12px 20px;
  gap: 0;
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.12));
  flex-shrink: 0;
  overflow-x: auto;
  background: var(--oc-role-surface-container, rgba(128, 128, 128, 0.04));
}
.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--oc-role-on-surface-variant, var(--oc-role-on-surface, inherit));
  opacity: 0.55;
  white-space: nowrap;
}
.step-item + .step-item::before {
  content: '›';
  margin: 0 8px;
  opacity: 0.4;
}
.step-active {
  opacity: 1;
  font-weight: 600;
}
.step-done {
  opacity: 0.85;
}
.step-done .step-num {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
}
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  background: var(--oc-role-surface-container-highest, rgba(128, 128, 128, 0.2));
  color: var(--oc-role-on-surface, inherit);
}
.step-active .step-num {
  background: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-on-primary, #fff);
}

.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  color: var(--oc-role-on-surface, inherit);
}

.wizard-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.15));
  gap: 8px;
  flex-shrink: 0;
  background: var(--oc-role-surface, inherit);
}

/* ─── Form elements ─────────────────────────────────────────────────────────── */
.form-row {
  margin-bottom: 16px;
}
.form-row:last-child {
  margin-bottom: 0;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--oc-role-on-surface, inherit);
}
.form-required {
  color: var(--oc-role-error, #dc2626);
}
.form-help {
  font-size: 11px;
  opacity: 0.7;
  margin: 4px 0 0;
  color: var(--oc-role-on-surface-variant, var(--oc-role-on-surface, inherit));
}
.form-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 5px;
  font-size: 13px;
  background: var(--oc-role-surface, transparent);
  color: var(--oc-role-on-surface, inherit);
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.form-input::placeholder {
  color: var(--oc-role-on-surface-variant, rgba(128, 128, 128, 0.6));
}
.form-select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
  border-radius: 5px;
  font-size: 13px;
  background: var(--oc-role-surface, transparent);
  color: var(--oc-role-on-surface, inherit);
  outline: none;
  box-sizing: border-box;
  cursor: pointer;
}
.form-select:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
.form-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  color: var(--oc-role-on-surface, inherit);
}
.radio-option input[type='radio'] {
  accent-color: var(--oc-role-primary, #0d856f);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.preset-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.preset-btn {
  flex-shrink: 0;
}
.preset-active {
  background: var(--oc-role-primary, #0d856f) !important;
  color: var(--oc-role-on-primary, #fff) !important;
  border-color: transparent !important;
}

.schedule-summary {
  font-size: 13px;
  opacity: 0.85;
  margin: 0;
  padding: 8px 12px;
  background: var(--oc-role-surface-container, rgba(13, 133, 111, 0.08));
  border: 1px solid var(--oc-role-outline-variant, rgba(13, 133, 111, 0.2));
  border-radius: 6px;
  color: var(--oc-role-on-surface, inherit);
}

/* ─── Review table ──────────────────────────────────────────────────────────── */
.review-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
  border-radius: 6px;
  overflow: hidden;
}
.review-row {
  display: flex;
  align-items: baseline;
  padding: 9px 14px;
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.1));
  font-size: 13px;
}
.review-row:last-child {
  border-bottom: none;
}
.review-key {
  width: 120px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  opacity: 0.65;
  color: var(--oc-role-on-surface-variant, var(--oc-role-on-surface, inherit));
}
.review-val {
  flex: 1;
  word-break: break-all;
  color: var(--oc-role-on-surface, inherit);
}

/* ─── Buttons ───────────────────────────────────────────────────────────────── */
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
  color: var(--oc-role-on-primary, #fff);
}
.btn-secondary {
  background: transparent;
  color: var(--oc-role-on-surface, inherit);
  border: 1px solid var(--oc-role-outline, rgba(128, 128, 128, 0.3));
}
.btn-danger {
  background: transparent;
  color: var(--oc-role-error, #dc2626);
  border: 1px solid var(--oc-role-error, #dc2626);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
</style>
