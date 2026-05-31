# Compliance Remediation Evidence Copy

## Target Result

Findings should clearly distinguish remediation work from source evidence. A linked remediation document should not make the no-evidence warning look like the document was ignored.

## Constraints

- Keep remediation documents and source evidence as separate concepts.
- Do not change backend schema from `opencloud-web`.
- Preserve the existing finding status controls while adding a clearer path for findings with remediation documents.

## Plan

1. Fix the finding update helper around remediation document creation.
2. Change no-evidence copy when remediation documents are linked.
3. Show a remediation-started indicator and an action to mark open findings in progress.
4. Verify with targeted lint, typecheck, format check, build, and unit tests.
