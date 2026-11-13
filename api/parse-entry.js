// Lançamento por frase livre, interpretado pelo Claude.
//
// O cliente só chama aqui quando o quickParse local não deu conta (sem valor,
// vários gastos na mesma frase, categoria desconhecida). Nada é gravado: a
// rota devolve os lançamentos entendidos e quem salva é o app, depois que a
// pessoa confirma.
//
// Exige login pelo mesmo motivo do proxy do Bolsai: a chave é paga.
import { applyCors, rateLimit, requireUser } from './_lib/http.js'
import {
  buildRequest, callClaude, DEFAULT_MODEL, extractToolInput, sanitizeEntries, validateInput,
} from './_lib/aiParse.js'

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // 503 e um código estável: o cliente esconde o botão de IA em vez de
    // mostrar erro a cada tentativa.
    return res.status(503).json({ error: 'IA não configurada no servidor', code: 'ai/not-configured' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const limit = rateLimit(`parse:${user.uid}`, { max: 20, windowMs: 60_000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Muitas tentativas seguidas. Espere um instante.' })
  }

  const input = validateInput(req.body)
  if (!input.ok) return res.status(400).json({ error: input.error })

  try {
    const request = buildRequest(input.value, { model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL })
    const response = await callClaude(request, { apiKey })
    const entries = sanitizeEntries(extractToolInput(response), input.value)
    return res.status(200).json({ entries })
  } catch (err) {
    // O texto do usuário fica fora do log: é dado financeiro pessoal.
    console.error('[parse-entry] falhou:', err.status || '', err.name, err.message)
    const timeout = err.name === 'AbortError'
    return res.status(502).json({
      error: timeout ? 'A IA demorou demais para responder.' : 'Não foi possível interpretar agora.',
      code: timeout ? 'ai/timeout' : 'ai/upstream',
    })
  }
}
