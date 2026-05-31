export type ComplianceDocumentStage =
  | 'request'
  | 'research'
  | 'context_assembly'
  | 'draft'
  | 'review'
  | 'approved'
  | 'rejected'

export type ComplianceDocumentColumn = {
  stage: ComplianceDocumentStage
  label: string
  terminal?: boolean
}

export const COMPLIANCE_DOCUMENT_COLUMNS: ComplianceDocumentColumn[] = [
  { stage: 'request', label: 'Requested' },
  { stage: 'research', label: 'Researching' },
  { stage: 'context_assembly', label: 'Context review' },
  { stage: 'draft', label: 'Drafting' },
  { stage: 'review', label: 'Under review' },
  { stage: 'approved', label: 'Approved', terminal: true },
  { stage: 'rejected', label: 'Rejected', terminal: true }
]

export function canAdvanceComplianceDocument(document: {
  stage: ComplianceDocumentStage
}): boolean {
  return document.stage !== 'approved' && document.stage !== 'rejected'
}

export function canRegenerateComplianceDocumentDraft(document: {
  stage: ComplianceDocumentStage
}): boolean {
  return document.stage === 'review' || document.stage === 'draft'
}

export function canRejectComplianceDocument(document: { stage: ComplianceDocumentStage }): boolean {
  return document.stage === 'context_assembly' || document.stage === 'review'
}

export function nextComplianceDocumentActionLabel(document: {
  stage: ComplianceDocumentStage
}): string {
  switch (document.stage) {
    case 'request':
      return 'Start research'
    case 'research':
      return 'Approve research'
    case 'context_assembly':
      return 'Approve context → draft'
    case 'draft':
      return 'Move to review'
    case 'review':
      return 'Approve'
    default:
      return 'Advance'
  }
}
