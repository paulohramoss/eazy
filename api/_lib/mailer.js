// Transporte SMTP compartilhado.
//
// As credenciais ficavam hardcoded neste repositório (que é público), o que
// expunha a conta e transformava /api/send-email num relay aberto. Agora vêm de
// env e o handler exige autenticação.
import nodemailer from 'nodemailer'
import { buildHtml, subjectFor } from './emailTemplate.js'

let _transporter = null

function transporter() {
  if (_transporter) return _transporter

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) throw new Error('SMTP_USER/SMTP_PASS não configuradas')

  _transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: { user, pass },
  })
  return _transporter
}

export async function sendNotificationEmail({ to, type = 'test', data = {}, subject }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  const appUrl = (process.env.ALLOWED_ORIGINS || '').split(',')[0]?.trim() || ''

  await transporter().sendMail({
    from: `"EAZY Finance" <${from}>`,
    to,
    subject: subject || subjectFor(type, data),
    html: buildHtml(type, data, { appUrl }),
  })
}
