# Compliance Page Decomposition Plan

## Goal

Turn `packages/web-app-compliance/src/views/CompliancePage.vue` from a single large migrated page into a small route shell with owned tab components, shared page state, and scoped external styles.

## Boundary Decision

Keep Compliance as `web-app-compliance` instead of moving it into `web-app-admin-settings`.

The page contains operational compliance workflows: framework evidence intake, audit prep, finding remediation, evidence review, and document drafting. Those are not OpenCloud tenant/system administration screens. Admin Settings is still the right comparison for layout patterns, but not the ownership boundary.

## Cleanup Sequence

1. Extract page state, API calls, computed values, and actions into `src/composables/useCompliancePage.ts`.
2. Provide the page state through a typed injection context so tab components can keep the existing bindings without prop drilling.
3. Split the old template into:
   - `views/compliance/ComplianceNavigation.vue`
   - `views/compliance/ComplianceDashboardTab.vue`
   - `views/compliance/ComplianceFrameworksTab.vue`
   - `views/compliance/ComplianceAuditTab.vue`
   - `views/compliance/ComplianceFindingsTab.vue`
   - `views/compliance/ComplianceEvidenceTab.vue`
   - `views/compliance/ComplianceDocumentsTab.vue`
4. Replace `CompliancePage.vue` with a route shell that wires state, context, navigation, and the active tab component.
5. Move scoped styles to `views/compliance/CompliancePage.css` using Vue's scoped `src` support.
6. Run formatting, targeted typecheck/lint, build, and unit verification.

## Constraints

- Preserve the current backend contract and routes.
- Preserve old legacy redirects in `web-app-ai-tools`.
- Do not move backend, compose, framework JSON, or agent code into `opencloud-web`.
- Avoid broader design-system rewrites in the same pass; component extraction is the behavior-preserving cleanup.
