<template>
  <div
    class="compliance-sidebar bg-role-surface-container rounded-l-xl overflow-hidden flex flex-col"
  >
    <nav class="oc-sidebar-nav mt-3 px-1" aria-label="Compliance navigation">
      <ul class="oc-list relative">
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'dashboard' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'dashboard')"
            @click="activeTab = 'dashboard'"
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
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'dashboard' }"
                >Dashboard</span
              >
            </span>
          </button>
        </li>
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'frameworks' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'frameworks')"
            @click="openFrameworksTab"
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
                  <path d="M2 3h20v6H2z"></path>
                  <path d="M2 15h20v6H2z"></path>
                  <path d="M6 9v6"></path>
                  <path d="M18 9v6"></path></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'frameworks' }"
                >Frameworks</span
              >
            </span>
            <span v-if="frameworksMissingCount > 0" class="nav-badge">{{
              frameworksMissingCount
            }}</span>
          </button>
        </li>
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'audit' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'audit')"
            @click="activeTab = 'audit'"
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
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'audit' }">Audit Prep</span>
            </span>
          </button>
        </li>
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'findings' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'findings')"
            @click="openFindingsTab"
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'findings' }">Findings</span>
            </span>
            <span v-if="findingsCount.open > 0" class="nav-badge">{{ findingsCount.open }}</span>
          </button>
        </li>
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'evidence' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'evidence')"
            @click="openEvidenceTab"
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'evidence' }">Evidence</span>
            </span>
          </button>
        </li>
        <li
          class="oc-sidebar-nav-item pb-1 px-2"
          :aria-current="activeTab === 'documents' ? 'page' : undefined"
        >
          <button
            type="button"
            :class="navLinkClass(activeTab === 'documents')"
            @click="openDocumentsTab"
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line></svg
              ></span>
              <span class="ml-4" :class="{ 'font-bold': activeTab === 'documents' }"
                >Documents</span
              >
            </span>
            <span v-if="documentsOpenCount > 0" class="nav-badge">{{ documentsOpenCount }}</span>
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCompliancePageContext } from '../../composables/useCompliancePage'

const compliancePage = useCompliancePageContext()
const activeTab = toRef(compliancePage, 'activeTab')
const frameworksMissingCount = toRef(compliancePage, 'frameworksMissingCount')
const findingsCount = toRef(compliancePage, 'findingsCount')
const documentsOpenCount = toRef(compliancePage, 'documentsOpenCount')
const openFrameworksTab = compliancePage.openFrameworksTab
const openFindingsTab = compliancePage.openFindingsTab
const openEvidenceTab = compliancePage.openEvidenceTab
const openDocumentsTab = compliancePage.openDocumentsTab
const navLinkClass = compliancePage.navLinkClass
</script>
