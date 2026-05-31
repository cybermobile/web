<template>
  <div class="confluence-page">
    <div class="page-layout">
      <div
        class="compliance-sidebar bg-role-surface-container rounded-l-xl overflow-hidden flex flex-col"
      >
        <nav class="oc-sidebar-nav mt-3 px-1" aria-label="Cloud sync navigation">
          <ul class="oc-list relative">
            <li class="oc-sidebar-nav-item pb-1 px-2">
              <button type="button" :class="navLinkClass(false)" @click="openProviders">
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
                  <span class="ml-4">Providers</span>
                </span>
              </button>
            </li>
            <li class="oc-sidebar-nav-item pb-1 px-2">
              <button type="button" :class="navLinkClass(false)" @click="openSync">
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
                  <span class="ml-4">Sync</span>
                </span>
              </button>
            </li>
            <li class="oc-sidebar-nav-item pb-1 px-2" aria-current="page">
              <button type="button" :class="navLinkClass(true)" @click="openConfluenceConnections">
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
                  <span class="ml-4 font-bold">Confluence</span>
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div class="page-body">
        <div class="page-tabs" role="tablist" aria-label="Confluence views">
          <button
            type="button"
            class="page-tab"
            :class="{ active: activeTab === 'connections' }"
            @click="openConfluenceConnections"
          >
            Connections
          </button>
          <button
            type="button"
            class="page-tab"
            :class="{ active: activeTab === 'jobs' }"
            @click="openConfluenceJobs"
          >
            Import Jobs
          </button>
          <button
            type="button"
            class="page-tab"
            :class="{ active: activeTab === 'history' }"
            @click="openConfluenceHistory"
          >
            Run History
          </button>
        </div>
        <div v-if="activeTab === 'connections'"><ConnectionsTab /></div>
        <div v-if="activeTab === 'jobs'"><JobsTab /></div>
        <div v-if="activeTab === 'history'"><RunHistoryTab /></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConnectionsTab from './confluence/ConnectionsTab.vue'
import JobsTab from './confluence/JobsTab.vue'
import RunHistoryTab from './confluence/RunHistoryTab.vue'

const route = useRoute()
const router = useRouter()

const activeTab = computed<'connections' | 'jobs' | 'history'>(() => {
  if (route.path.includes('/cloud-sync/confluence/jobs')) {
    return 'jobs'
  }

  if (route.path.includes('/cloud-sync/confluence/history')) {
    return 'history'
  }

  return 'connections'
})

function openProviders() {
  void router.push('/cloud-sync/providers')
}

function openSync() {
  void router.push('/cloud-sync/sync/jobs')
}

function openConfluenceConnections() {
  void router.push('/cloud-sync/confluence/connections')
}

function openConfluenceJobs() {
  void router.push('/cloud-sync/confluence/jobs')
}

function openConfluenceHistory() {
  void router.push('/cloud-sync/confluence/history')
}

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
.confluence-page {
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

.card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.06);
}
.card-body {
  padding: 14px;
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
</style>
