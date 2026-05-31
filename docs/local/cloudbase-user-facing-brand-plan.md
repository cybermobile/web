# Cloudbase User-Facing Brand Pass

## Target Result

The visible product name should read Cloudbase in the browser title, manifest, topbar theme, migrated app copy, and local user-facing docs.

## Constraints

- Do not rename packages, imports, routes, env vars, domains, Docker services, or upstream OpenCloud identifiers.
- Keep backend/OpenCloud implementation references where they describe internals.
- Keep this pass limited to user-facing copy and local theme assets.

## Plan

1. Add a Cloudbase local theme asset and point local web config at it.
2. Update browser/app metadata defaults.
3. Replace visible OpenCloud wording in migrated AI/compliance/cloud-sync screens.
4. Update local user-facing ISMS pack wording.
5. Verify formatting, lint, typecheck, build, and unit tests.
