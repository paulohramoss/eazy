// Cliente HTTP para as funções serverless do próprio app.
//
// Elas passaram a exigir Authorization: Bearer <Firebase ID token> — antes
// /api/send-email aceitava qualquer requisição e /api/bolsai gastava a cota da
// chave para qualquer visitante.
import { auth } from '../firebase'

// Em dev o front roda no Vite (5173) e as funções no `vercel dev` (5175).
const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE || 'http://localhost:5175')
  : ''

async function authHeader() {
  const user = auth.currentUser
  if (!user) return {}
  // getIdToken cuida do refresh sozinho quando o token está perto de expirar.
  return { Authorization: `Bearer ${await user.getIdToken()}` }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(await authHeader()),
    ...options.headers,
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

export async function apiPost(path, body) {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
  let json = null
  try { json = await res.json() } catch { /* resposta vazia ou não-JSON */ }
  if (!res.ok) throw new Error(json?.error || json?.message || `Erro ${res.status}`)
  return json
}
