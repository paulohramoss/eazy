// Helpers compartilhados pelas funções serverless: CORS, autenticação e um
// rate limit simples.
import { adminAuth } from './firebaseAdmin.js'

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Antes daqui o handler de e-mail respondia com Access-Control-Allow-Origin: *
// e sem auth — qualquer site podia disparar e-mails pela conta do projeto.
// A lista vem de ALLOWED_ORIGINS; em dev o Vite (5173/5175) entra sozinho.

const DEV_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175',
]

function allowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const isProd = process.env.VERCEL_ENV === 'production'
  const preview = process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []
  return isProd ? [...fromEnv, ...preview] : [...fromEnv, ...preview, ...DEV_ORIGINS]
}

// Devolve false quando a origem não é permitida — o handler deve parar aí.
export function applyCors(req, res) {
  const origin = req.headers.origin
  const list = allowedOrigins()

  // Requisição sem Origin (curl, server-to-server, o próprio cron) não é um
  // cenário de CSRF: o navegador sempre manda Origin em cross-origin.
  if (!origin) return true

  if (!list.includes(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
  return true
}

// ─── Autenticação ─────────────────────────────────────────────────────────────

// Verifica o Firebase ID token do header Authorization.
// Devolve o token decodificado, ou null (já tendo respondido 401).
export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    res.status(401).json({ error: 'Autenticação necessária' })
    return null
  }
  try {
    return await adminAuth().verifyIdToken(match[1])
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return null
  }
}

// Endpoints de cron: a Vercel envia Authorization: Bearer <CRON_SECRET>.
export function isCronRequest(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.authorization || ''
  return header === `Bearer ${secret}`
}

// ─── Rate limit ───────────────────────────────────────────────────────────────
// Em memória, por isolate. Não é um limite global — a Vercel roda vários
// isolates em paralelo — mas corta o abuso barato de um cliente só. Um limite
// forte exigiria um store compartilhado (Redis/Firestore).

const hits = new Map()

export function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    // Poda oportunista: sem isto o Map cresce sem teto num isolate longevo.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    return { ok: true, remaining: max - 1 }
  }

  entry.count += 1
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { ok: true, remaining: max - entry.count }
}
