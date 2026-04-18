export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/bolsai/, '') || '/'
  const url  = `https://api.usebolsai.com/api/v1${path}`

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': '***CREDENCIAL_REMOVIDA***' },
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch {
    res.status(500).json({ error: true, message: 'Proxy error' })
  }
}
