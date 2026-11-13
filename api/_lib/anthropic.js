// Cliente mínimo da API de mensagens da Anthropic, sem SDK: um fetch só, para
// não puxar dependência nova para as funções serverless.

export const DEFAULT_MODEL = 'claude-haiku-5-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

export async function callClaude(request, { apiKey, fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(json?.error?.message || `Anthropic ${res.status}`)
      err.status = res.status
      throw err
    }
    return json
  } finally {
    clearTimeout(timer)
  }
}
