// Confluence Importer API client
import { getAiToolsServiceUrl } from '@opencloud-eu/web-pkg'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Connection {
  id: string
  name: string
  base_url: string
  email: string
  api_token: string
  created_at: string
}

export interface ConnectionCreate {
  name: string
  base_url: string
  email: string
  api_token: string
}

export type SourceType = 'space' | 'subtree'
export type DestinationMode = 'new_space' | 'existing_folder'
export type RunStatus = 'running' | 'success' | 'partial' | 'failed'

export interface ImportJob {
  id: string
  connection_id: string
  name: string
  source_type: SourceType
  source_key: string
  destination_mode: DestinationMode
  destination_ref: string
  schedule: string
  enabled: boolean
  last_run_at: string | null
  space_id: string
  created_at: string
}

export interface ImportJobCreate {
  connection_id: string
  name: string
  source_type: SourceType
  source_key: string
  destination_mode: DestinationMode
  destination_ref?: string
  schedule?: string
  enabled?: boolean
}

export interface ImportJobPatch {
  name?: string
  schedule?: string
  enabled?: boolean
  destination_mode?: DestinationMode
  destination_ref?: string
}

export interface ImportRun {
  id: string
  job_id: string
  started_at: string
  finished_at: string | null
  status: RunStatus
  pages_added: number
  pages_updated: number
  pages_deleted: number
  attachments_synced: number
  error_summary: string
  log: string
}

export interface ConfluenceSpace {
  key: string
  name: string
  [key: string]: unknown
}

export interface TreeNode {
  id: string
  title: string
  has_children: boolean
}

export interface DryRunResult {
  add: number
  update: number
  delete: number
  sample_adds: string[]
  sample_updates: string[]
  sample_deletes: string[]
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${getAiToolsServiceUrl('confluence')}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (resp.status === 204) return undefined as unknown as T
  return resp.json()
}

// ─── Connections ─────────────────────────────────────────────────────────────

export function listConnections(): Promise<Connection[]> {
  return apiFetch<Connection[]>('/api/connections')
}

export function createConnection(data: ConnectionCreate): Promise<Connection> {
  return apiFetch<Connection>('/api/connections', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export function deleteConnection(id: string): Promise<void> {
  return apiFetch<void>(`/api/connections/${id}`, { method: 'DELETE' })
}

export function listSpaces(cid: string): Promise<ConfluenceSpace[]> {
  return apiFetch<ConfluenceSpace[]>(`/api/connections/${cid}/spaces`)
}

export function listTree(cid: string, root?: string): Promise<TreeNode[]> {
  const qs = root ? `?root=${encodeURIComponent(root)}` : ''
  return apiFetch<TreeNode[]>(`/api/connections/${cid}/tree${qs}`)
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function listJobs(): Promise<ImportJob[]> {
  return apiFetch<ImportJob[]>('/api/jobs')
}

export function createJob(data: ImportJobCreate): Promise<ImportJob> {
  return apiFetch<ImportJob>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export function updateJob(id: string, data: ImportJobPatch): Promise<ImportJob> {
  return apiFetch<ImportJob>(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export function deleteJob(id: string): Promise<void> {
  return apiFetch<void>(`/api/jobs/${id}`, { method: 'DELETE' })
}

export function runJob(id: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/jobs/${id}/run`, { method: 'POST' })
}

export function dryRunJob(id: string): Promise<DryRunResult> {
  return apiFetch<DryRunResult>(`/api/jobs/${id}/dry-run`, { method: 'POST' })
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export function listRuns(jid: string): Promise<ImportRun[]> {
  return apiFetch<ImportRun[]>(`/api/jobs/${jid}/runs`)
}

export function getRun(rid: string, jobId: string): Promise<ImportRun> {
  return apiFetch<ImportRun>(`/api/runs/${rid}?job_id=${encodeURIComponent(jobId)}`)
}

/**
 * Stream log lines from a running import via SSE.
 * @param rid    Run ID
 * @param jobId  Parent job ID (required by backend query param)
 * @param onLine Called for each log line received
 * @param onDone Called when the stream ends (with the final status string)
 */
export function streamRunLogs(
  rid: string,
  jobId: string,
  onLine: (line: string) => void,
  onDone: (status: string) => void
): () => void {
  const url = `${getAiToolsServiceUrl('confluence')}/api/runs/${rid}/stream?job_id=${encodeURIComponent(jobId)}`
  const es = new EventSource(url)

  es.onmessage = (ev) => {
    onLine(ev.data)
  }

  es.addEventListener('done', (ev: MessageEvent) => {
    onDone(ev.data)
    es.close()
  })

  es.addEventListener('error', () => {
    es.close()
  })

  // Return a cleanup function so callers can close early
  return () => es.close()
}
