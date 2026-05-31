# Compliance Framework Library Tabs Plan

## Target

Make the Compliance Framework Library easier to scan by splitting it into local page tabs:

- Frameworks: analysis-ready framework cards grouped by domain.
- Source Documents: required source document/upload slots grouped by domain.
- Ingested Corpus: indexed corpus summary plus scan/ingest action.

## Constraints

- Work only inside `opencloud-web`.
- Do not change routes, backend APIs, or compose files.
- Keep the first pass local to the existing compliance app.
- Derive framework domains from existing `slug`, `name`, and `description` because the API does not expose categories yet.

## Validation

- Format changed files.
- Run TypeScript checks.
- Run build.
- Run unit tests if the type/build pass is clean.

## Follow-Up

The existing Frameworks tab component is still large. After this layout pass, split the three tab bodies into child components once the IA settles.
