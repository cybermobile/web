# ISMS Gap Review Pack

This pack turns the compliance suite into a repeatable review method for an ISMS, vessel SMS cyber procedures, OT/IACS procedures, and related policies. It is designed for internal readiness work, not as legal advice or a replacement for licensed standards, class society rules, flag-state guidance, or external auditor judgement.

## Review Strategy

Use ISO/IEC 27001 as the ISMS spine, then layer the other regimes over the same evidence library:

| Layer                         | Use it for                                                                                                                  | Framework slug                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| ISMS management system        | Scope, leadership, risk assessment, Statement of Applicability, internal audit, management review and continual improvement | `iso_27001`                      |
| Cyber operating profile       | A business-friendly view across Govern, Identify, Protect, Detect, Respond and Recover                                      | `nist_csf`                       |
| EU legal overlay              | Article 21 risk-management duties, management accountability, incident reporting and national transposition differences     | `nis2_article_21`                |
| Maritime SMS overlay          | Proving cyber risk is handled inside the Safety Management System                                                           | `imo_cyber_risk_sms`, `ism_code` |
| Ship cyber resilience         | Newbuild/class evidence for ship-level cyber resilience                                                                     | `iacs_ur_e26`                    |
| Onboard systems and equipment | Supplier/system security case, hardening, update and verification evidence                                                  | `iacs_ur_e27`                    |
| OT/IACS security program      | Asset-owner policies/procedures for industrial automation and control systems                                               | `iec_62443_2_1`                  |

The user mentioned `IEC 64733`. Treat that as an unresolved intake question, not as a confirmed framework mapping. Do not map `IEC 64733` to `IEC 62443` until the requester confirms the intended standard; if the intended standard is different, add it as a separate framework JSON instead of overloading the 62443 scaffold.

## Minimum Document Set

Start by creating a folder per document type in Cloudbase Spaces, then ingest each approved/current document into the Framework Library or the general RAG corpus.

| Domain           | Required evidence to look for                                                                                                                                                                                                                        | Common gap when missing                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ISMS governance  | ISMS scope, interested parties, legal/regulatory register, information security policy, roles/RACI, risk appetite                                                                                                                                    | Controls cannot be tied to business scope or leadership accountability   |
| Risk management  | Risk methodology, asset inventory, risk register, risk treatment plan, Statement of Applicability, acceptance records                                                                                                                                | Controls exist, but no risk-based justification or exclusion rationale   |
| Policy set       | Access control, acceptable use, asset management, classification/handling, cryptography, supplier security, secure development, incident response, business continuity, backup, logging/monitoring, vulnerability/patching, remote work, HR security | Policies are present but do not cover operational procedures or owners   |
| Procedures       | Joiner-mover-leaver, access reviews, privileged access, change management, vulnerability handling, backup/restore, incident triage, supplier onboarding, secure procurement, secure development, exception handling                                  | Policy intent is not executable or auditable                             |
| Evidence records | Training records, access review outputs, risk review minutes, management review minutes, internal audit reports, incident tickets, backup restore tests, vulnerability remediation, supplier assessments, BCP/DR exercises                           | Procedures exist but operating effectiveness cannot be demonstrated      |
| Maritime SMS     | SMS cyber-risk procedure, vessel cyber risk assessment, onboard cyber plan, crew training/drills, ship/shore escalation, cyber incident log, manual fallback/recovery instructions                                                                   | Cyber risk is handled in IT policy but not embedded in SMS verification  |
| IACS/OT          | OT asset inventory, zones/conduits or network diagrams, remote access procedure, removable media procedure, engineering workstation controls, patch/backup constraints, compensating controls                                                        | IT controls are assumed to apply to OT without site-specific constraints |
| IACS UR E26/E27  | Vessel/system applicability decisions, supplier security case, hardening guide, commissioning/security test evidence, class survey evidence, update/support lifecycle evidence                                                                       | Class survey evidence is scattered across project files and vendor PDFs  |
| NIS2             | Entity classification, applicable national law, competent authority/reporting route, management body approval/training evidence, Article 21 control mapping, incident notification procedure                                                         | EU directive is mapped, but local transposition/reporting duties are not |

## Review Workflow

