<template>
  <div class="compliance-page">
    <div class="page-layout">
      <ComplianceNavigation />

      <div class="page-body">
        <ComplianceDashboardTab v-if="compliancePage.activeTab === 'dashboard'" />
        <ComplianceFrameworksTab v-if="compliancePage.activeTab === 'frameworks'" />
        <ComplianceAuditTab v-if="compliancePage.activeTab === 'audit'" />
        <ComplianceFindingsTab v-if="compliancePage.activeTab === 'findings'" />
        <ComplianceEvidenceTab v-if="compliancePage.activeTab === 'evidence'" />
        <ComplianceDocumentsTab v-if="compliancePage.activeTab === 'documents'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createCompliancePage, provideCompliancePage } from '../composables/useCompliancePage'
import ComplianceAuditTab from './compliance/ComplianceAuditTab.vue'
import ComplianceDashboardTab from './compliance/ComplianceDashboardTab.vue'
import ComplianceDocumentsTab from './compliance/ComplianceDocumentsTab.vue'
import ComplianceEvidenceTab from './compliance/ComplianceEvidenceTab.vue'
import ComplianceFindingsTab from './compliance/ComplianceFindingsTab.vue'
import ComplianceFrameworksTab from './compliance/ComplianceFrameworksTab.vue'
import ComplianceNavigation from './compliance/ComplianceNavigation.vue'

const compliancePage = createCompliancePage()
provideCompliancePage(compliancePage)
</script>

<style src="./compliance/CompliancePage.css"></style>
