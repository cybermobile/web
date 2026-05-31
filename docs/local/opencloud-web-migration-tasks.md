# OpenCloud Web Migration Task List

This task list maps the web work currently living in `opencloud-compose` into the proper `opencloud-web` monorepo structure.

Use the local `$opencloud-web-design` skill before editing or reviewing these tasks. It captures the [OpenCloud Design System](https://docs.opencloud.eu/design-system/), theme-token, package-boundary, and AI Tools migration references.

## Current State

- Source extension in compose repo: `../opencloud-compose/ai/web-app-chat/`
- Compiled external app artifact in compose repo: `../opencloud-compose/config/opencloud/apps/chat/`
- Current web checkout: `../opencloud-web`
- OpenCloud web package pattern: bundled apps live under `../opencloud-web/packages/web-app-*`
- Runtime config now maps separate app ids to separate package/module paths:
  - `ai-chat` -> `web-app-ai-chat` topbar chat widget and direct route; no app menu entry
  - `compliance` -> `web-app-compliance`
  - `cloud-sync` -> `web-app-cloud-sync` with Providers at `/cloud-sync/providers`, Sync operations at `/cloud-sync/sync/*`, and Confluence importer at `/cloud-sync/confluence/*`
  - `files` -> includes File Organizer at `/files/organizer`
  - `confluence` -> `web-app-confluence` compatibility redirect only
  - `file-organizer` -> `web-app-file-organizer` compatibility redirect only
  - `ai-tools` -> `web-app-ai-tools` compatibility redirects only

## Tasks

### 1. Create The Proper Web App Packages

- [x] Create these app packages:
  - `../opencloud-web/packages/web-app-ai-chat/`
  - `../opencloud-web/packages/web-app-compliance/`
  - `../opencloud-web/packages/web-app-confluence/`
  - `../opencloud-web/packages/web-app-file-organizer/`
  - `../opencloud-web/packages/web-app-cloud-sync/`
  - `../opencloud-web/packages/web-app-ai-tools/` as a legacy redirect shell
- [x] Set package names to match their `web-app-*` directory names, version `0.0.0`, private, AGPL-3.0.
- [ ] Use OpenCloud workspace dependencies instead of published `^6.1.0` package versions:
  - `@opencloud-eu/design-system: workspace:^`
  - `@opencloud-eu/web-client: workspace:*`
  - `@opencloud-eu/web-pkg: workspace:*`
  - `@opencloud-eu/web-test-helpers: workspace:*`
- [x] Keep `@ai-sdk/vue`, `ai`, `marked`, and `zod` only in app packages that still use them.
- [x] Add `src/appid.ts` per app with its final app id.
- [x] Port `ai/web-app-chat/src/index.ts` into package-specific app registration files.
- [x] Preserve old `/ai-tools/...` URLs through redirects while new canonical app URLs move to their own ids.

### 2. Move Pages And Split Large Components

- [x] Move migrated pages into their owning app packages:
  - `CompliancePage.vue` -> `web-app-compliance`
  - `OrganizerPage.vue` -> `web-app-files`
  - `RclonePage.vue` -> `web-app-cloud-sync`
  - `ConfluencePage.vue` -> `web-app-cloud-sync`
  - `ChatPage.vue` -> `web-app-ai-chat`
- [ ] Split `CompliancePage.vue` before treating it as production-ready. It is currently about 4,500 lines; OpenCloud guidance prefers components under roughly 300 lines.
- [ ] Suggested split:
  - `views/compliance/ComplianceLayout.vue`
  - `views/compliance/DashboardTab.vue`
  - `views/compliance/FrameworksTab.vue`
  - `views/compliance/AuditPrepTab.vue`
  - `views/compliance/FindingsTab.vue`
  - `views/compliance/EvidenceTab.vue`
  - `views/compliance/DocumentsTab.vue`
  - `views/compliance/composables/useComplianceApi.ts`
  - `views/compliance/composables/useComplianceRouteState.ts` (created)
- [x] Move Confluence subcomponents from `ai/web-app-chat/src/confluence/` into `web-app-cloud-sync/src/views/confluence/`.
- [x] Move chat components from `ai/web-app-chat/src/chat/` plus `ChatPanelSdk.vue` and `ChatWidget.vue` into `web-app-ai-chat/src/components/chat/`.

### 3. Replace Runtime DOM Hacks

- [ ] Remove direct DOM rebranding from `ai/web-app-chat/src/index.ts`:
  - `document.querySelector(...)`
  - `MutationObserver`
  - injected CSS hiding `feedback-web`
- [ ] Put brand/theming changes into the OpenCloud theme/config path instead:
  - theme JSON served by OpenCloud, or
  - `../opencloud-web/packages/web-runtime/` if the runtime must support a new configurable option.
- [ ] If the feedback link must be disabled, make it a runtime/theme/config decision around `packages/web-runtime/src/components/Topbar/FeedbackLink.vue`, not injected CSS from an app.

### 4. Normalize OpenCloud Theming And Components

- [ ] Replace inline SVG icons in `OrganizerPage.vue`, `RclonePage.vue`, `ConfluencePage.vue`, and `CompliancePage.vue` with `OcIcon` or established design-system icon usage.
- [ ] Replace custom button classes such as `btn btn-primary`, `btn-secondary`, `btn-danger` with `OcButton` or existing OpenCloud button classes.
- [ ] Replace custom form inputs/tables/cards with design-system components where practical:
  - `OcTextInput`
  - `OcTextarea`
  - `OcSelect`
  - `OcCheckbox`
  - `OcTable`
  - `OcCard`
- [ ] Prefer Tailwind role classes and CSS variables from `@opencloud-eu/design-system`.
- [ ] Remove hardcoded fallback colors where a theme role exists, especially repeated `#0D856F`, `#dc2626`, `#fff`, `#191c1d`.
- [ ] Keep page layouts consistent with existing OpenCloud app layouts such as `web-app-mail` and `web-app-admin-settings`.

### 5. Internationalization And Text

- [ ] Replace user-facing string literals with `$gettext`.
- [ ] Add `l10n/translations.json` as an empty/generated placeholder matching other web app packages.
- [ ] Do not manually edit generated translation files beyond the package scaffold.
- [ ] Check page titles and app menu labels:
  - `AI Tools`
  - `AI Chat` remains topbar-only
  - `Cloud Sync`
  - `Organizer` under Files
  - `Confluence Importer` under Cloud Sync
  - `Compliance`

### 6. Backend URL And Configuration

- [ ] Replace hostname-derived backend URL logic such as `https://agent.${window.location.hostname...}` with a config-driven value.
- [ ] Suggested config shape:
  - `options.aiTools.agentUrl`
  - or `applicationConfig.agentUrl` if loaded as an external app.
- [ ] Keep one API helper/composable for agent calls instead of scattered `fetch()` calls.
- [ ] Move endpoint-specific functions into typed API modules:
  - `useComplianceApi.ts`
  - `useOrganizerApi.ts`
  - `useRcloneApi.ts`
  - `useConfluenceApi.ts`
  - `useChatApi.ts`
- [ ] Keep backend implementation in this compose repo under `ai/agent/`; do not move FastAPI code into `opencloud-web`.

### 7. Register The Bundled App

- [x] Add split app ids to `../opencloud-web/dev/docker/opencloud.web.config.json` for local web development.
- [ ] Decide whether `ai-tools` belongs in `../opencloud-web/config/config.json.dist`; include it only if this fork should ship the app by default.
- [x] Verify the Vite import map contains the split app modules after `pnpm build`.
- [ ] In this compose repo, keep `custom-opencloud-web-local.yml` pointing at `../opencloud-web/dist`.

### 8. Retire Or Rebuild The External App Artifact

- [ ] Decide whether `config/opencloud/apps/chat/` is temporary or should be removed after bundled migration.
- [ ] If bundled into `opencloud-web`, remove stale compiled artifacts from `config/opencloud/apps/chat/` and stop relying on `OC_APPS_DIR` for the AI Tools app.
- [ ] If keeping it as an external app instead, rebuild it from source and update `config/opencloud/apps/chat/manifest.json`.
- [ ] Avoid maintaining both bundled `web-app-ai-tools` and external `config/opencloud/apps/chat` long-term.

### 9. Move Tests Into The Right Repo

- [ ] Move UI E2E tests from `ai/web-app-chat/e2e/` into `../opencloud-web/tests/e2e/` only after they use the web repo test conventions.
- [ ] Keep backend/API integration tests close to `ai/agent/` in this compose repo.
- [ ] Replace hardcoded `AGENT_URL = 'https://agent.opencloud.test'` in web tests with environment/config.
- [ ] Add component/unit tests for split compliance composables and high-risk UI flows.

### 10. Verification Sequence

- [ ] In `../opencloud-web`, run `pnpm install`.
- [ ] In `../opencloud-web`, run `pnpm check:types`.
- [ ] In `../opencloud-web`, run `pnpm lint`.
- [ ] In `../opencloud-web`, run targeted unit tests for the new package.
- [ ] In `../opencloud-web`, run `pnpm build`.
- [ ] In this repo, run:

```bash
docker compose -f docker-compose.yml -f custom-opencloud-web-local.yml config --services
docker compose up -d --build opencloud
```

- [ ] Manually verify:
  - `/file-organizer`
  - `/cloud-sync`
  - `/confluence`
  - `/compliance`
  - `/compliance/findings`
  - legacy redirects under `/ai-tools/...`
  - floating chat widget on desktop and mobile widths

## Do Not Move

- [ ] Keep Docker Compose files, AI agent services, Qdrant, OpenSearch, SearxNG and Unstructured wiring in this compose repo.
- [ ] Keep compliance framework JSONs in `ai/agent/frameworks/` unless the backend package itself is split into a separate service repo.
- [ ] Keep ISMS/compliance operating docs in this repo unless they become user-facing web documentation.
