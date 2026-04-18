export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/bolsai/, '') || '/'
  const url  = `https://api.usebolsai.com/api/v1${path}`

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': 'sk_a6a7a04e94be0d894314e6a7747c58342b01f8c8285c5d12' },
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch {
    res.status(500).json({ error: true, message: 'Proxy error' })
  }
}
