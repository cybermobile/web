<template>
  <div class="connections-tab">
    <!-- Header row -->
    <div class="section-header">
      <span>Confluence Connections</span>
      <button class="btn btn-secondary btn-sm" @click="openAddDialog">+ Add Connection</button>
    </div>

    <!-- Error banner -->
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

    <!-- Connections table -->
    <div class="card">
      <div v-if="connections.length > 0" class="card-body card-body-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Base URL</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in connections" :key="c.id">
              <td class="cell-name">{{ c.name }}</td>
              <td class="cell-meta">{{ c.base_url }}</td>
              <td>
                <span class="status-badge status-ok">OK</span>
              </td>
              <td class="cell-meta">{{ formatDate(c.created_at) }}</td>
              <td class="cell-actions">
                <button
                  class="btn btn-danger btn-sm"
                  :disabled="deletingId === c.id"
                  @click="handleDelete(c.id)"
                >
                  {{ deletingId === c.id ? '...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="loading" class="card-body card-body-empty">Loading connections...</div>
      <div v-else class="card-body card-body-empty">
        No connections configured. Add one to get started.
      </div>
    </div>

    <!-- Add Connection dialog (inline card) -->
    <div v-if="showDialog" class="card dialog-card">
      <div class="card-header">
        <span>Add Connection</span>
        <button class="btn btn-secondary btn-sm" @click="closeDialog">Cancel</button>
      </div>
      <div class="card-body">
        <div class="form-row">
          <label class="form-label">Name <span class="form-required">*</span></label>
          <input
            v-model="form.name"
            class="form-input"
            placeholder="e.g. My Company Wiki"
            :disabled="saving"
          />
        </div>
        <div class="form-row">
          <label class="form-label">Base URL <span class="form-required">*</span></label>
          <input
            v-model="form.base_url"
            class="form-input"
            placeholder="https://yourcompany.atlassian.net/wiki"
            :disabled="saving"
          />
        </div>
        <div class="form-row">
          <label class="form-label">Email <span class="form-required">*</span></label>
          <input
            v-model="form.email"
            class="form-input"
            placeholder="you@yourcompany.com"
            type="email"
            :disabled="saving"
          />
        </div>
        <div class="form-row">
          <label class="form-label">API Token <span class="form-required">*</span></label>
          <input
            v-model="form.api_token"
            class="form-input"
            type="password"
            placeholder="Atlassian API token"
            :disabled="saving"
          />
          <p class="form-help">
            Generate at
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener"
              >id.atlassian.com</a
            >
          </p>
        </div>
        <div v-if="dialogError" class="error-banner" style="margin-bottom: 0">
          {{ dialogError }}
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? 'Testing & Saving...' : 'Test & Save' }}
          </button>
          <button class="btn btn-secondary" :disabled="saving" @click="closeDialog">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listConnections, createConnection, deleteConnection } from './api'
import type { Connection } from './api'

// ─── State ────────────────────────────────────────────────────────────────────

const connections = ref<Connection[]>([])
const loading = ref(false)
const errorMsg = ref('')
const deletingId = ref<string | null>(null)

const showDialog = ref(false)
const saving = ref(false)
const dialogError = ref('')

const emptyForm = () => ({ name: '', base_url: '', email: '', api_token: '' })
const form = ref(emptyForm())

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadConnections()
})

// ─── Methods ──────────────────────────────────────────────────────────────────

async function loadConnections() {
  loading.value = true
  errorMsg.value = ''
  try {
    connections.value = await listConnections()
  } catch (e: any) {
    errorMsg.value = `Failed to load connections: ${e?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

function openAddDialog() {
  form.value = emptyForm()
  dialogError.value = ''
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  dialogError.value = ''
}

async function handleSave() {
  dialogError.value = ''
  if (!form.value.name.trim()) {
    dialogError.value = 'Name is required.'
    return
  }
  if (!form.value.base_url.trim()) {
    dialogError.value = 'Base URL is required.'
    return
  }
  if (!form.value.email.trim()) {
    dialogError.value = 'Email is required.'
    return
  }
  if (!form.value.api_token.trim()) {
    dialogError.value = 'API Token is required.'
    return
  }

  saving.value = true
  try {
    await createConnection({
      name: form.value.name.trim(),
      base_url: form.value.base_url.trim(),
      email: form.value.email.trim(),
      api_token: form.value.api_token.trim()
    })
    closeDialog()
    await loadConnections()
  } catch (e: any) {
    dialogError.value = `Failed to connect: ${e?.message || 'Check your credentials and try again.'}`
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  deletingId.value = id
  errorMsg.value = ''
  try {
    await deleteConnection(id)
    await loadConnections()
  } catch (e: any) {
    errorMsg.value = `Failed to delete connection: ${e?.message || 'Unknown error'}`
  } finally {
    deletingId.value = null
  }
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped>
.connections-tab {
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

.dialog-card {
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
.form-help {
  font-size: 11px;
  opacity: 0.6;
  margin: 4px 0 0;
}
.form-help a {
  color: var(--oc-role-primary, #0d856f);
}
.form-required {
  color: var(--oc-role-error, #dc2626);
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
.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
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
}
.status-ok {
  color: var(--oc-role-primary, #0d856f);
  background: rgba(13, 133, 111, 0.1);
}
.status-error {
  color: var(--oc-role-error, #dc2626);
  background: rgba(220, 53, 69, 0.1);
}
</style>
