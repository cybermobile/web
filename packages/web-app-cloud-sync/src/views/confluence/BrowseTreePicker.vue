<template>
  <div class="browse-tree-picker">
    <!-- Selected summary bar -->
    <div v-if="modelValue" class="selection-bar">
      <span class="selection-label">Selected page ID:</span>
      <span class="selection-value">{{ modelValue }}</span>
      <button class="btn btn-xs btn-danger" @click="emit('update:modelValue', null)">Clear</button>
    </div>

    <!-- Tree container -->
    <div class="tree-container">
      <!-- Loading state -->
      <div v-if="loading" class="tree-status">
        <span class="spinner"></span>
        <span>Loading pages&hellip;</span>
      </div>

      <!-- Error state -->
      <div v-else-if="errorMsg" class="tree-error">
        {{ errorMsg }}
        <button class="btn-link" @click="loadRoot">Retry</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="rootNodes.length === 0" class="tree-status tree-empty">
        No pages found in this space.
      </div>

      <!-- Tree nodes -->
      <div v-else class="tree-scroll">
        <TreeNodeView
          v-for="node in rootNodes"
          :key="node.id"
          :node="node"
          :connection-id="connectionId"
          :selected-id="modelValue"
          :depth="0"
          @select="handleSelect"
          @deselect="emit('update:modelValue', null)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { listTree } from './api'
import type { TreeNode } from './api'
import TreeNodeView from './TreeNodeView.vue'

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  connectionId: string
  spaceKey: string
  modelValue: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const rootNodes = ref<TreeNode[]>([])
const loading = ref(false)
const errorMsg = ref('')

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadRoot()
})

watch(
  () => props.spaceKey,
  () => {
    loadRoot()
  }
)

// ─── Methods ──────────────────────────────────────────────────────────────────

async function loadRoot() {
  loading.value = true
  errorMsg.value = ''
  rootNodes.value = []
  try {
    rootNodes.value = await listTree(props.connectionId, props.spaceKey)
  } catch (e: any) {
    errorMsg.value = `Failed to load pages: ${e?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

function handleSelect(node: TreeNode) {
  emit('update:modelValue', node.id)
}
</script>

<style scoped>
.browse-tree-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Selection summary */
.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(13, 133, 111, 0.08);
  border: 1px solid rgba(13, 133, 111, 0.2);
  border-radius: 6px;
  font-size: 12px;
}
.selection-label {
  opacity: 0.6;
}
.selection-value {
  font-family: monospace;
  font-size: 11px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--oc-role-primary, #0d856f);
}

/* Tree container */
.tree-container {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.04);
  overflow: hidden;
}

.tree-scroll {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

/* Status / empty / error states */
.tree-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 14px;
  font-size: 13px;
  opacity: 0.55;
}
.tree-empty {
  font-style: italic;
}

.tree-error {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--oc-role-error, #dc2626);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Shared helpers */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(128, 128, 128, 0.3);
  border-top-color: var(--oc-role-primary, #0d856f);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn {
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 3px 8px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn:hover:not(:disabled) {
  opacity: 0.85;
}
.btn-xs {
  font-size: 11px;
  padding: 2px 7px;
}
.btn-danger {
  background: transparent;
  color: var(--oc-role-error, #dc2626);
  border: 1px solid var(--oc-role-error, #dc2626);
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--oc-role-primary, #0d856f);
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
}
</style>
