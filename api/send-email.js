// Envio de e-mail de notificação.
//
// Só o próprio usuário autenticado dispara, e só para um endereço que já seja
// dele — o do login ou o configurado nas preferências. Sem essa checagem o
// endpoint funcionava como relay: qualquer origem mandava qualquer e-mail
// assinado como "EAZY Finance".
import { applyCors, rateLimit, requireUser } from './_lib/http.js'
import { adminDb } from './_lib/firebaseAdmin.js'
import { sendNotificationEmail } from './_lib/mailer.js'

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return

  const limit = rateLimit(`email:${user.uid}`, { max: 20, windowMs: 60_000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Muitos e-mails em pouco tempo. Tente de novo em instantes.' })
  }

  const { to, type = 'test', data = {}, subject } = req.body || {}
  if (!to) return res.status(400).json({ error: 'Recipient email required' })

  // Endereços aceitos: o do login e o salvo nas preferências do próprio usuário.
  const allowed = new Set()
  if (user.email) allowed.add(user.email.toLowerCase())
  try {
    const snap = await adminDb().collection('users').doc(user.uid).get()
    const configured = snap.data()?.prefs?.emailAddress
    if (configured) allowed.add(String(configured).toLowerCase())
  } catch {
    // Sem o doc de prefs sobra o e-mail do login — suficiente para não travar.
  }

  if (!allowed.has(String(to).toLowerCase())) {
    return res.status(403).json({
      error: 'Só é possível enviar para o e-mail da própria conta. Salve o endereço nas preferências primeiro.',
    })
  }

  try {
    await sendNotificationEmail({ to, type, data, subject })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email]', err.message)
    // A mensagem do nodemailer pode conter detalhe de credencial/host.
    return res.status(500).json({ error: 'Não foi possível enviar o e-mail.' })
  }
}
