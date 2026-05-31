<template>
  <div class="organizer-page">
    <div class="page-body">
      <div class="page-tabs" role="tablist" aria-label="Organizer views">
        <button
          type="button"
          class="page-tab"
          :class="{ active: activeTab === 'organize' }"
          @click="activeTab = 'organize'"
        >
          Organize
        </button>
        <button
          type="button"
          class="page-tab"
          :class="{ active: activeTab === 'settings' }"
          @click="openSettingsTab"
        >
          Settings
        </button>
      </div>
      <!-- ===== ORGANIZE TAB ===== -->
      <div v-if="activeTab === 'organize'">
        <!-- Two-column layout: sources + scan -->
        <div class="organize-grid">
          <!-- Cloud Sources (from rclone providers) -->
          <div class="card">
            <div class="card-header">
              <span>Cloud Sources</span>
              <button class="btn btn-secondary btn-sm" @click="loadProviders">↻</button>
            </div>
            <div v-if="providers.length > 0" class="card-body">
              <p class="form-help" style="margin-bottom: 8px">
                Select providers to include when scanning.
              </p>
              <div class="source-list">
                <label v-for="p in providers" :key="p.id" class="source-item">
                  <input
                    v-model="selectedProviders"
                    type="checkbox"
                    :value="p.id"
                    class="form-checkbox"
                  />
                  <span class="source-name">{{ p.name }}</span>
                  <span class="source-status source-configured">{{ p.provider_type }}</span>
                </label>
              </div>
            </div>
            <div v-else class="card-body card-body-empty">
              No providers configured.
              <a href="/cloud-sync/providers" class="link">Add in Cloud Sync →</a>
            </div>
          </div>

          <!-- Scan Folder -->
          <div class="card">
            <div class="card-header">Scan Folder</div>
            <div class="card-body">
              <div class="form-row">
                <label class="form-label">Folder Path</label>
                <div class="form-row-input">
                  <input v-model="folderPath" type="text" placeholder="/" class="form-input" />
                  <button class="btn btn-primary" :disabled="scanning" @click="scanFiles">
                    {{ scanning ? 'Scanning...' : 'Scan' }}
                  </button>
                </div>
              </div>
              <div class="form-row">
                <label class="form-label form-label-inline">
                  <input v-model="recursive" type="checkbox" class="form-checkbox" />
                  Include subfolders
                </label>
              </div>
              <div class="form-row">
                <label class="form-label form-label-inline">
                  <input v-model="autoIngest" type="checkbox" class="form-checkbox" />
                  Auto-ingest into compliance corpus after organizing
                </label>
                <p class="form-help" style="margin-top: 2px">
                  Newly-organized files land in the RAG index so they're immediately searchable.
                  Skipped on dry-run.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div v-if="jobStatus" class="card">
          <div class="card-body status-row">
            <span class="status-badge" :class="'status-' + jobStatus.status">{{
              jobStatus.status
            }}</span>
            <span v-if="jobStatus.total_files > 0" class="status-text">
              {{ jobStatus.processed_files }} / {{ jobStatus.total_files }} files processed
            </span>
            <span
              v-if="jobStatus.errors && jobStatus.errors.length > 0"
              class="status-text status-text-error"
            >
              {{ jobStatus.errors.length }} error(s)
            </span>
          </div>
        </div>

        <!-- Scan results -->
        <div v-if="scanResults.length > 0" class="card">
          <div class="card-header">
            <span>{{ scanResults.length }} files found</span>
            <div class="card-header-actions">
              <button class="btn btn-secondary" :disabled="organizing" @click="organizeFiles(true)">
                {{ organizing ? 'Processing...' : 'Preview Changes' }}
              </button>
              <button
                v-if="previewReady"
                class="btn btn-primary"
                :disabled="organizing"
                @click="organizeFiles(false)"
              >
                Apply Changes
              </button>
            </div>
          </div>
          <div class="card-body card-body-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="file in scanResults" :key="file.path">
                  <td class="cell-name">{{ file.name }}</td>
                  <td class="cell-meta">{{ formatSize(file.size) }}</td>
                  <td class="cell-meta">{{ file.extension || file.content_type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Proposed changes -->
        <div v-if="organizeActions.length > 0" class="card">
          <div class="card-header">
            {{ previewReady ? 'Proposed Changes' : 'Applied Changes' }}
          </div>
          <div class="card-body card-body-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Original</th>
                  <th>Action</th>
                  <th>New Location</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="action in organizeActions" :key="action.original_path">
                  <td class="cell-name">{{ action.original_path }}</td>
                  <td>
                    <span class="action-badge" :class="'action-' + action.action">{{
                      action.action
                    }}</span>
                  </td>
                  <td class="cell-name">{{ action.new_path }}</td>
                  <td class="cell-meta cell-reason">{{ action.reason }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Errors -->
        <div v-if="errors.length > 0" class="card card-error">
          <div class="card-header">Errors</div>
          <div class="card-body">
            <ul class="error-list">
              <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ===== SETTINGS TAB ===== -->
      <div v-if="activeTab === 'settings'">
        <div v-if="settingsLoading" class="card">
          <div class="card-body">Loading settings...</div>
        </div>
        <div v-else-if="settingsError" class="card card-error">
          <div class="card-body">{{ settingsError }}</div>
        </div>
        <template v-else>
          <!-- 2-column settings grid -->
          <div class="settings-grid">
            <!-- Left column -->
            <div class="settings-col">
              <div class="card">
                <div class="card-header">General</div>
                <div class="card-body">
                  <div class="form-row">
                    <label class="form-label">Target Folder</label>
                    <p class="form-help">Where organized files go.</p>
                    <input v-model="settings.target_folder" class="form-input" />
                  </div>
                  <div class="form-row">
                    <label class="form-label">Naming Format</label>
                    <p class="form-help">How filenames are formatted.</p>
                    <select v-model="settings.naming_format" class="form-input">
                      <option value="kebab-case">kebab-case</option>
                      <option value="snake_case">snake_case</option>
                      <option value="original">Keep original</option>
                    </select>
                  </div>
                  <div class="form-row">
                    <label class="form-label form-label-inline">
                      <input v-model="settings.date_prefix" type="checkbox" class="form-checkbox" />
                      Date prefix (2026-04-08_file.md)
                    </label>
                  </div>
                  <div class="form-row">
                    <label class="form-label">Content Snippet Size</label>
                    <p class="form-help">Chars sent to AI for categorization.</p>
                    <input
                      v-model.number="settings.content_snippet_length"
                      type="number"
                      class="form-input form-input-small"
                      min="500"
                      max="10000"
                      step="500"
                    />
                  </div>
                  <div class="form-row">
                    <label class="form-label">Max File Size (bytes)</label>
                    <p class="form-help">Above this, categorize by name only.</p>
                    <input
                      v-model.number="settings.max_file_size_for_ai"
                      type="number"
                      class="form-input form-input-small"
                      min="1024"
                      step="1024"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Right column -->
            <div class="settings-col">
              <div class="card">
                <div class="card-header">AI Categories</div>
                <div class="card-body">
                  <p class="form-help">One per line. AI may suggest new ones.</p>
                  <textarea
                    v-model="categoriesText"
                    class="form-textarea"
                    rows="8"
                    placeholder="Documents&#10;Finance&#10;Projects&#10;Images"
                  ></textarea>
                </div>
              </div>

              <div class="card">
                <div class="card-header">Cleanup Patterns</div>
                <div class="card-body">
                  <p class="form-help">Regex patterns stripped from filenames. One per line.</p>
                  <textarea
                    v-model="junkPatternsText"
                    class="form-textarea"
                    rows="6"
                    placeholder="\s*\(\d+\)\s*&#10;Copy\s+of\s+"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-footer">
            <button class="btn btn-primary" :disabled="settingsSaving" @click="saveSettings">
              {{ settingsSaving ? 'Saving...' : 'Save Settings' }}
            </button>
            <span v-if="settingsSaved" class="save-confirm">Settings saved</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAiToolsServiceUrl } from '@opencloud-eu/web-pkg'
import { getOpenCloudAccessToken } from '@opencloud-eu/web-pkg'

const ORGANIZER_URL = getAiToolsServiceUrl('agent')

const activeTab = ref<'organize' | 'settings'>('organize')

function openSettingsTab() {
  activeTab.value = 'settings'
  loadSettings()
}
const folderPath = ref('/')
const recursive = ref(true)
const autoIngest = ref(false)
const scanning = ref(false)
const organizing = ref(false)
const previewReady = ref(false)
const scanResults = ref<any[]>([])
const organizeActions = ref<any[]>([])
const jobStatus = ref<any>(null)
const errors = ref<string[]>([])

// Cloud sources from rclone manager
const RCLONE_URL = getAiToolsServiceUrl('rclone')
const providers = ref<any[]>([])
const selectedProviders = ref<string[]>([])

async function loadProviders() {
  try {
    const resp = await fetch(`${RCLONE_URL}/api/providers`)
    const data = await resp.json()
    providers.value = data.providers || []
  } catch {
    /* rclone service not reachable */
  }
}

const settings = ref<any>({
  target_folder: '/Organized',
  date_prefix: true,
  naming_format: 'kebab-case',
  junk_patterns: [],
  custom_categories: [],
  max_file_size_for_ai: 1048576,
  content_snippet_length: 2000,
  custom_rules: []
})
const settingsLoading = ref(false)
const settingsError = ref('')
const settingsSaving = ref(false)
const settingsSaved = ref(false)

const categoriesText = computed({
  get: () => (settings.value.custom_categories || []).join('\n'),
  set: (val: string) => {
    settings.value.custom_categories = val
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)
  }
})

const junkPatternsText = computed({
  get: () => (settings.value.junk_patterns || []).join('\n'),
  set: (val: string) => {
    settings.value.junk_patterns = val
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)
  }
})

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

