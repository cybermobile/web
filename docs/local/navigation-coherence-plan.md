# Navigation Coherence Plan

## Goal

Group support tools by the work area they serve, without merging their behavior back into one large AI Tools app.

## Changes

1. Move File Organizer into the Files work area as `/files/organizer`.
2. Move Confluence Importer into Cloud Sync as `/cloud-sync/confluence/connections`,
   `/cloud-sync/confluence/jobs` and `/cloud-sync/confluence/history`.
3. Keep old `/file-organizer` and `/confluence` URLs as redirects so existing bookmarks do not hard-fail.
4. Remove separate top-level app menu entries for File Organizer and Confluence Importer.
5. Keep backend and compose wiring untouched.

## Verification

- Run `pnpm check:types`.
- Run targeted ESLint for touched app packages.
- Run `pnpm format:check`.
- Run `pnpm build`.
