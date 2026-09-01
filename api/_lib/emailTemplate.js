// Template dos e-mails de notificação. Vive aqui (e não dentro do handler) para
// o job agendado em api/cron/ poder reusar exatamente o mesmo HTML.

// Os dados vêm do usuário (nome de transação, de cartão, de objetivo). Sem
// escape, um nome como `<img src=x onerror=...>` entraria cru no e-mail.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const ICONS = {
  transaction: '💸', budget: '⚠️', card_limit: '💳', card_closing: '📅',
  card_due: '🔔', goal_reached: '🏆', goal_reminder: '🎯',
  weekly_report: '📊', monthly_report: '📈', test: '🔔',
}

export const SUBJECTS = {
  transaction:    d => `💸 Nova ${d.txType === 'income' ? 'receita' : 'despesa'} registrada`,
  budget:         d => `⚠️ Orçamento de ${d.category} ${d.exceeded ? 'estourado' : 'próximo ao limite'}`,
  card_limit:     d => `💳 Cartão ${d.cardName} — limite ${d.exceeded ? 'atingido' : 'próximo'}`,
  card_closing:   d => `📅 Fatura do ${d.cardName} fecha hoje`,
  card_due:       d => `🔔 Fatura do ${d.cardName} vence ${d.inDays ? `em ${d.inDays} dia(s)` : 'hoje'}`,
  goal_reached:   d => `🏆 Objetivo "${d.goalName}" concluído!`,
  goal_reminder:  () => `🎯 O progresso dos seus objetivos`,
  weekly_report:  () => `📊 Seu resumo semanal — EAZY Finance`,
  monthly_report: () => `📈 Resumo do mês — EAZY Finance`,
  test:           () => `🔔 Teste de notificação — EAZY Finance`,
}

export function subjectFor(type, data = {}) {
  const fn = SUBJECTS[type] || SUBJECTS.test
  return fn(data)
}

export function buildHtml(type, data = {}, { appUrl = '' } = {}) {
  const icon = ICONS[type] || '🔔'
  const amount = data.amount != null
    ? Number(data.amount).toLocaleString('pt-BR', { style: 'currency', currency: data.currency || 'BRL' })
    : null

  const messages = {
    transaction: {
      title: data.txType === 'income' ? 'Nova receita registrada' : 'Nova despesa registrada',
      body: `<b>${esc(data.name)}</b>${amount ? ` — ${esc(amount)}` : ''}${data.category ? `<br><span style="color:#888;font-size:13px">${esc(data.category)}</span>` : ''}`,
    },
    budget: {
      title: `Orçamento de ${esc(data.category)} ${data.exceeded ? 'estourado' : 'quase no limite'}`,
      body: `Você ${data.exceeded ? 'ultrapassou' : 'utilizou'} <b>${esc(data.pct)}%</b> do orçamento de <b>${esc(data.category)}</b>.${amount ? `<br>Limite: ${esc(amount)}` : ''}`,
    },
    card_limit: {
      title: `Cartão ${esc(data.cardName)} — limite ${data.exceeded ? 'atingido' : 'próximo'}`,
      body: `Você utilizou <b>${esc(data.pct)}%</b> do limite do cartão <b>${esc(data.cardName)}</b>.${amount ? `<br>Limite: ${esc(amount)}` : ''}`,
    },
    card_closing: {
      title: `Fatura do cartão ${esc(data.cardName)} fecha hoje`,
      body: `O cartão <b>${esc(data.cardName)}</b> tem fatura com fechamento hoje.${amount ? `<br>Total da fatura: ${esc(amount)}` : ''}`,
    },
    card_due: {
      title: `Fatura do cartão ${esc(data.cardName)} vence ${data.inDays ? `em ${esc(data.inDays)} dia(s)` : 'hoje'}`,
      body: `O cartão <b>${esc(data.cardName)}</b> tem fatura a vencer.${amount ? `<br>Total: ${esc(amount)}` : ''}`,
    },
    goal_reached: {
      title: `🎉 Objetivo "${esc(data.goalName)}" atingido!`,
      body: `Parabéns! Você concluiu o objetivo <b>${esc(data.goalName)}</b>.${amount ? `<br>Total acumulado: ${esc(amount)}` : ''}`,
    },
    goal_reminder: {
      title: 'O progresso dos seus objetivos',
      body: (data.goals || []).length
        ? `<ul style="margin:0;padding-left:18px">${(data.goals || []).map(g =>
            `<li style="margin-bottom:6px">${esc(g.name)} — <b>${esc(g.pct)}%</b></li>`).join('')}</ul>`
        : 'Você ainda não tem objetivos em andamento.',
    },
    weekly_report: {
      title: 'Resumo semanal — EAZY Finance',
      body: `Receitas: <b>${esc(data.income || 'R$ 0')}</b> · Despesas: <b>${esc(data.expenses || 'R$ 0')}</b> · Saldo: <b>${esc(data.balance || 'R$ 0')}</b>`,
    },
    monthly_report: {
      title: 'Resumo mensal — EAZY Finance',
      body: `Seu mês financeiro em resumo.<br>Receitas: <b>${esc(data.income || 'R$ 0')}</b> · Despesas: <b>${esc(data.expenses || 'R$ 0')}</b> · Saldo: <b>${esc(data.balance || 'R$ 0')}</b>`,
    },
    test: {
      title: 'Notificação de teste — EAZY Finance',
      body: 'Suas notificações por e-mail estão funcionando corretamente! ✅',
    },
  }

  const msg = messages[type] || messages.test
  const prefsUrl = appUrl ? `${appUrl}/#/alerts` : '#'

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#FFF9EF;margin:0;padding:0;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #E5E5E5;overflow:hidden;">
    <div style="background:#0A0A0A;padding:24px 32px;">
      <span style="font-size:28px">${icon}</span>
      <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px">EAZY<span style="color:#CFF330">.</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">Finanças pessoais</div>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0A0A0A;letter-spacing:-0.3px">${msg.title}</h2>
      <div style="margin:0;font-size:14px;color:#555;line-height:1.6">${msg.body}</div>
      ${data.note ? `<p style="margin:12px 0 0;font-size:13px;color:#888;font-style:italic">${esc(data.note)}</p>` : ''}
    </div>
    <div style="padding:20px 32px;border-top:1px solid #F2F2F2;font-size:12px;color:#888;text-align:center;">
      Você recebe este e-mail porque ativou as notificações no EAZY Finance.<br>
      <a href="${esc(prefsUrl)}" style="color:#0053EF;text-decoration:none">Gerenciar preferências</a>
    </div>
  </div>
</body></html>`
}
