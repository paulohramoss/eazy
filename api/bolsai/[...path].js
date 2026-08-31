// Proxy para a API do Bolsai.
//
// Antes isto era api/bolsai.js, que no roteamento do Vercel só atende
// /api/bolsai exatamente. Chamadas como /api/bolsai/stocks/PETR4/stats caíam no
// 404 HTML do Vercel sem sequer invocar a function, e o front quebrava ao tentar
// dar res.json() nesse HTML. O nome [...path] é o que faz o Vercel casar os
// subpaths e entregá-los em req.query.path.
const UPSTREAM = 'https://api.usebolsai.com/api/v1'

export default async function handler(req, res) {
  const apiKey = process.env.BOLSAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: true, message: 'BOLSAI_API_KEY não configurada' })
  }

  const segments = [].concat(req.query.path || [])
  if (!segments.length) {
    return res.status(400).json({ error: true, message: 'Missing path' })
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const url = `${UPSTREAM}/${segments.map(encodeURIComponent).join('/')}${query}`

  try {
    const upstream = await fetch(url, { headers: { 'X-API-Key': apiKey } })
    const body = await upstream.text()

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
