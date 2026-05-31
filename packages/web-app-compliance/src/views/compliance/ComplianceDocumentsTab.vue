<template>
  <div v-if="activeTab === 'documents'">
    <h2 class="page-title">
      Document Pipeline
      <span class="page-title-sub">— request → research → context → draft → review</span>
    </h2>
    <p class="form-help">
      Draft procedures and policies with the AI agent grounded in the ingested compliance corpus.
      Each document walks through five stages — context assembly and review are approval gates.
    </p>

    <!-- New document form (collapsed by default) -->
    <div class="oc-card card">
      <div class="oc-card-header card-header">
        <span>New document</span>
        <button class="btn btn-sm" @click="newDocOpen = !newDocOpen">
          {{ newDocOpen ? 'Cancel' : 'Request new document' }}
        </button>
      </div>
      <div v-if="newDocOpen" class="oc-card-body card-body">
        <div class="doc-form-grid">
          <label>
            Title
            <input
              v-model="newDoc.title"
              class="form-input"
              placeholder="e.g. Ballast Water Management Procedure"
            />
          </label>
          <label>
            Framework
            <select v-model="newDoc.framework" class="form-input">
              <option value="">— unspecified —</option>
              <option v-for="fw in frameworks" :key="fw.slug" :value="fw.slug">
                {{ fw.name }}
              </option>
            </select>
          </label>
          <label>
            Control ID
            <input v-model="newDoc.control_id" class="form-input" placeholder="e.g. 10.1" />
          </label>
          <label class="doc-form-desc">
            Description
            <textarea
              v-model="newDoc.description"
              class="form-input"
              rows="3"
              placeholder="What should this procedure cover? Which operations or assets does it apply to?"
            ></textarea>
          </label>
        </div>
        <div class="doc-form-actions">
          <button
            class="btn btn-primary"
            :disabled="!newDoc.title.trim() || creatingDoc"
            @click="createDoc()"
          >
            {{ creatingDoc ? 'Creating…' : 'Create request' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state: no documents at all. Replaces a visually
               empty Kanban with a helpful CTA pointing at the likely
               entry points (new-document form above, or the findings
               tab's Draft-procedure button). -->
    <div v-if="documents.length === 0" class="oc-card empty-state-card">
      <div class="empty-state-icon" aria-hidden="true">📝</div>
      <div class="empty-state-title">No draft procedures yet</div>
      <div class="empty-state-body">
        Draft procedures grounded in your ingested corpus using the
        <strong>Request new document</strong> form above, or click
        <strong>Draft procedure</strong> on any finding from the Findings tab.
      </div>
      <div class="empty-state-actions">
        <button class="btn btn-primary btn-sm" @click="newDocOpen = true">
          Request new document
        </button>
        <button class="btn btn-secondary btn-sm" @click="openFindingsTab">Go to Findings</button>
      </div>
    </div>

    <!-- Kanban columns -->
    <div v-else class="doc-kanban">
      <div v-for="col in documentColumns" :key="col.stage" class="doc-column">
        <div class="doc-column-header" :class="'stage-' + col.stage">
          {{ col.label }}
          <span class="doc-column-count">{{ col.docs.length }}</span>
        </div>
        <div v-if="col.docs.length === 0" class="doc-column-empty">—</div>
        <div v-for="d in col.docs" :key="d.id" class="oc-card doc-card" @click="openDoc(d)">
          <div class="doc-card-title">{{ d.title }}</div>
          <div class="doc-card-meta">
            <span v-if="d.framework" class="doc-card-tag">{{ d.framework }}</span>
            <span v-if="d.control_id" class="doc-card-tag">{{ d.control_id }}</span>
          </div>
          <div v-if="d.description" class="doc-card-desc">{{ d.description }}</div>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="activeDoc" class="edit-overlay" @click.self="closeDocModal">
      <div class="edit-modal doc-panel">
        <!-- Header + stage row stay fixed at the top; the middle is a
                   scrollable body so long drafts/histories don't push the
                   action buttons below the viewport. -->
        <div class="doc-panel-head">
          <div class="edit-header">
            <h3>{{ activeDoc.title }}</h3>
            <button class="btn-close" @click="closeDocModal">×</button>
          </div>
          <div class="doc-stage-row">
            <span class="status-badge" :class="'stage-badge-' + activeDoc.stage">{{
              activeDoc.stage.replace('_', ' ')
            }}</span>
            <span v-if="activeDoc.framework" class="doc-card-tag">{{ activeDoc.framework }}</span>
            <span v-if="activeDoc.control_id" class="doc-card-tag">{{ activeDoc.control_id }}</span>
            <a
              v-if="activeDoc.file_path"
              :href="fileLinkFor(activeDoc.file_path)"
              target="_blank"
              class="doc-file-link"
              title="Open the saved procedure in Cloudbase"
              >📄 {{ activeDoc.file_path }}</a
            >
            <span
              v-else-if="activeDoc.stage === 'approved' && activeDoc.persistence_error"
              class="doc-file-error"
              :title="activeDoc.persistence_error"
              >⚠ {{ activeDoc.persistence_error }}</span
            >
            <span v-else-if="activeDoc.stage === 'approved'" class="doc-file-pending"
              >writing to Cloudbase…</span
            >
          </div>
          <div v-if="docError" class="doc-inline-error">{{ docError }}</div>
        </div>

        <div class="doc-panel-body">
          <div v-if="activeDoc.description" class="doc-section">
            <div class="doc-section-label">Request</div>
            <div class="doc-section-body">{{ activeDoc.description }}</div>
          </div>

          <div v-if="activeDoc.research_hits.length > 0" class="doc-section">
            <div class="doc-section-label">
              Retrieved context ({{ activeDoc.research_hits.length }} hits)
            </div>
            <ul class="doc-hits">
              <li v-for="h in activeDoc.research_hits" :key="h.node_id">
                <strong>{{ h.clause || 'n/a' }}</strong>
                <span class="doc-hits-source">{{ h.source }}</span>
                <span class="doc-hits-score">{{ h.score.toFixed(3) }}</span>
                <div class="doc-hits-text">
                  {{ h.text.slice(0, 280) }}{{ h.text.length > 280 ? '…' : '' }}
                </div>
              </li>
            </ul>
          </div>

          <!-- Draft section. Three states:
                     1. Streaming in from /draft/stream SSE (draftStream.active) —
                        render a typewriter via StreamingText with cursor.
                     2. Persisted draft present (activeDoc.draft) — static render.
                     3. Stage is 'draft' but we haven't received any tokens yet —
                        show a "drafting…" indicator.
                -->
          <div
            v-if="draftStream.active || activeDoc.draft || activeDoc.stage === 'draft'"
            class="doc-section"
          >
            <div class="doc-section-label doc-section-label-row">
              <span>
                Draft
                <span v-if="draftStream.active" class="doc-draft-live">● streaming live</span>
              </span>
              <button
                v-if="activeDoc.draft || draftStream.text"
                type="button"
                class="doc-expand-btn"
                @click="draftExpanded = !draftExpanded"
              >
                {{ draftExpanded ? 'Collapse' : 'Expand ▸' }}
              </button>
            </div>
            <div v-if="!draftExpanded" class="doc-draft">
              <!-- Streaming (typewriter + cursor + markdown) vs
                         persisted (static + markdown). Both render
                         markdown so tables/headers/lists look right. -->
              <StreamingText
                v-if="draftStream.active"
                :text="draftStream.text"
                :cursor="true"
                :cursor-idle-blink="true"
                :markdown="true"
              />
              <StreamingText
                v-else-if="activeDoc.draft"
                :text="activeDoc.draft"
                :animate="false"
                :markdown="true"
              />
              <span v-else class="doc-draft-pending">Drafting… waiting for the first token</span>
            </div>
            <div v-else class="doc-draft-collapsed-hint">Draft opened in side panel →</div>
          </div>

          <div v-if="activeDoc.history.length > 0" class="doc-section">
            <div class="doc-section-label">History</div>
            <ul class="doc-history">
              <li v-for="(h, i) in activeDoc.history" :key="i">
                <span class="doc-history-stage">{{ h.stage }}</span>
                <span class="doc-history-time">{{ new Date(h.entered_at).toLocaleString() }}</span>
                <span v-if="h.note" class="doc-history-note">{{ h.note }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="edit-actions doc-actions">
          <button
            v-if="canAdvance(activeDoc)"
            class="btn btn-primary"
            :disabled="advancing"
            @click="advanceDoc(activeDoc)"
          >
            {{ advancing ? 'Working…' : nextActionLabel(activeDoc) }}
          </button>
          <button
            v-if="canRegenerateDraft(activeDoc)"
            class="btn"
            :disabled="advancing"
            @click="regenerateDraft(activeDoc)"
          >
            Regenerate draft
          </button>
          <button
            v-if="canReject(activeDoc)"
            class="btn btn-secondary"
            :disabled="advancing"
            @click="rejectDoc(activeDoc)"
          >
            Reject
          </button>
          <button class="btn btn-secondary" @click="deleteDoc(activeDoc)">Delete</button>
        </div>
      </div>

      <!-- Side panel: full-width draft view. Lives outside .edit-modal
                 so it can use its own width without inheriting the 720px cap.
                 Shows the live stream when active, falls back to the
                 persisted draft otherwise. -->
      <div
        v-if="draftExpanded && (activeDoc.draft || draftStream.active)"
        class="doc-draft-side"
        @click.stop
      >
        <div class="doc-draft-side-head">
          <h3>
            Draft — full view<span v-if="draftStream.active" class="doc-draft-live">● live</span>
          </h3>
          <button class="btn-close" @click="draftExpanded = false">×</button>
        </div>
        <div class="doc-draft doc-draft-full">
          <StreamingText
            v-if="draftStream.active"
            :text="draftStream.text"
            :cursor="true"
            :cursor-idle-blink="true"
            :markdown="true"
          />
          <StreamingText v-else :text="activeDoc.draft" :animate="false" :markdown="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'
import StreamingText from '../../components/chat/StreamingText.vue'

const compliancePage = useCompliancePageContext()
const activeTab = toRef(compliancePage, 'activeTab')
const frameworks = toRef(compliancePage, 'frameworks')
const documents = toRef(compliancePage, 'documents')
const activeDoc = toRef(compliancePage, 'activeDoc')
const draftExpanded = toRef(compliancePage, 'draftExpanded')
const newDocOpen = toRef(compliancePage, 'newDocOpen')
const newDoc = toRef(compliancePage, 'newDoc')
const creatingDoc = toRef(compliancePage, 'creatingDoc')
const advancing = toRef(compliancePage, 'advancing')
const docError = toRef(compliancePage, 'docError')
const documentColumns = toRef(compliancePage, 'documentColumns')
const draftStream = toRef(compliancePage, 'draftStream')
const openFindingsTab = compliancePage.openFindingsTab
const createDoc = compliancePage.createDoc
const closeDocModal = compliancePage.closeDocModal
const openDoc = compliancePage.openDoc
const advanceDoc = compliancePage.advanceDoc
const rejectDoc = compliancePage.rejectDoc
const regenerateDraft = compliancePage.regenerateDraft
const deleteDoc = compliancePage.deleteDoc
const canAdvance = compliancePage.canAdvance
const canRegenerateDraft = compliancePage.canRegenerateDraft
const canReject = compliancePage.canReject
const nextActionLabel = compliancePage.nextActionLabel
const fileLinkFor = compliancePage.fileLinkFor
</script>
