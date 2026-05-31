export type ComplianceFindingStatus = 'covered' | 'partial' | 'missing'
export type ComplianceFindingSeverity = 'major' | 'minor' | 'observation' | 'none'

export type ComplianceFindingEvidence = {
  score: number
  text: string
  source: string
  section_title: string
  clause: string
  page_number: number
  node_id: string
}

export type ComplianceFinding = {
  control_id: string
  control_title: string
  control_section: string
  framework: string
  status: ComplianceFindingStatus
  severity: ComplianceFindingSeverity
  top_score: number
  evidence: ComplianceFindingEvidence[]
  reasoning: string
}

export const COMPLIANCE_SEVERITY_ORDER: Record<ComplianceFindingSeverity, number> = {
  major: 0,
  minor: 1,
  observation: 2,
  none: 3
}

export const COMPLIANCE_COVERAGE_ORDER: Record<ComplianceFindingStatus, number> = {
  missing: 0,
  partial: 1,
  covered: 2
}

export const COMPLIANCE_COVERED_THRESHOLD = 0.7
export const COMPLIANCE_PARTIAL_THRESHOLD = 0.55

export function nextComplianceFindingAction(
  finding: ComplianceFinding,
  coveredThreshold = COMPLIANCE_COVERED_THRESHOLD
): string {
  if (finding.severity === 'observation') {
    return 'Re-run analysis — this control failed to evaluate. Check ai-agent logs for retrieval or Qdrant errors.'
  }

  if (finding.status === 'missing') {
    return `Create or ingest a procedure covering clause ${finding.control_id} (${finding.control_title}). No evidence was found in the current corpus.`
  }

  if (finding.status === 'partial') {
    const evidence = finding.evidence[0]
    const source = evidence?.source ? ` in ${evidence.source}` : ''
    return `Review the existing content${source} and confirm it fully addresses clause ${finding.control_id}. Top retrieval score ${finding.top_score.toFixed(3)} is below the covered threshold of ${coveredThreshold}.`
  }

  return ''
}
