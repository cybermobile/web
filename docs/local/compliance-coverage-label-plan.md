# Compliance Coverage Label Cleanup

## Target Result

Findings should make clear that `covered`, `partial`, and `missing` describe source-evidence coverage from analysis, not remediation/document workflow progress.

## Constraints

- Do not change persisted coverage values or backend behavior.
- Keep remediation status separate from evidence coverage.
- Keep the Findings list compact.

## Plan

1. Change visible labels from generic coverage wording to evidence coverage wording.
2. Clarify the no-evidence empty state.
3. Verify with targeted lint, typecheck, formatting, build, and unit tests.
