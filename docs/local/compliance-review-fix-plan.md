# Compliance Review Fix Plan

## Goal

Close the review findings from the split Compliance app without changing backend contracts or moving compose/backend code into `opencloud-web`.

## Fixes

1. Make Compliance styles apply to extracted tab components by loading the stylesheet globally and prefixing selectors under `.compliance-page`.
2. Document that `opencloud-compose/config/opencloud/web.local.json` is a default local-domain config for `cloud.opencloud.test` and matching AI service hostnames.
3. Split the largest Compliance behavior clusters out of `useCompliancePage.ts` into reusable domain helpers:
   - `useComplianceFrameworks`
   - `useComplianceDocuments`
   - `useComplianceEvidence`
   - `useComplianceFindings`
4. Tighten OpenCloud access-token lookup so it prefers the current configured OpenCloud server/session before falling back to older storage shapes.

## Verification

- Run `pnpm check:types`.
- Run targeted ESLint on touched Compliance and `web-pkg` files.
- Run `pnpm format:check`.
- Run `pnpm build`.
- Run unit tests if the code-level verification passes.
