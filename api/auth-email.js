// E-mails de conta (verificação e redefinição de senha) com o template do app.
//
// O Firebase Auth manda os dele com remetente "project-<número>", texto fixo e
// a URL crua no corpo — parece phishing. Aqui o link é gerado pelo Admin SDK
// (continua sendo o fluxo oficial do Firebase) e só o envelope é nosso.
//
//   POST { type: 'verify' }          autenticado — reenviar confirmação
//   POST { type: 'reset', email }    público     — "esqueci a senha"
import { adminAuth } from './_lib/firebaseAdmin.js'
import { applyCors, rateLimit, requireUser } from './_lib/http.js'
import { appUrl, sendNotificationEmail } from './_lib/mailer.js'

const TEN_MIN = 10 * 60_000

// Depois de confirmar/redefinir, a página do Firebase oferece "Continuar" para
// cá. O domínio precisa estar em Authentication > Settings > Authorized domains.
const actionSettings = () => (appUrl() ? { url: appUrl() } : undefined)

const tooMany = (res, retryAfter) => {
  res.setHeader('Retry-After', String(retryAfter))
  return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' })
}

// Cota do próprio Firebase para geração de links.
const isQuotaError = (err) => /TOO_MANY_ATTEMPTS|EXCEED|too-many-requests/i.test(`${err.code} ${err.message}`)

async function handleVerify(req, res) {
  const user = await requireUser(req, res)
  if (!user) return

  const limit = rateLimit(`verify:${user.uid}`, { max: 3, windowMs: TEN_MIN })
  if (!limit.ok) return tooMany(res, limit.retryAfter)

  if (!user.email) return res.status(400).json({ error: 'Conta sem e-mail' })
  if (user.email_verified) return res.status(200).json({ success: true, skipped: true })

  const verifyUrl = await adminAuth().generateEmailVerificationLink(user.email, actionSettings())
  await sendNotificationEmail({
    to: user.email,
    type: 'verify_email',
    data: { name: user.name || '', verifyUrl },
  })
  return res.status(200).json({ success: true })
}

async function handleReset(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'E-mail inválido' })
  }

  // Público: limita por IP e por destinatário, para a rota não virar canhão de
  // e-mail contra uma conta específica.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const byIp = rateLimit(`reset-ip:${ip}`, { max: 5, windowMs: TEN_MIN })
  if (!byIp.ok) return tooMany(res, byIp.retryAfter)
  const byEmail = rateLimit(`reset-email:${email}`, { max: 3, windowMs: TEN_MIN })
  if (!byEmail.ok) return tooMany(res, byEmail.retryAfter)

  let account
  try {
    account = await adminAuth().getUserByEmail(email)
  } catch (err) {
    // Mesma resposta para conta inexistente: responder diferente transformaria
    // a rota num verificador de e-mails cadastrados.
    if (err.code === 'auth/user-not-found') return res.status(200).json({ success: true })
    throw err
  }

  const resetUrl = await adminAuth().generatePasswordResetLink(email, actionSettings())
  await sendNotificationEmail({
    to: account.email,
    type: 'reset_password',
    data: { name: account.displayName || '', resetUrl },
  })
  return res.status(200).json({ success: true })
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const type = req.body?.type
  try {
    if (type === 'verify') return await handleVerify(req, res)
    if (type === 'reset') return await handleReset(req, res)
    return res.status(400).json({ error: 'Tipo inválido' })
  } catch (err) {
    console.error(`[auth-email:${type}]`, err.code || '', err.message)
    if (isQuotaError(err)) return tooMany(res, 600)
    return res.status(500).json({ error: 'Não foi possível enviar o e-mail.' })
  }
}
