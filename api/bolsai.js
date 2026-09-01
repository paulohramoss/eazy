// Proxy para a API do Bolsai.
//
// O roteamento vem do rewrite em vercel.json, não do nome do arquivo:
//   /api/bolsai/stocks/PETR4/stats  ->  /api/bolsai?path=stocks/PETR4/stats
//
// A versão anterior (api/bolsai.js sem rewrite) só casava /api/bolsai exato, e
// a tentativa com catch-all (api/bolsai/[...path].js) não foi interpretada como
// catch-all neste projeto: um segmento chegava sem req.query.path e três ou mais
// caíam no 404 do próprio Vercel. O rewrite explícito não depende disso.
//
// Exige login: sem isso qualquer um consumiria a cota da chave, que é paga.
import { applyCors, rateLimit, requireUser } from './_lib/http.js'

const UPSTREAM = 'https://api.usebolsai.com/api/v1'

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: true, message: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()

  const apiKey = process.env.BOLSAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: true, message: 'BOLSAI_API_KEY não configurada' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const limit = rateLimit(`bolsai:${user.uid}`, { max: 120, windowMs: 60_000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: true, message: 'Muitas consultas. Aguarde um instante.' })
  }

  // :path* chega como string com barras; aceita array por segurança.
  const raw = req.query?.path
  const segments = (Array.isArray(raw) ? raw : String(raw || '').split('/'))
    .filter(Boolean)

  if (!segments.length) {
    return res.status(400).json({ error: true, message: 'Missing path' })
  }

  const url = `${UPSTREAM}/${segments.map(encodeURIComponent).join('/')}`

  try {
    const upstream = await fetch(url, { headers: { 'X-API-Key': apiKey } })
    const body = await upstream.text()

    // Cotação não muda a cada segundo — a CDN absorve as repetições e poupa cota.
    if (upstream.ok) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    }

    res.status(upstream.status)
    try {
      res.json(JSON.parse(body))
    } catch {
      // Upstream devolveu algo que não é JSON — não repassa cru para o cliente
      // não quebrar no res.json().
      res.json({ error: true, message: 'Upstream returned non-JSON', status: upstream.status })
    }
  } catch (err) {
    res.status(502).json({ error: true, message: `Proxy error: ${err.message}` })
  }
}
