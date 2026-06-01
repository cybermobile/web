# Compliance Corpus Document List Plan

## Target

Make the Ingested Corpus tab behave like a document list, not an overview chip cloud.

## Constraints

- Work only inside `opencloud-web`.
- Do not change backend APIs.
- The current corpus stats API exposes source names, framework tags, and chunk counts, but not stable document ids.

## Approach

- Render every corpus source as a table row.
- Link source names to Files:
  - If the source is a URL, open that URL.
  - If the source is an absolute path, route directly into the signed-in user's Files space.
  - Otherwise, search Files for the source name.

## Validation

- Format changed files.
- Run targeted lint.
- Run typecheck and build.
