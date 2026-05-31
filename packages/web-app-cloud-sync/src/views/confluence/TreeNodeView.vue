<template>
  <div class="tree-node">
    <!-- Node row -->
    <div
      class="node-row"
      :class="{ 'node-selected': node.id === selectedId }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleRowClick"
    >
      <!-- Expand toggle -->
      <span
        v-if="node.has_children"
        class="expand-toggle"
        :title="expanded ? 'Collapse' : 'Expand'"
        @click.stop="toggleExpand"
      >
        <span v-if="loadingChildren" class="spinner"></span>
        <span v-else class="arrow" :class="{ 'arrow-expanded': expanded }">&#9654;</span>
      </span>
      <span v-else class="expand-toggle expand-spacer"></span>

      <!-- Page icon -->
      <span class="page-icon">&#128196;</span>

      <!-- Title -->
      <span class="node-title">{{ node.title }}</span>

      <!-- Selected badge -->
      <span v-if="node.id === selectedId" class="selected-badge">Selected</span>

      <!-- Select button (only shown when not selected) -->
      <button
        v-if="node.id !== selectedId"
        class="btn btn-xs btn-ghost select-btn"
        title="Select this page as subtree root"
        @click.stop="emit('select', node)"
      >
        Select
      </button>

      <!-- Deselect button (only shown when selected) -->
      <button
        v-else
        class="btn btn-xs btn-ghost deselect-btn"
        title="Deselect"
        @click.stop="emit('deselect')"
      >
        &#10005;
      </button>
    </div>

    <!-- Fetch error -->
    <div v-if="fetchError" class="node-error" :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }">
      Failed to load children. <button class="btn-link" @click="loadChildren">Retry</button>
    </div>

    <!-- Children -->
    <div v-if="expanded && !loadingChildren && !fetchError">
      <TreeNodeView
        v-for="child in children"
        :key="child.id"
        :node="child"
        :connection-id="connectionId"
        :selected-id="selectedId"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @deselect="emit('deselect')"
      />
      <div
        v-if="children.length === 0"
        class="node-empty"
        :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
      >
        No child pages
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { listTree } from './api'
import type { TreeNode } from './api'

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    node: TreeNode
    connectionId: string
    selectedId: string | null
    depth?: number
  }>(),
  { depth: 0 }
)

const emit = defineEmits<{
  (e: 'select', node: TreeNode): void
  (e: 'deselect'): void
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const expanded = ref(false)
const loadingChildren = ref(false)
const fetchError = ref(false)
const children = ref<TreeNode[]>([])
const childrenLoaded = ref(false)

// ─── Methods ──────────────────────────────────────────────────────────────────

async function loadChildren() {
  loadingChildren.value = true
  fetchError.value = false
  try {
    children.value = await listTree(props.connectionId, props.node.id)
    childrenLoaded.value = true
  } catch {
    fetchError.value = true
  } finally {
    loadingChildren.value = false
  }
}

async function toggleExpand() {
  if (!expanded.value) {
    expanded.value = true
    if (!childrenLoaded.value) {
      await loadChildren()
    }
  } else {
    expanded.value = false
  }
}

function handleRowClick() {
  if (props.node.id === props.selectedId) {
    emit('deselect')
  } else {
    emit('select', props.node)
  }
}
</script>

<style scoped>
.tree-node {
  font-size: 13px;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
}
.node-row:hover {
  background: rgba(128, 128, 128, 0.08);
}
.node-selected {
  background: rgba(13, 133, 111, 0.12);
}
.node-selected:hover {
  background: rgba(13, 133, 111, 0.18);
}

.expand-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 3px;
  color: inherit;
  opacity: 0.6;
}
.expand-toggle:hover {
  opacity: 1;
  background: rgba(128, 128, 128, 0.12);
}
.expand-spacer {
  cursor: default;
  pointer-events: none;
}

.arrow {
  display: inline-block;
  font-size: 9px;
  transition: transform 0.15s ease;
}
.arrow-expanded {
  transform: rotate(90deg);
}

.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
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

.page-icon {
  font-size: 12px;
  flex-shrink: 0;
  opacity: 0.5;
}

.node-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--oc-role-primary, #0d856f);
  background: rgba(13, 133, 111, 0.12);
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
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
.btn-xs {
  font-size: 11px;
  padding: 2px 7px;
}
.btn-ghost {
  background: transparent;
  color: inherit;
  border: 1px solid rgba(128, 128, 128, 0.3);
  opacity: 0;
}
.node-row:hover .btn-ghost {
  opacity: 1;
}
.btn-ghost:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.1);
  opacity: 1;
}

.select-btn {
  color: var(--oc-role-primary, #0d856f);
  border-color: rgba(13, 133, 111, 0.4);
}
.deselect-btn {
  color: rgba(128, 128, 128, 0.7);
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--oc-role-primary, #0d856f);
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.node-error {
  font-size: 12px;
  color: var(--oc-role-error, #dc2626);
  padding: 4px 8px;
  opacity: 0.8;
}

.node-empty {
  font-size: 12px;
  opacity: 0.4;
  padding: 4px 8px;
  font-style: italic;
}
</style>
