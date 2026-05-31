# Custom OpenCloud Web Workflow

Use this workflow when changes belong in the core OpenCloud web UI rather than the local AI compliance extension.

For the concrete migration backlog from the current compose repo work, see [OpenCloud Web Migration Task List](opencloud-web-migration-tasks.md).
For Codex-assisted UI work, use the local `$opencloud-web-design` skill. It points to the official [OpenCloud Design System](https://docs.opencloud.eu/design-system/) docs and the local `../opencloud-web/packages/design-system/` standards.

## Repository Split

Keep the projects as sibling checkouts:

```text
~/Documents/Github/
  opencloud-compose/  # deployment, AI services, compose overrides
  opencloud-web/      # opencloud-eu/web source checkout
```

The upstream web repo is `https://github.com/opencloud-eu/web`.

## Where Changes Belong

| Change type                                                                 | Destination                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| OpenCloud shell, navigation, account menu, layout, routing or theme loading | `../opencloud-web/packages/web-runtime/`                      |
| Shared colors, tokens, buttons, inputs, cards or reusable UI primitives     | `../opencloud-web/packages/design-system/`                    |
| Built-in OpenCloud app pages such as files/search/admin settings            | `../opencloud-web/packages/web-app-*/`                        |
| AI Compliance Suite extension pages                                         | `opencloud-compose/ai/web-app-chat/src/`                      |
| Docker/service wiring                                                       | `opencloud-compose/*.yml` or `opencloud-compose/custom-*.yml` |

Do not copy the whole web source tree into this compose repo. Keep source changes in `../opencloud-web`, build there, and let compose mount or reference the built output.

## Local Build And Run

From the web checkout:

```bash
cd ../opencloud-web
pnpm install
pnpm build
```

From this compose checkout, add the local web override to `.env`:

```text
COMPOSE_FILE=docker-compose.yml:traefik/opencloud.yml:custom-opencloud-web-local.yml
```

Then restart OpenCloud:

```bash
docker compose up -d --build opencloud
```

The override sets `WEB_ASSET_CORE_PATH=/web/dist` and mounts `../opencloud-web/dist` read-only into the OpenCloud container. The backend image remains unchanged; only the served web assets come from the local web build.

## Migration Checklist

1. Inventory your existing web edits and group them by page or feature.
2. Move core shell/layout/theme edits into `../opencloud-web/packages/web-runtime/`.
3. Move shared styling primitives into `../opencloud-web/packages/design-system/`.
4. Move AI Compliance Suite-specific pages into `ai/web-app-chat/src/` in this repo.
5. Prefer existing design-system components and Tailwind utilities.
6. Use theme role variables such as `var(--oc-role-surface)` or Tailwind role colors instead of hardcoded colors.
7. Run `pnpm check:types`, `pnpm lint`, and targeted unit tests in `../opencloud-web`.
8. Build `../opencloud-web`, start compose with `custom-opencloud-web-local.yml`, and manually verify the changed pages in the browser.

For a production deployment, build and publish a custom OpenCloud image or arrange a controlled artifact mount. The local bind mount is intended for development and review.