async function scanFiles() {
  const token = getOpenCloudAccessToken()
  if (!token) {
    errors.value = ['No access token found. Please log in.']
    return
  }
  scanning.value = true
  scanResults.value = []
  organizeActions.value = []
  previewReady.value = false
  errors.value = []
  try {
    const resp = await fetch(`${ORGANIZER_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_path: folderPath.value,
        access_token: token,
        recursive: recursive.value
      })
    })
    const data = await resp.json()
    scanResults.value = data.files || []
  } catch {
    errors.value = ['Failed to connect to organizer service.']
  } finally {
    scanning.value = false
  }
}

async function organizeFiles(dryRun: boolean) {
  const token = getOpenCloudAccessToken()
  if (!token) {
    errors.value = ['No access token found.']
    return
  }
  organizing.value = true
  organizeActions.value = []
  errors.value = []
  jobStatus.value = null
  try {
    const resp = await fetch(`${ORGANIZER_URL}/api/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_path: folderPath.value,
        access_token: token,
        dry_run: dryRun,
        recursive: recursive.value,
        auto_ingest: autoIngest.value && !dryRun
      })
    })
    const data = await resp.json()
    const jobId = data.job_id
    let done = false
    while (!done) {
      await new Promise((r) => setTimeout(r, 1500))
      const statusResp = await fetch(`${ORGANIZER_URL}/api/status/${jobId}`)
      const status = await statusResp.json()
      jobStatus.value = status
      if (status.status === 'completed' || status.status === 'failed') {
        done = true
        organizeActions.value = status.actions || []
        errors.value = status.errors || []
        previewReady.value = dryRun && status.status === 'completed'
      }
    }
  } catch {
    errors.value = ['Failed to connect to organizer service.']
  } finally {
    organizing.value = false
  }
}

