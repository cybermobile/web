# AI Chat Menu Cleanup Plan

## Goal

Keep the global AI chat drawer available from the top bar while removing the redundant AI Chat app entry from the application menu.

## Changes

1. Remove only the `appMenuItem` extension from `web-app-ai-chat`.
2. Keep the `ChatWidget` custom component mounted in `app.runtime.header.right`.
3. Keep the `/ai-chat` route available for direct access during migration.
4. Make Compliance AI reasoning errors clearer when the backend reports an Ollama connection failure.

## Verification

- Run targeted ESLint for AI Chat and Compliance files.
- Run `pnpm check:types`.
- Run `pnpm format:check`.
- Run `pnpm build`.
