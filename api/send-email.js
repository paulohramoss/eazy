import nodemailer from 'nodemailer'

const SENDER_EMAIL = 'eazyfinance55@gmail.com'
const SENDER_PASS  = 'eazyfinance12'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SENDER_EMAIL, pass: SENDER_PASS },
})

function buildHtml(type, data) {
  const styles = `
    font-family:'Inter',Arial,sans-serif;background:#FFF9EF;margin:0;padding:0;
  `
  const card = `
    max-width:520px;margin:32px auto;background:#fff;border-radius:16px;
    border:1px solid #E5E5E5;overflow:hidden;
  `
  const header = `
    background:#0A0A0A;padding:24px 32px;display:flex;align-items:center;gap:12px;
  `
  const body = `padding:28px 32px;`
  const footer = `
    padding:20px 32px;border-top:1px solid #F2F2F2;
    font-size:12px;color:#888;text-align:center;
  `

  const icons = {
    transaction:   '💸',
    budget:        '⚠️',
    card_limit:    '💳',
    card_closing:  '📅',
    card_due:      '🔔',
    goal_reached:  '🏆',
    weekly_report: '📊',
    monthly_report:'📈',
    test:          '🔔',
  }

  const icon = icons[type] || '🔔'
  const amount = data.amount
    ? Number(data.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null

  const messages = {
    transaction: {
      title: data.txType === 'income' ? 'Nova receita registrada' : 'Nova despesa registrada',
      body: `<b>${data.name}</b>${amount ? ` — ${amount}` : ''}${data.category ? `<br><span style="color:#888;font-size:13px">${data.category}</span>` : ''}`,
    },
    budget: {
      title: `Orçamento de ${data.category} ${data.exceeded ? 'estourado' : 'quase no limite'}`,
      body: `Você ${data.exceeded ? 'ultrapassou' : 'utilizou'} <b>${data.pct}%</b> do orçamento de <b>${data.category}</b>.${amount ? `<br>Limite: ${amount}` : ''}`,
    },
    card_limit: {
      title: `Cartão ${data.cardName} — limite ${data.exceeded ? 'atingido' : 'próximo'}`,
      body: `Você utilizou <b>${data.pct}%</b> do limite do cartão <b>${data.cardName}</b>.${amount ? `<br>Limite: ${amount}` : ''}`,
    },
    card_closing: {
      title: `Fatura do cartão ${data.cardName} fecha hoje`,
      body: `O cartão <b>${data.cardName}</b> tem fatura com fechamento hoje.${amount ? `<br>Total da fatura: ${amount}` : ''}`,
    },
    card_due: {
      title: `Fatura do cartão ${data.cardName} vence hoje`,
      body: `O cartão <b>${data.cardName}</b> tem fatura com vencimento hoje.${amount ? `<br>Total: ${amount}` : ''}`,
    },
    goal_reached: {
      title: `🎉 Objetivo "${data.goalName}" atingido!`,
      body: `Parabéns! Você concluiu o objetivo <b>${data.goalName}</b>.${amount ? `<br>Total acumulado: ${amount}` : ''}`,
    },
    weekly_report: {
      title: 'Resumo semanal — EAZY Finance',
      body: `Receitas: <b>${data.income || 'R$ 0'}</b> · Despesas: <b>${data.expenses || 'R$ 0'}</b> · Saldo: <b>${data.balance || 'R$ 0'}</b>`,
    },
    monthly_report: {
      title: 'Resumo mensal — EAZY Finance',
      body: `Seu mês financeiro em resumo.<br>Receitas: <b>${data.income || 'R$ 0'}</b> · Despesas: <b>${data.expenses || 'R$ 0'}</b>`,
    },
    test: {
      title: 'Notificação de teste — EAZY Finance',
      body: 'Suas notificações por e-mail estão funcionando corretamente! ✅',
    },
  }

  const msg = messages[type] || messages.test

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${styles}">
  <div style="${card}">
    <div style="${header}">
      <span style="font-size:28px">${icon}</span>
      <div>
        <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px">EAZY<span style="color:#CFF330">.</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">Finanças pessoais</div>
      </div>
    </div>
    <div style="${body}">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0A0A0A;letter-spacing:-0.3px">${msg.title}</h2>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6">${msg.body}</p>
      ${data.note ? `<p style="margin:12px 0 0;font-size:13px;color:#888;font-style:italic">${data.note}</p>` : ''}
    </div>
    <div style="${footer}">
      Você recebe este e-mail porque ativou as notificações no EAZY Finance.<br>
      <a href="#" style="color:#0053EF;text-decoration:none">Gerenciar preferências</a>
    </div>
  </div>
</body></html>`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, type = 'test', data = {}, subject } = req.body || {}

  if (!to) return res.status(400).json({ error: 'Recipient email required' })

  const subjects = {
    transaction:   `💸 Nova ${data.txType === 'income' ? 'receita' : 'despesa'} registrada`,
    budget:        `⚠️ Orçamento de ${data.category} ${data.exceeded ? 'estourado' : 'próximo ao limite'}`,
    card_limit:    `💳 Cartão ${data.cardName} — limite ${data.exceeded ? 'atingido' : 'próximo'}`,
    card_closing:  `📅 Fatura do ${data.cardName} fecha hoje`,
    card_due:      `🔔 Fatura do ${data.cardName} vence hoje`,
    goal_reached:  `🏆 Objetivo "${data.goalName}" concluído!`,
    weekly_report: `📊 Seu resumo semanal — EAZY Finance`,
    monthly_report:`📈 Resumo do mês — EAZY Finance`,
    test:          `🔔 Teste de notificação — EAZY Finance`,
  }

  try {
    await transporter.sendMail({
      from: `"EAZY Finance" <${SENDER_EMAIL}>`,
      to,
      subject: subject || subjects[type] || subjects.test,
      html: buildHtml(type, data),
    })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
