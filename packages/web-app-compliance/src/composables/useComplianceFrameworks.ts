export type ComplianceFrameworkSummary = {
  slug: string
  name: string
  version: string
  description: string
  control_count: number
}

export type ComplianceRequiredDocument = {
  key: string
  title: string
  role: string
  description: string
  ingested: boolean
  chunks: number
  sources: string[]
}

export type ComplianceFrameworkLibraryEntry = {
  slug: string
  name: string
  version: string
  description: string
  control_count: number
  required_documents: ComplianceRequiredDocument[]
  extras: { key: string; chunks: number; sources: string[] }[]
  all_required_ingested: boolean
  missing_required: string[]
}

export function countMissingRequiredFrameworkDocs(
  frameworks: ComplianceFrameworkLibraryEntry[]
): number {
  return frameworks.reduce((count, framework) => count + framework.missing_required.length, 0)
}

export function readFrameworksResponse(data: {
  frameworks?: ComplianceFrameworkSummary[]
}): ComplianceFrameworkSummary[] {
  return data.frameworks || []
}