1. Inventory all current policies, procedures and records.
2. Tag each document with owner, scope, approval date, review date, framework relevance, confidentiality level and source location.
3. Upload only standards/source texts that the organization is licensed to store and process in this system. If the license does not allow that use, upload approved excerpts, internal control mappings or internal crosswalks instead.
4. Ingest internal policies, procedures, diagrams and records into the compliance corpus.
5. Run gap analysis for `iso_27001` first, because it exposes missing ISMS backbone documents.
6. Run `nis2_article_21`, `nist_csf`, `imo_cyber_risk_sms`, `ism_code`, `iacs_ur_e26`, `iacs_ur_e27` and `iec_62443_2_1` as overlays.
7. Treat any finding without cited internal evidence as an evidence gap, not automatically as non-compliance.
8. For each gap, record owner, affected framework controls, missing evidence, decision needed, remediation action, due date and acceptance status.
9. Review the gap register in management review until every gap is closed, accepted with rationale or marked not applicable with evidence.

## Gap Register Fields

Use these columns in the findings module or a spreadsheet export:

| Field             | Purpose                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gap ID            | Stable reference, e.g. `GAP-2026-001`                                                                                                                |
| Framework/control | One or more framework slugs and control IDs                                                                                                          |
| Requirement topic | Short topic such as `access review`, `supplier security`, `ship recovery`                                                                            |
| Gap type          | `missing document`, `stale document`, `missing approval`, `missing operating evidence`, `control design gap`, `effectiveness gap`, `scope ambiguity` |
| Evidence found    | Links/citations from Cloudbase corpus                                                                                                                |
| Evidence missing  | The exact record or document needed                                                                                                                  |
| Risk statement    | Why this matters operationally, legally or for audit                                                                                                 |
| Owner             | Named accountable role/person                                                                                                                        |
| Remediation       | Concrete action, not just "update policy"                                                                                                            |
| Due date          | Date agreed with owner                                                                                                                               |
| Status            | `open`, `in progress`, `blocked`, `accepted`, `not applicable`, `needs legal/class review`, `closed`                                                 |
| Closure evidence  | Link to approved document, test record, ticket, minutes or exception                                                                                 |

## Pass/Fail Rules

A document is not enough by itself. Mark a control as:

| Status                   | Rule                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Covered                  | Current approved document exists, owner is clear, and recent operating evidence proves it is used                                     |
| Partial                  | Policy exists but procedure/evidence/approval/scope is weak                                                                           |
| Missing                  | No relevant policy, procedure or operating evidence is found                                                                          |
| Not applicable           | Scope exclusion is documented, approved and risk-assessed                                                                             |
| Needs legal/class review | The answer depends on national NIS2 transposition, flag/class interpretation, contract date, vessel type or licensed standard wording |

## Source Notes

- ISO confirms ISO/IEC 27001:2022 is the ISMS requirements standard and notes Amendment 1:2024, so keep the source slot current with your certification body expectations: https://www.iso.org/standard/27001
- NIST CSF 2.0 is the current NIST cybersecurity framework and adds explicit governance emphasis: https://www.nist.gov/cyberframework
- NIS2 Article 21 is a directive baseline; use national transposition law for binding local requirements: https://eur-lex.europa.eu/eli/dir/2022/2555/oj
- IMO MSC.428(98) requires cyber risk management to be addressed in safety management systems after the first Document of Compliance annual verification after 2021-01-01: https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/MSCResolutions/MSC.428%2898%29.pdf
- IMO's current maritime cyber risk page points to the current MSC-FAL.1/Circ.3 revision: https://www.imo.org/en/ourwork/security/pages/cyber-security.aspx
- IACS UR E26/E27 applicability changed during the 2024 transition; confirm the current UR revision, vessel contract date, vessel type and class society interpretation. Use the current IACS UR E page and the applicable class society rules as operational sources, with the IACS press release as transition context: https://iacs.org.uk/resolutions/unified-requirements/ur-e and https://iacs.org.uk/news/iacs-ur-e26-and-e27-press-release
- IEC 62443-2-1:2024 is the relevant asset-owner IACS security program standard when reviewing OT policies/procedures: https://webstore.iec.ch/en/publication/62883