async function loadSettings() {
  settingsLoading.value = true
  settingsError.value = ''
  try {
    const resp = await fetch(`${ORGANIZER_URL}/api/rules`)
    if (!resp.ok) throw new Error('Failed to load')
    settings.value = await resp.json()
  } catch {
    settingsError.value = 'Failed to load settings. Is the organizer service running?'
  } finally {
    settingsLoading.value = false
  }
}

async function saveSettings() {
  settingsSaving.value = true
  settingsSaved.value = false
  try {
    await fetch(`${ORGANIZER_URL}/api/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings.value)
    })
    settingsSaved.value = true
    setTimeout(() => {
      settingsSaved.value = false
    }, 3000)
  } catch {
    settingsError.value = 'Failed to save settings.'
  } finally {
    settingsSaving.value = false
  }
}

onMounted(() => {
  loadProviders()
})
</script>

<style scoped>
.organizer-page {
  height: 100%;
  overflow: hidden;
  color: var(--oc-role-on-surface, #191c1d);
}
.page-body {
  height: 100%;
  overflow-y: auto;
  padding: 4px 16px 40px;
  background: var(--oc-role-surface, #fff);
  border: 1px solid var(--oc-role-outline-variant, #eceef0);
  border-radius: 10.5px 0 0 10.5px;
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

/* Grids */
.organize-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.settings-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 768px) {
  .organize-grid,
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

/* Cards */
.card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.06);
}
.card-error {
  border-color: var(--oc-role-error, #dc2626);
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
.card-header-actions {
  display: flex;
  gap: 8px;
}
.card-body {
  padding: 14px;
}
.card-body-empty {
  padding: 20px 14px;
  text-align: center;
  opacity: 0.5;
  font-size: 13px;
}
.link {
  color: var(--oc-role-primary, var(--oc-role-primary, #00677f));
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.card-body-table {
  padding: 0;
}

/* Cloud sources */
.source-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}
.source-item:hover {
  background: rgba(128, 128, 128, 0.08);
}
.source-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}
.source-name {
  flex: 1;
  font-weight: 500;
}
.source-status {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 3px;
}
.source-configured {
  color: var(--oc-role-primary, #0d856f);
  background: rgba(13, 133, 111, 0.1);
}
.source-unconfigured {
  opacity: 0.4;
}

/* Forms */
.form-row {
  margin-bottom: 16px;
}
.form-row:last-child {
  margin-bottom: 0;
}
.form-row-input {
  display: flex;
  gap: 8px;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}
.form-label-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-help {
  font-size: 12px;
  opacity: 0.5;
  margin: 0 0 6px;
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
select.form-input {
  background-color: var(--oc-role-surface, transparent);
}
select.form-input option {
  background-color: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #191c1d);
}
.form-input:focus {
  border-color: var(--oc-role-primary, #0d856f);
  box-shadow: 0 0 0 2px rgba(13, 133, 111, 0.15);
}
.form-input-small {
  max-width: 140px;
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

.form-checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--oc-role-primary, #0d856f);
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

/* Status */
.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(128, 128, 128, 0.1);
}
.status-scanning,
.status-categorizing,
.status-completed {
  color: var(--oc-role-primary, #0d856f);
}
.status-failed {
  color: var(--oc-role-error, #dc2626);
}
.status-text {
  font-size: 13px;
  opacity: 0.6;
}
.status-text-error {
  color: var(--oc-role-error, #dc2626);
  opacity: 1;
}

/* Data table */
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
  word-break: break-all;
}
.cell-meta {
  opacity: 0.6;
  white-space: nowrap;
}
.cell-reason {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.action-move {
  background: var(--oc-role-primary, #0d856f);
  color: #fff;
}
.action-skip {
  background: rgba(128, 128, 128, 0.1);
  opacity: 0.5;
}

/* Errors */
.error-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--oc-role-error, #dc2626);
}
.card-error .card-header {
  color: var(--oc-role-error, #dc2626);
}

/* Settings footer */
.settings-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
}
.save-confirm {
  color: var(--oc-role-primary, #0d856f);
  font-size: 13px;
  font-weight: 500;
}
</style>
