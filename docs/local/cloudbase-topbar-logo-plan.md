# Cloudbase Topbar Logo Fallback Plan

## Target

Remove the remaining user-facing OpenCloud wordmark from the top-left topbar logo.

## Constraint

- Work only in `opencloud-web`.
- Do not rename internal packages, routes, env vars, or upstream identifiers.
- Do not modify compose/backend files.

## Approach

- Keep the Cloudbase branding theme in `/branding/cloudbase`.
- Add Cloudbase assets at the default `/themes/opencloud` static path because some runtime configs still reference that default theme/logo path.
- Keep the path name for compatibility; change only the user-facing asset content.

## Validation

- Build and confirm the fallback theme/logo assets are emitted into `dist`.
- Run focused type/build checks.
