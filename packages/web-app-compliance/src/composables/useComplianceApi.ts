export type ComplianceJsonRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function requestComplianceJson<T>(
  agentUrl: string,
  path: string,
  options: ComplianceJsonRequestOptions = {}
): Promise<T> {
  const { body, headers, ...requestOptions } = options
  const response = await fetch(`${agentUrl}${path}`, {
    ...requestOptions,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(headers || {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.detail)
      .catch(() => '')

    throw new Error(detail ? `HTTP ${response.status} - ${detail}` : `HTTP ${response.status}`)
  }

  const text = await response.text()

  return text ? JSON.parse(text) : (undefined as T)
}

export async function requestComplianceFormJson<T>(
  agentUrl: string,
  path: string,
  body: FormData
): Promise<T> {
  const response = await fetch(`${agentUrl}${path}`, { method: 'POST', body })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`)
  }

  return data
}
