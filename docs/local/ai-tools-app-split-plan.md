# AI Tools App Split Plan

## Goal

Split the temporary `web-app-ai-tools` migration package into smaller OpenCloud app packages while preserving the working migrated behavior.

## Package Boundaries

- `web-app-ai-chat`: global chat panel/widget and optional full chat route.
- `web-app-compliance`: compliance dashboard, frameworks, audit prep, findings, evidence, and documents.
- `web-app-files`: file organizer workflow and settings under Files.
- `web-app-cloud-sync`: rclone/cloud-sync providers, jobs, history, and Confluence importer sources.
- `web-app-confluence`: compatibility redirect for old Confluence URLs.
- `web-app-file-organizer`: compatibility redirect for old File Organizer URLs.
- `web-app-ai-tools`: compatibility-only shell for old `/ai-tools/...` URLs.

## Cleanup Sequence

1. Keep existing behavior protected by the current passing build, typecheck, lint, and unit suite.
2. Move common service URL and access-token helpers into `web-pkg` so split apps do not import each other.
3. Create the new app packages with isolated package metadata and l10n scaffolds.
4. Move each migrated page into its owning app package and update imports.
5. Replace old `/ai-tools/...` routes with redirects to the new app ids.
6. Extract Compliance route state and API URL helpers out of the large view before deeper component splitting.
7. Verify with `pnpm install`, `pnpm check:types`, `pnpm lint`, `pnpm format:check`, `pnpm build`, and unit tests.

## Constraints

- Do not copy backend or compose files into `opencloud-web`.
- Do not introduce runtime DOM hacks for branding, feedback links, or topbar behavior.
- Keep new package diffs mechanical and reversible.
- Preserve old routes through redirects during the migration.
