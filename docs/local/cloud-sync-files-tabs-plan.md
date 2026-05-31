# Cloud Sync And Organizer Tabs Plan

## Goal

Make Cloud Sync and File Organizer match the app information architecture:

- Cloud Sync has three local areas: Providers, Sync, Confluence.
- Sync and Confluence each use tabs for their operational subviews.
- File Organizer uses page tabs for Organize and Settings instead of a nested sidebar.

## Routes

- `/cloud-sync/providers`
- `/cloud-sync/sync/jobs`
- `/cloud-sync/sync/history`
- `/cloud-sync/confluence/connections`
- `/cloud-sync/confluence/jobs`
- `/cloud-sync/confluence/history`

## Verification

- Run targeted ESLint for touched Cloud Sync and Files files.
- Run `pnpm check:types`.
- Run `pnpm format:check`.
- Run `pnpm build`.
