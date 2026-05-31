<template>
  <div class="rclone-page">
    <div class="page-layout">
      <div
        class="compliance-sidebar bg-role-surface-container rounded-l-xl overflow-hidden flex flex-col"
      >
        <nav class="oc-sidebar-nav mt-3 px-1" aria-label="Cloud sync navigation">
          <ul class="oc-list relative">
            <li
              class="oc-sidebar-nav-item pb-1 px-2"
              :aria-current="activeSection === 'providers' ? 'page' : undefined"
            >
              <button
                type="button"
                :class="navLinkClass(activeSection === 'providers')"
                @click="openProvidersTab"
              >
                <span class="flex items-center">
                  <span class="oc-icon box-content inline-block align-baseline size-5"
                    ><svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg
                  ></span>
                  <span class="ml-4" :class="{ 'font-bold': activeSection === 'providers' }"
                    >Providers</span
                  >
                </span>
              </button>
            </li>
            <li
              class="oc-sidebar-nav-item pb-1 px-2"
              :aria-current="activeSection === 'sync' ? 'page' : undefined"
            >
              <button
                type="button"
                :class="navLinkClass(activeSection === 'sync')"
                @click="openJobsTab"
              >
                <span class="flex items-center">
                  <span class="oc-icon box-content inline-block align-baseline size-5"
                    ><svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path
                        d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                      ></path></svg
                  ></span>
                  <span class="ml-4" :class="{ 'font-bold': activeSection === 'sync' }">Sync</span>
                </span>
              </button>
            </li>
            <li
              class="oc-sidebar-nav-item pb-1 px-2"
              :aria-current="activeSection === 'confluence' ? 'page' : undefined"
            >
              <button
                type="button"
                :class="navLinkClass(activeSection === 'confluence')"
                @click="openConfluenceImporter"
              >
                <span class="flex items-center">
                  <span class="oc-icon box-content inline-block align-baseline size-5"
                    ><svg
                      class="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path
                        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                      ></path></svg
                  ></span>
                  <span class="ml-4" :class="{ 'font-bold': activeSection === 'confluence' }"
                    >Confluence</span
                  >
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div class="page-body">
        <!-- PROVIDERS TAB -->
        <div v-if="activeSection === 'providers'">
          <div class="two-col">
            <!-- Provider list -->
            <div class="card">
              <div class="card-header">
                <span>Configured Providers</span>
                <button class="btn btn-secondary btn-sm" @click="newProvider()">+ Add</button>
              </div>
              <div v-if="providerList.length > 0" class="card-body card-body-table">
                <div
                  v-for="p in providerList"
                  :key="p.id"
                  class="list-item"
                  :class="{ 'list-item-active': editingProvider?.id === p.id }"
                  @click="editProvider(p)"
                >
                  <span class="list-item-name">{{ p.name }}</span>
                  <span class="list-item-type">{{ p.provider_type }}</span>
                  <span class="list-item-status" :class="p.enabled ? 'status-on' : 'status-off'">{{
                    p.enabled ? 'enabled' : 'disabled'
                  }}</span>
                </div>
              </div>
              <div v-else class="card-body card-body-empty">No providers configured yet.</div>
            </div>

            <!-- Provider form -->
            <div v-if="editingProvider" class="card">
              <div class="card-header">
                <span>{{ isNewProvider ? 'Add Provider' : 'Edit Provider' }}</span>
                <button
                  v-if="!isNewProvider"
                  class="btn btn-danger btn-sm"
                  @click="deleteProvider(editingProvider.id)"
                >
                  Delete
                </button>
              </div>
              <div class="card-body">
                <div class="form-row">
                  <label class="form-label">Name</label>
                  <input
                    v-model="editingProvider.name"
                    class="form-input"
                    placeholder="e.g. Work OneDrive"
                  />
                </div>
                <div v-if="isNewProvider" class="form-row">
                  <label class="form-label">Type</label>
                  <select
                    v-model="editingProvider.provider_type"
                    class="form-input"
                    @change="onTypeChange"
                  >
                    <option value="">Select provider...</option>
                    <option v-for="t in templates" :key="t.type" :value="t.type">
                      {{ t.name }}
                    </option>
                  </select>
                </div>
                <!-- Dynamic fields based on provider template -->
                <template v-if="selectedTemplate">
                  <div
                    v-for="field in selectedTemplate.config_fields"
                    :key="field.name"
                    class="form-row"
                  >
                    <label class="form-label"
                      >{{ field.label }}
                      <span v-if="field.required" class="form-required">*</span></label
                    >
                    <p v-if="field.help" class="form-help">{{ field.help }}</p>
                    <select
                      v-if="field.type === 'select'"
                      v-model="editingProvider.extra_config[field.name]"
                      class="form-input"
                    >
                      <option value="">Select...</option>
                      <option v-for="opt in field.options" :key="opt" :value="opt">
                        {{ opt }}
                      </option>
                    </select>
                    <textarea
                      v-else-if="field.type === 'textarea'"
                      v-model="editingProvider.extra_config[field.name]"
                      class="form-textarea"
                      rows="3"
                    ></textarea>
                    <input
                      v-else
                      v-model="editingProvider.extra_config[field.name]"
                      class="form-input"
                      :type="field.type === 'password' ? 'password' : 'text'"
                      :placeholder="field.help"
                    />
                  </div>
                </template>
                <div class="form-row">
                  <label class="form-label form-label-inline">
                    <input
                      v-model="editingProvider.enabled"
                      type="checkbox"
                      class="form-checkbox"
                    />
                    Enabled
                  </label>
                </div>
                <div class="form-actions">
                  <button class="btn btn-primary" @click="saveProvider">
                    {{ isNewProvider ? 'Add' : 'Save' }}
                  </button>
                  <button class="btn btn-secondary" @click="editingProvider = null">Cancel</button>
                  <button
                    v-if="!isNewProvider"
                    class="btn btn-secondary"
                    @click="testProvider(editingProvider.id)"
                  >
                    Test Connection
                  </button>
                  <span v-if="providerMsg" class="form-msg">{{ providerMsg }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SYNC JOBS TAB -->
        <div v-if="activeSection === 'sync'">
          <div class="page-tabs" role="tablist" aria-label="Sync views">
            <button
              type="button"
              class="page-tab"
              :class="{ active: activeSyncTab === 'jobs' }"
              @click="openJobsTab"
            >
              Sync Jobs
            </button>
            <button
              type="button"
              class="page-tab"
              :class="{ active: activeSyncTab === 'history' }"
              @click="openHistoryTab"
            >
              Run History
            </button>
          </div>
          <div v-if="activeSyncTab === 'jobs'">
            <div class="card">
              <div class="card-header">
                <span>Sync Jobs</span>
                <button class="btn btn-secondary btn-sm" @click="newJob()">+ Add Job</button>
              </div>
              <div v-if="jobList.length > 0" class="card-body card-body-table">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Provider</th>
                      <th>Source</th>
                      <th>Destination</th>
                      <th>Schedule</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="j in jobList" :key="j.id">
                      <td class="cell-name">{{ j.name }}</td>
                      <td class="cell-meta">{{ j.provider_name }}</td>
                      <td class="cell-meta">{{ j.remote_path }}</td>
                      <td class="cell-meta">{{ j.local_path }}</td>
                      <td class="cell-meta">{{ j.schedule || 'Manual' }}</td>
                      <td class="cell-actions">
                        <button class="btn btn-primary btn-sm" @click="runJob(j.id)">Run</button>
                        <button class="btn btn-secondary btn-sm" @click="editJob(j)">Edit</button>
                        <button class="btn btn-danger btn-sm" @click="deleteJob(j.id)">Del</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="card-body card-body-empty">No sync jobs configured.</div>
            </div>

            <!-- Add/edit job form -->
            <div v-if="editingJob" class="card" style="margin-top: 16px">
              <div class="card-header">{{ isNewJob ? 'Add Sync Job' : 'Edit Sync Job' }}</div>
              <div class="card-body">
                <div class="two-col">
                  <div>
                    <div class="form-row">
                      <label class="form-label">Job Name</label>
                      <input
                        v-model="editingJob.name"
                        class="form-input"
                        placeholder="e.g. Sync Work Documents"
                      />
                    </div>
                    <div class="form-row">
                      <label class="form-label">Provider</label>
                      <select v-model="editingJob.provider_id" class="form-input">
                        <option value="">Select...</option>
                        <option v-for="p in providerList" :key="p.id" :value="p.id">
                          {{ p.name }}
                        </option>
                      </select>
                    </div>
                    <div class="form-row">
                      <label class="form-label">Sync Mode</label>
                      <select v-model="editingJob.sync_mode" class="form-input">
                        <option value="copy">Copy (add new files only)</option>
                        <option value="sync">Sync (mirror, may delete)</option>
                        <option value="move">Move (transfer and delete source)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <div class="form-row">
                      <label class="form-label">Remote Path</label>
                      <input v-model="editingJob.remote_path" class="form-input" placeholder="/" />
                    </div>
                    <div class="form-row">
                      <label class="form-label form-label-inline">
                        <input
                          v-model="editingJob.create_space"
                          type="checkbox"
                          class="form-checkbox"
                        />
                        Create as Cloudbase Space
                      </label>
                      <p class="form-help">
                        Creates a dedicated Space instead of syncing to a folder in Personal.
                      </p>
                    </div>
                    <div v-if="!editingJob.create_space" class="form-row">
                      <label class="form-label">Local Path (in Cloudbase)</label>
                      <input
                        v-model="editingJob.local_path"
                        class="form-input"
                        placeholder="/Synced/OneDrive"
                      />
                    </div>
                    <div v-if="editingJob.space_id" class="form-row">
                      <label class="form-label">Space ID</label>
                      <p class="form-help">{{ editingJob.space_id }}</p>
                    </div>
                    <div class="form-row">
                      <label class="form-label">Schedule (cron)</label>
                      <p class="form-help">
                        e.g. */30 = every 30 min, 60 = every hour. Leave empty for manual.
                      </p>
                      <input
                        v-model="editingJob.schedule"
                        class="form-input"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
                <div class="form-actions">
                  <button class="btn btn-primary" @click="saveJob">
                    {{ isNewJob ? 'Create Job' : 'Save' }}
                  </button>
                  <button class="btn btn-secondary" @click="editingJob = null">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <!-- RUN HISTORY TAB -->
          <div v-if="activeSection === 'sync' && activeSyncTab === 'history'">
            <div class="card">
              <div class="card-header">
                <span>Recent Sync Runs</span>
                <button class="btn btn-secondary btn-sm" @click="loadRuns()">Refresh</button>
              </div>
              <div v-if="runList.length > 0" class="card-body card-body-table">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Files</th>
                      <th>Started</th>
                      <th>Duration</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in runList" :key="r.id">
                      <td class="cell-name">{{ getJobName(r.job_id) }}</td>
                      <td>
                        <span class="status-badge" :class="'status-' + r.status">{{
                          r.status
                        }}</span>
                      </td>
                      <td class="cell-meta">{{ r.files_transferred }}</td>
                      <td class="cell-meta">{{ formatTime(r.started_at) }}</td>
                      <td class="cell-meta">{{ formatDuration(r.started_at, r.completed_at) }}</td>
                      <td class="cell-meta">{{ r.errors?.length || 0 }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="card-body card-body-empty">No sync runs yet.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAiToolsServiceUrl } from '@opencloud-eu/web-pkg'
import { getOpenCloudAccessToken } from '@opencloud-eu/web-pkg'

const API = getAiToolsServiceUrl('rclone')
const route = useRoute()
const router = useRouter()

const activeSection = computed<'providers' | 'sync' | 'confluence'>(() => {
  if (route.path.includes('/cloud-sync/sync')) {
    return 'sync'
  }

  if (route.path.includes('/cloud-sync/confluence')) {
    return 'confluence'
  }

  return 'providers'
})

const activeSyncTab = computed<'jobs' | 'history'>(() => {
  return route.path.includes('/cloud-sync/sync/history') ? 'history' : 'jobs'
})

function openProvidersTab() {
  void router.push('/cloud-sync/providers')
}

function openJobsTab() {
  void router.push('/cloud-sync/sync/jobs')
}

function openHistoryTab() {
  void router.push('/cloud-sync/sync/history')
}

function openConfluenceImporter() {
  void router.push('/cloud-sync/confluence/connections')
}
const providerList = ref<any[]>([])
const templates = ref<any[]>([])
const jobList = ref<any[]>([])
const runList = ref<any[]>([])

const editingProvider = ref<any>(null)
const isNewProvider = ref(false)
const providerMsg = ref('')

const editingJob = ref<any>(null)
const isNewJob = ref(false)

async function api(path: string, opts: any = {}) {
  const resp = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  return resp.json()
}

// Providers
async function loadProviders() {
  const data = await api('/api/providers')
  providerList.value = data.providers || []
  const tpl = await api('/api/providers/templates')
  templates.value = tpl.templates || []
}

function newProvider() {
  editingProvider.value = {
    id: '',
    name: '',
    provider_type: '',
    client_id: '',
    client_secret: '',
    token: '',
    remote_path: '/',
    extra_config: {},
    enabled: true
  }
  isNewProvider.value = true
  providerMsg.value = ''
}

function editProvider(p: any) {
  editingProvider.value = { ...p }
  isNewProvider.value = false
  providerMsg.value = ''
}

const selectedTemplate = computed(() => {
  if (!editingProvider.value?.provider_type) return null
  return templates.value.find((t: any) => t.type === editingProvider.value.provider_type) || null
})

function onTypeChange() {
  // Reset extra_config when type changes
  if (editingProvider.value) {
    editingProvider.value.extra_config = {}
  }
}

async function saveProvider() {
  const p = { ...editingProvider.value }
  if (isNewProvider.value) {
    // Don't send empty id — let backend generate it
    delete p.id
    await api('/api/providers', { method: 'POST', body: JSON.stringify(p) })
  } else {
    await api(`/api/providers/${p.id}`, { method: 'PUT', body: JSON.stringify(p) })
  }
  editingProvider.value = null
  await loadProviders()
}

async function deleteProvider(id: string) {
  await api(`/api/providers/${id}`, { method: 'DELETE' })
  editingProvider.value = null
  await loadProviders()
}

async function testProvider(id: string) {
  providerMsg.value = 'Testing...'
  const res = await api(`/api/providers/${id}/test`, { method: 'POST' })
  providerMsg.value =
    res.status === 'ok' ? `Connected (${res.files} files found)` : `Error: ${res.error}`
}

// Jobs
async function loadJobs() {
  await loadProviders()
  const data = await api('/api/jobs')
  jobList.value = data.jobs || []
}

function newJob() {
  editingJob.value = {
    id: '',
    name: '',
    provider_id: '',
    remote_path: '/',
    local_path: '/Synced',
    schedule: '',
    filters: [],
    sync_mode: 'copy',
    create_space: false,
    space_id: '',
    enabled: true
  }
  isNewJob.value = true
}

function editJob(j: any) {
  editingJob.value = { ...j }
  isNewJob.value = false
}

async function saveJob() {
  const j = editingJob.value
  if (isNewJob.value) {
    await api('/api/jobs', { method: 'POST', body: JSON.stringify(j) })
  } else {
    await api(`/api/jobs/${j.id}`, { method: 'PUT', body: JSON.stringify(j) })
  }
  editingJob.value = null
  await loadJobs()
}

async function deleteJob(id: string) {
  await api(`/api/jobs/${id}`, { method: 'DELETE' })
  await loadJobs()
}

async function runJob(id: string) {
  const token = getOpenCloudAccessToken() || ''
  const result = await api(`/api/jobs/${id}/run?access_token=${encodeURIComponent(token)}`, {
    method: 'POST'
  })
  void router.push('/cloud-sync/sync/history')
  await loadRuns()
  if (result.run_id) watchRun(result.run_id)
}

// Runs
async function loadRuns() {
  const data = await api('/api/runs')
  runList.value = data.runs || []
}

function watchRun(runId: string) {
  const es = new EventSource(`${API}/api/runs/${runId}/stream`)
  es.onmessage = (e) => {
    const updated = JSON.parse(e.data)
    const idx = runList.value.findIndex((r: any) => r.id === runId)
    if (idx >= 0) {
      runList.value = [...runList.value.slice(0, idx), updated, ...runList.value.slice(idx + 1)]
    } else {
      runList.value = [updated, ...runList.value]
    }
    if (updated.status === 'completed' || updated.status === 'failed') {
      es.close()
    }
  }
  es.onerror = () => es.close()
}

onUnmounted(() => {})

function getJobName(jobId: string): string {
  const j = jobList.value.find((j: any) => j.id === jobId)
  return j?.name || jobId.slice(0, 8)
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

function formatDuration(start: string, end: string | null): string {
  if (!start || !end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return '<1s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

function loadActiveRouteData() {
  if (activeSection.value === 'providers') {
    void loadProviders()
  } else if (activeSyncTab.value === 'jobs') {
    void loadJobs()
  } else {
    void loadRuns()
  }
}

watch(() => route.path, loadActiveRouteData)

onMounted(loadActiveRouteData)

// Mirrors OpenCloud's web-nav-sidebar active/idle classes so this secondary
// sidebar inherits design-system look-and-feel instead of maintaining its own.
function navLinkClass(isActive: boolean): string {
  const common =
    'oc-button-surface gap-2 justify-between text-base min-h-4 oc-button cursor-pointer disabled:opacity-60 disabled:cursor-default oc-sidebar-nav-item-link relative w-full whitespace-nowrap px-2 py-3 opacity-100 select-none rounded-xl'
  const active = 'oc-button-filled oc-button-surface-filled active overflow-hidden outline'
  const idle =
    'oc-button-raw-inverse oc-button-surface-raw-inverse hover:bg-role-surface-container-highest focus:bg-role-surface-container-highest'
  return `${common} ${isActive ? active : idle}`
}
</script>

<style scoped>
.rclone-page {
  height: 100%;
  overflow: hidden;
  color: var(--oc-role-on-surface, #191c1d);
}
.page-layout {
  display: flex;
  height: 100%;
}
.compliance-sidebar {
  min-width: 230px;
  max-width: 230px;
}
.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 40px;
  background: var(--oc-role-surface, #fff);
  border: 1px solid var(--oc-role-outline-variant, #eceef0);
  border-radius: 10.5px 0 0 10.5px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

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
.page-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--oc-role-outline-variant, rgba(128, 128, 128, 0.2));
}
.page-tab {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
}
.page-tab:hover {
  background: rgba(128, 128, 128, 0.06);
}
.page-tab.active {
  border-bottom-color: var(--oc-role-primary, #0d856f);
  color: var(--oc-role-primary, #0d856f);
}

.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  font-size: 13px;
}
.list-item:last-child {
  border-bottom: none;
}
.list-item:hover {
  background: rgba(128, 128, 128, 0.05);
}
.list-item-active {
  background: rgba(128, 128, 128, 0.1);
}
.list-item-name {
  flex: 1;
  font-weight: 500;
}
.list-item-type {
  opacity: 0.5;
  font-size: 12px;
}
.list-item-status {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
}
.status-on {
  color: var(--oc-role-primary, #0d856f);
  background: rgba(13, 133, 111, 0.1);
}
.status-off {
  opacity: 0.4;
}

.form-row {
  margin-bottom: 14px;
}
.form-row:last-child {
  margin-bottom: 0;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.form-label-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-help {
  font-size: 11px;
  opacity: 0.5;
  margin: 0 0 4px;
}
.form-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 5px;
  font-size: 13px;
  background: transparent;
  color: inherit;
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
select.form-input {
  background-color: var(--oc-role-surface, transparent);
}
select.form-input option {
  background-color: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #191c1d);
}
.form-textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 5px;
  font-size: 12px;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  background: transparent;
  color: inherit;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
}
.form-textarea:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
.form-required {
  color: var(--oc-role-error, #dc2626);
}
.form-checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--oc-role-primary, #0d856f);
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}
.form-msg {
  font-size: 12px;
  opacity: 0.7;
}

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
.btn-danger {
  background: transparent;
  color: var(--oc-role-error, #dc2626);
  border: 1px solid var(--oc-role-error, #dc2626);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

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
.cell-actions {
  display: flex;
  gap: 4px;
}

.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(128, 128, 128, 0.1);
}
.status-running {
  color: var(--oc-role-primary, #0d856f);
}
.status-completed {
  color: var(--oc-role-primary, #0d856f);
}
.status-failed {
  color: var(--oc-role-error, #dc2626);
}
</style>
