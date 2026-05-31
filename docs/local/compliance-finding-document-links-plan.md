# Compliance Finding Document Links

## Target Result

When a remediation document is created from a finding, the finding detail view should continue to show that related document after the user leaves and returns.

## Constraints

- Keep source evidence separate from remediation documents.
- Do not change backend schema from `opencloud-web`; infer links from existing `framework` and `control_id` fields.
- Keep the current Findings detail tab structure.

## Plan

1. Match documents to findings by framework and control ID.
2. Show linked remediation documents in the Findings list/detail UI.
3. When drafting from a finding, move the finding to `in_progress` and append a note referencing the document.
4. Verify with targeted lint, typecheck, format check, build, and unit tests.
