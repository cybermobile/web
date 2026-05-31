# AI Tools Migration Handoff

Use the local Codex skill `$opencloud-web-design`.

Source AI Tools code is in `../opencloud-compose/ai/web-app-chat/`.
Migration plan is in `docs/local/opencloud-web-migration-tasks.md`.
Compose runtime is in `../opencloud-compose/custom-opencloud-web-local.yml`.

## Local App Split

- `packages/web-app-ai-chat/` owns the chat page, panel, and topbar widget.
- `packages/web-app-compliance/` owns the compliance page.
- `packages/web-app-confluence/` owns the Confluence importer.
- `packages/web-app-file-organizer/` owns the organizer page.
- `packages/web-app-cloud-sync/` owns the rclone/cloud sync page.
- `packages/web-app-ai-tools/` is only a compatibility redirect shell for old `/ai-tools/...` URLs.

Shared AI Tools configuration and chat-context helpers live in `packages/web-pkg/src/composables/`.

## Source References

- `../opencloud-compose/ai/web-app-chat/src/`
- `../opencloud-compose/ai/web-app-chat/e2e/`
- `../opencloud-compose/config/opencloud/apps/chat/`
- `../opencloud-compose/docs/opencloud-web-migration-tasks.md`
- `../opencloud-compose/docs/custom-opencloud-web-workflow.md`
- `../opencloud-compose/docs/compliance-suite.md`
- `../opencloud-compose/docs/isms-gap-review-pack.md`

## Local Copies

- `docs/local/opencloud-web-migration-tasks.md`
- `docs/local/custom-opencloud-web-workflow.md`

Do not copy backend code or compose files into `opencloud-web`. The backend remains in `opencloud-compose`; only UI app packages live in `opencloud-web`.
