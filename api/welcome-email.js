// E-mail de boas-vindas, disparado pelo cliente logo após o cadastro.
//
// O destinatário sai do token (nunca do corpo), então o endpoint não serve de
// relay. E é idempotente: o log em notificationLog/welcome garante um envio por
// conta, mesmo que o cliente chame de novo (reload, login Google repetido).
import { applyCors, rateLimit, requireUser } from './_lib/http.js'
import { sendNotificationEmail } from './_lib/mailer.js'
import { alreadySent, markSent } from './_lib/notifyServer.js'

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'Origem não permitida' })
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, res)
  if (!user) return

  const limit = rateLimit(`welcome:${user.uid}`, { max: 3, windowMs: 60_000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Muitas tentativas. Tente de novo em instantes.' })
  }

  if (!user.email) return res.status(400).json({ error: 'Conta sem e-mail' })

  try {
    if (await alreadySent(user.uid, 'welcome')) {
      return res.status(200).json({ success: true, skipped: true })
    }

    // Logo após o cadastro o displayName ainda pode não estar no token — o
    // cliente manda o nome que acabou de definir. Vai escapado no template.
    const name = String(user.name || req.body?.name || '').slice(0, 80)

    await sendNotificationEmail({
      to: user.email,
      type: 'welcome',
      data: { name },
      idempotencyKey: `welcome-${user.uid}`,
    })
    await markSent(user.uid, 'welcome', { type: 'welcome' })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[welcome-email]', err.message)
    return res.status(500).json({ error: 'Não foi possível enviar o e-mail.' })
  }
}
