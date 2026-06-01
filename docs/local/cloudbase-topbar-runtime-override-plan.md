# Cloudbase Topbar Runtime Override Plan

## Target

Make the top-left runtime logo show Cloudbase even when the running backend still supplies the upstream OpenCloud default theme.

## Constraints

- Work only in `opencloud-web`.
- Keep internal OpenCloud package names, routes, domains, and upstream identifiers unchanged.
- Do not touch compose/backend files.

## Approach

- Keep custom theme support intact.
- Detect the upstream OpenCloud default logo/theme in `TopBar.vue`.
- Substitute the Cloudbase web-container wordmark for that default only.

## Validation

- Add a focused TopBar unit test.
- Run focused TopBar tests, typecheck, format check, and build.
