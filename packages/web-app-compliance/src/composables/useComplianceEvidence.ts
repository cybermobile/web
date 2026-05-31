export type ComplianceEvidenceHit = {
  source?: string
  clause?: string
  score?: number
}

export type ComplianceEvidenceFinding = {
  framework: string
  control_id: string
  control_title: string
  coverage: string
  evidence?: ComplianceEvidenceHit[]
}

export type ComplianceEvidenceGroup = {
  source: string
  framework: string
  controls: {
    control_id: string
    control_title: string
    coverage: string
    clause: string
    score: number
  }[]
  totalHits: number
}

export type ComplianceAnomaly = {
  kind: 'missed_drill' | 'overdue_cert' | 'cert_expiring_soon' | 'event_spike'
  id?: string
  event_type?: string
  details: Record<string, unknown>
  severity: 'info' | 'warn' | 'error' | 'critical'
}

export function buildComplianceEvidenceGroups(
  findings: ComplianceEvidenceFinding[]
): ComplianceEvidenceGroup[] {
  const map: Record<string, ComplianceEvidenceGroup> = {}

  for (const finding of findings) {
    for (const evidence of finding.evidence || []) {
      const source = evidence.source || 'unknown'
      const key = `${finding.framework}::${source}`

      if (!map[key]) {
        map[key] = { source, framework: finding.framework, controls: [], totalHits: 0 }
      }

      map[key].controls.push({
        control_id: finding.control_id,
        control_title: finding.control_title,
        coverage: finding.coverage,
        clause: evidence.clause || '',
        score: evidence.score || 0
      })
      map[key].totalHits += 1
    }
  }

  for (const group of Object.values(map)) {
    const seen = new Set<string>()
    group.controls = group.controls.filter((control) => {
      const key = `${group.framework}::${control.control_id}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }

  return Object.values(map).sort((a, b) => b.totalHits - a.totalHits)
}

export function complianceAnomalyDetailLine(anomaly: ComplianceAnomaly): string {
  const details = anomaly.details || {}

  if (anomaly.kind === 'overdue_cert') {
    return `${details.name || anomaly.id} · ${details.vessel || '—'} · ${details.days_overdue ?? '?'}d overdue`
  }

  if (anomaly.kind === 'cert_expiring_soon') {
    return `${details.name || anomaly.id} · ${details.vessel || '—'} · renew within ${details.days_until ?? '?'}d`
  }

  if (anomaly.kind === 'missed_drill') {
    return `${details.name || anomaly.id} · ${details.vessel || '—'} · ${details.days_overdue ?? '?'}d overdue`
  }

  if (anomaly.kind === 'event_spike') {
    return `event "${anomaly.event_type}" · ${details.recent_count ?? '?'}× in 7d vs baseline ${details.daily_avg_30d ?? '?'}/day`
  }

  return JSON.stringify(details).slice(0, 80)
}
