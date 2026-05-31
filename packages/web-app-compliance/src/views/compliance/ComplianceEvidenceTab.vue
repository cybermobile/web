<template>
  <!-- ===== EVIDENCE TAB ===== -->
  <div v-if="activeTab === 'evidence'">
    <h2 class="page-title">Evidence Library</h2>
    <p class="form-help">
      Document-centric view of all evidence referenced by gap analysis findings. Each source
      document shows which controls it provides evidence for.
    </p>

    <!-- PRD §6.2 / Milestone 8 — certificate expiry tracker -->
    <div v-if="expiringCerts && expiringCerts.total > 0" class="oc-card card expiry-card">
      <div class="oc-card-header card-header">
        <span>Certificate renewals — next {{ expiringCerts.window_days }} days</span>
        <span class="expiry-total">{{ expiringCerts.total }} tracked</span>
      </div>
      <div class="oc-card-body card-body">
        <div class="expiry-buckets">
          <div
            v-for="b in expiryBucketOrder"
            v-show="expiringCerts.buckets[b.key].length > 0"
            :key="b.key"
            class="expiry-bucket"
          >
            <div class="expiry-bucket-label" :class="'expiry-' + b.key">
              {{ b.label }} ({{ expiringCerts.buckets[b.key].length }})
            </div>
            <div v-for="cert in expiringCerts.buckets[b.key]" :key="cert.id" class="expiry-row">
              <div class="expiry-row-main">
                <strong>{{ cert.name }}</strong>
                <span v-if="cert.vessel" class="expiry-row-tag">{{ cert.vessel }}</span>
                <span v-if="cert.framework" class="expiry-row-tag">{{ cert.framework }}</span>
              </div>
              <div class="expiry-row-days" :class="'expiry-' + b.key">
                <span v-if="cert.days_left < 0">{{ Math.abs(cert.days_left) }}d overdue</span>
                <span v-else>{{ cert.days_left }}d left</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="expiringCerts" class="oc-card card">
      <div class="oc-card-body card-body card-body-empty">
        No certificates tracked yet. Add one below to start tracking renewals.
      </div>
    </div>

    <!-- Manual certificate entry (hits POST /structured/certificates/ingest) -->
    <div class="oc-card card">
      <div class="oc-card-header card-header">
        <span>Track a certificate</span>
        <button class="btn btn-sm" @click="certFormOpen = !certFormOpen">
          {{ certFormOpen ? 'Cancel' : 'Add certificate' }}
        </button>
      </div>
      <div v-if="certFormOpen" class="oc-card-body card-body">
        <div class="cert-form-grid">
          <label>
            Name
            <input
              v-model="newCert.name"
              class="form-input"
              placeholder="e.g. SOLAS Safety Certificate"
            />
          </label>
          <label>
            Vessel
            <input v-model="newCert.vessel" class="form-input" placeholder="e.g. MV Atlas" />
          </label>
          <label>
            Issuer
            <input v-model="newCert.issuer" class="form-input" placeholder="e.g. DNV, Lloyds" />
          </label>
          <label>
            Framework
            <select v-model="newCert.framework" class="form-input">
              <option value="">— unspecified —</option>
              <option v-for="fw in frameworks" :key="fw.slug" :value="fw.slug">
                {{ fw.name }}
              </option>
            </select>
          </label>
          <label>
            Issued
            <input v-model="newCert.issued_at" class="form-input" type="date" />
          </label>
          <label>
            Expires
            <input v-model="newCert.expires_at" class="form-input" type="date" />
          </label>
          <label>
            Status
            <select v-model="newCert.status" class="form-input">
              <option value="valid">Valid</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label>
            WebDAV path (optional)
            <input
              v-model="newCert.file_path"
              class="form-input"
              placeholder="/Certificates/cert-001.pdf"
            />
          </label>
          <label class="cert-form-desc">
            Upload PDF (optional — fills the path above)
            <input
              type="file"
              accept="application/pdf,.pdf"
              :disabled="certUploading"
              class="form-input cert-file-input"
              @change="uploadCertFile($event)"
            />
            <span v-if="certUploading" class="form-help" style="margin-top: 2px; display: block"
              >Uploading… {{ certUploadProgress }}%</span
            >
            <span
              v-else-if="newCert.file_path"
              class="form-help"
              style="margin-top: 2px; display: block; color: var(--oc-role-primary, #00677f)"
              >✓ {{ newCert.file_path }}</span
            >
          </label>
        </div>
        <div v-if="certSaveError" class="scan-errors">{{ certSaveError }}</div>
        <div class="edit-actions">
          <button
            class="btn btn-primary"
            :disabled="certSaving || !newCert.name.trim()"
            @click="submitCert()"
          >
            {{ certSaving ? 'Saving…' : 'Save certificate' }}
          </button>
          <button class="btn btn-secondary" :disabled="certSaving" @click="certFormOpen = false">
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Unified structured evidence form (training drills / assets / events) -->
    <div class="oc-card card">
      <div class="oc-card-header card-header">
        <span>Track structured evidence</span>
        <button class="btn btn-sm" @click="structFormOpen = !structFormOpen">
          {{ structFormOpen ? 'Cancel' : 'Add record' }}
        </button>
      </div>
      <div v-if="structFormOpen" class="oc-card-body card-body">
        <div class="form-row struct-type-row">
          <label class="form-label">Record type</label>
          <div class="struct-type-toggle">
            <button
              v-for="opt in structTypeOptions"
              :key="opt.value"
              type="button"
              class="struct-type-btn"
              :class="{ active: structType === opt.value }"
              @click="structType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Training drill fields -->
        <div v-if="structType === 'drill'" class="cert-form-grid">
          <label
            >Name<input
              v-model="newStruct.name"
              class="form-input"
              placeholder="e.g. Monthly Fire Drill"
          /></label>
          <label
            >Vessel<input v-model="newStruct.vessel" class="form-input" placeholder="e.g. MV Atlas"
          /></label>
          <label
            >Type
            <select v-model="newStruct.subtype" class="form-input">
              <option value="fire">Fire</option>
              <option value="boat">Boat / abandon ship</option>
              <option value="bridge">Bridge</option>
              <option value="security">Security</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label
            >Status
            <select v-model="newStruct.status" class="form-input">
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label
            >Scheduled<input v-model="newStruct.scheduled_at" class="form-input" type="date"
          /></label>
          <label
            >Completed<input v-model="newStruct.completed_at" class="form-input" type="date"
          /></label>
          <label
            >Participants<input
              v-model.number="newStruct.participants"
              class="form-input"
              type="number"
              min="0"
          /></label>
        </div>

        <!-- Asset fields -->
        <div v-if="structType === 'asset'" class="cert-form-grid">
          <label
            >Name<input v-model="newStruct.name" class="form-input" placeholder="e.g. Main engine"
          /></label>
          <label
            >Vessel<input v-model="newStruct.vessel" class="form-input" placeholder="e.g. MV Atlas"
          /></label>
          <label
            >Category
            <select v-model="newStruct.subtype" class="form-input">
              <option value="equipment">Equipment</option>
              <option value="system">System</option>
              <option value="document">Document</option>
              <option value="certification">Certification</option>
            </select>
          </label>
          <label
            >Status<input
              v-model="newStruct.status"
              class="form-input"
              placeholder="e.g. operational, maintenance"
          /></label>
          <label
            >Location<input
              v-model="newStruct.location"
              class="form-input"
              placeholder="e.g. Engine room, deck 2"
          /></label>
        </div>

        <!-- Event fields -->
        <div v-if="structType === 'event'" class="cert-form-grid">
          <label
            >Event type<input
              v-model="newStruct.subtype"
              class="form-input"
              placeholder="e.g. login, deviation, nonconformance"
          /></label>
          <label
            >Vessel<input v-model="newStruct.vessel" class="form-input" placeholder="e.g. MV Atlas"
          /></label>
          <label
            >Actor<input
              v-model="newStruct.actor"
              class="form-input"
              placeholder="Who logged the event"
          /></label>
          <label
            >Severity
            <select v-model="newStruct.severity" class="form-input">
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label
            >Occurred at<input
              v-model="newStruct.occurred_at"
              class="form-input"
              type="datetime-local"
          /></label>
          <label class="cert-form-desc"
            >Summary<textarea
              v-model="newStruct.summary"
              class="form-input"
              rows="2"
              placeholder="One-line description"
            ></textarea>
          </label>
        </div>

        <textarea
          v-if="structType === 'drill' || structType === 'asset'"
          v-model="newStruct.notes"
          class="form-input"
          rows="2"
          placeholder="Notes (optional)"
          style="margin-top: 10px"
        ></textarea>

        <div v-if="structSaveError" class="scan-errors">{{ structSaveError }}</div>
        <div class="edit-actions">
          <button
            class="btn btn-primary"
            :disabled="structSaving || !canSaveStruct"
            @click="submitStruct()"
          >
            {{ structSaving ? 'Saving…' : 'Save record' }}
          </button>
          <button
            class="btn btn-secondary"
            :disabled="structSaving"
            @click="structFormOpen = false"
          >
            Close
          </button>
        </div>
        <p v-if="structSavedCount > 0" class="form-help" style="margin-top: 6px">
          ✓ {{ structSavedCount }} record{{ structSavedCount === 1 ? '' : 's' }} saved this session.
        </p>
      </div>
    </div>

    <div v-if="evidenceGroups.length === 0" class="oc-card card">
      <div class="oc-card-body card-body card-body-empty">
        No evidence found. Run a gap analysis first to populate evidence.
      </div>
    </div>

    <div v-else class="evidence-library">
      <div
        v-for="group in evidenceGroups"
        :key="group.framework + '::' + group.source"
        class="oc-card evidence-group-card"
      >
        <div class="evidence-group-header">
          <a
            class="evidence-source-link evidence-group-title"
            :href="evidenceSearchLink(group.source)"
            target="_blank"
            >{{ group.source }}</a
          >
          <div class="evidence-group-meta">
            <span>{{ group.framework }}</span>
            <span>{{ group.controls.length }} controls</span>
            <span>{{ group.totalHits }} evidence hits</span>
          </div>
        </div>
        <div class="evidence-group-controls">
          <div v-for="c in group.controls" :key="c.control_id" class="evidence-control-chip">
            <span
              class="status-badge"
              :class="'status-' + c.coverage"
              style="font-size: 9px; padding: 1px 6px"
              >{{ c.coverage }}</span
            >
            <strong>{{ c.control_id }}</strong>
            <span class="evidence-control-title">{{ c.control_title }}</span>
            <span v-if="c.clause" class="evidence-control-clause">clause {{ c.clause }}</span>
            <span class="evidence-control-score">{{ c.score.toFixed(3) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== DOCUMENTS TAB (Milestone 6 — PRD §5.3 pipeline) ===== -->
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

const compliancePage = useCompliancePageContext()
const activeTab = toRef(compliancePage, 'activeTab')
const frameworks = toRef(compliancePage, 'frameworks')
const evidenceGroups = toRef(compliancePage, 'evidenceGroups')
const expiringCerts = toRef(compliancePage, 'expiringCerts')
const certFormOpen = toRef(compliancePage, 'certFormOpen')
const certSaving = toRef(compliancePage, 'certSaving')
const certSaveError = toRef(compliancePage, 'certSaveError')
const newCert = toRef(compliancePage, 'newCert')
const certUploading = toRef(compliancePage, 'certUploading')
const certUploadProgress = toRef(compliancePage, 'certUploadProgress')
const structFormOpen = toRef(compliancePage, 'structFormOpen')
const structType = toRef(compliancePage, 'structType')
const structTypeOptions = toRef(compliancePage, 'structTypeOptions')
const structSaving = toRef(compliancePage, 'structSaving')
const structSaveError = toRef(compliancePage, 'structSaveError')
const structSavedCount = toRef(compliancePage, 'structSavedCount')
const newStruct = toRef(compliancePage, 'newStruct')
const canSaveStruct = toRef(compliancePage, 'canSaveStruct')
const expiryBucketOrder = toRef(compliancePage, 'expiryBucketOrder')
const uploadCertFile = compliancePage.uploadCertFile
const evidenceSearchLink = compliancePage.evidenceSearchLink
const submitStruct = compliancePage.submitStruct
const submitCert = compliancePage.submitCert
</script>
