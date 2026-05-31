export type ComplianceTab =
  | 'dashboard'
  | 'frameworks'
  | 'audit'
  | 'findings'
  | 'evidence'
  | 'documents'

const VALID_TABS: ComplianceTab[] = [
  'dashboard',
  'frameworks',
  'audit',
  'findings',
  'evidence',
  'documents'
]

const COMPLIANCE_ROUTE_RE = /\/(?:ai-tools\/)?compliance(?:\/([^/?#]+))?/

export function complianceTabFromPath(pathname = window.location.pathname): ComplianceTab {
  const match = pathname.match(COMPLIANCE_ROUTE_RE)
  const raw = (match?.[1] || '').toLowerCase()

  return (VALID_TABS as string[]).includes(raw) ? (raw as ComplianceTab) : 'dashboard'
}

export function isComplianceTabPinned(pathname = window.location.pathname): boolean {
  const match = pathname.match(COMPLIANCE_ROUTE_RE)

  return !!(match && match[1])
}

export function isComplianceRoute(pathname = window.location.pathname): boolean {
  return COMPLIANCE_ROUTE_RE.test(pathname)
}

export function compliancePathForTab(tab: ComplianceTab): string {
  return `/compliance/${tab}`
}
