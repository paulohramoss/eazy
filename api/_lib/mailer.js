// Transporte de e-mail compartilhado.
//
// As credenciais ficavam hardcoded neste repositório (que é público), o que
// expunha a conta e transformava /api/send-email num relay aberto. Agora vêm de
// env e o handler exige autenticação.
//
// Provedor principal: Resend (RESEND_API_KEY). O SMTP continua como fallback
// para quem ainda não migrou — sem RESEND_API_KEY, nada muda.
import nodemailer from 'nodemailer'
import { buildHtml, subjectFor } from './emailTemplate.js'

const RESEND_URL = 'https://api.resend.com/emails'

let _transporter = null

function smtpTransporter() {
  if (_transporter) return _transporter

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) throw new Error('Nenhum provedor de e-mail configurado (RESEND_API_KEY ou SMTP_USER/SMTP_PASS)')

  _transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: { user, pass },
  })
  return _transporter
}

// Fetch direto na API REST: evita uma dependência só para um POST.
async function sendViaResend({ from, to, subject, html, idempotencyKey }) {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Retentativa com a mesma chave não gera e-mail duplicado (janela de 24h).
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.message || '' } catch { /* corpo não-JSON */ }
    throw new Error(`Resend ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json()
}

export async function sendNotificationEmail({ to, type = 'test', data = {}, subject, idempotencyKey }) {
  const appUrl = (process.env.ALLOWED_ORIGINS || '').split(',')[0]?.trim() || ''
  const finalSubject = subject || subjectFor(type, data)
  const html = buildHtml(type, data, { appUrl })

  if (process.env.RESEND_API_KEY) {
    // Em teste sem domínio verificado a Resend só aceita onboarding@resend.dev
    // como remetente, e só entrega no e-mail dono da conta.
    const from = process.env.RESEND_FROM || 'EAZY Finance <onboarding@resend.dev>'
    return sendViaResend({ from, to, subject: finalSubject, html, idempotencyKey })
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  return smtpTransporter().sendMail({
    from: `"EAZY Finance" <${from}>`,
    to,
    subject: finalSubject,
    html,
  })
}
