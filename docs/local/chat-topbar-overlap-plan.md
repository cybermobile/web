# Chat Topbar Overlap Cleanup

## Target Result

The AI Chat trigger should render as a normal control inside the OpenCloud topbar right extension slot, so it cannot overlap the notification bell or other topbar actions.

## Constraints

- Keep the drawer fixed-position; only the trigger button should participate in topbar layout.
- Keep the AI Chat page/slide-out behavior unchanged.
- Do not touch backend or compose files.

## Plan

1. Remove fixed positioning from the AI Chat trigger.
2. Give the trigger a stable topbar-sized hit area with accessible button attributes.
3. Verify the Vue component with lint, typecheck, formatting, build, and unit tests.
