# Compliance Findings Retrieval Message Cleanup

## Target Result

Findings should explain missing retrieval evidence in reviewer language instead of exposing backend/debug wording such as "No retrieval hits returned" or "ingested corpus."

## Constraints

- Keep persisted finding data unchanged.
- Do not change analysis, retrieval, or backend behavior from `opencloud-web`.
- Preserve the existing finding detail tabs and framework dropdown behavior.

## Plan

1. Detect known no-retrieval reasoning messages in the Findings tab.
2. Replace that raw message with a clearer warning in list and detail views.
3. Verify the component with formatting, lint, typecheck, build, and unit tests.
