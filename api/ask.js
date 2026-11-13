// "Pergunte ao Eazy": responde perguntas sobre os números do próprio usuário.
// O modelo escolhe as consultas e o servidor faz as contas (ver _lib/ask.js).
import { applyCors, rateLimit, requireUser } from './_lib/http.js'
import { callClaude, DEFAULT_MODEL } from './_lib/anthropic.js'
import { runAsk, validateAskInput } from './_lib/ask.js'

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'IA não configurada no servidor', code: 'ai/not-configured' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  // Mais apertado que o lançamento: cada pergunta pode virar várias chamadas.
  const limit = rateLimit(`ask:${user.uid}`, { max: 10, windowMs: 60_000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Muitas perguntas seguidas. Espere um instante.' })
  }

  const input = validateAskInput(req.body)
  if (!input.ok) return res.status(400).json({ error: input.error })

  try {
    const { answer, queries } = await runAsk(input.value, {
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      call: (request) => callClaude(request, { apiKey, timeoutMs: 20_000 }),
    })
    return res.status(200).json({ answer, queries })
  } catch (err) {
    // Pergunta e números ficam fora do log.
    console.error('[ask] falhou:', err.status || '', err.name, err.message)
    const timeout = err.name === 'AbortError'
    return res.status(502).json({
      error: timeout ? 'A IA demorou demais para responder.' : 'Não foi possível responder agora.',
      code: timeout ? 'ai/timeout' : 'ai/upstream',
    })
  }
}
