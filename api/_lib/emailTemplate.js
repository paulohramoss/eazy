// Template dos e-mails (notificações e conta). Vive aqui (e não dentro do
// handler) para o job agendado em api/cron/ e os endpoints de conta reusarem
// exatamente o mesmo HTML.
//
// Layout em <table> com estilos inline: é o que Gmail, Outlook e Apple Mail
// renderizam de forma consistente. <div> com flex/grid quebra em vários deles.

// Os dados vêm do usuário (nome de transação, de cartão, de objetivo). Sem
// escape, um nome como `<img src=x onerror=...>` entraria cru no e-mail.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const C = {
  ink: '#0A0A0A', text: '#3D3D3D', muted: '#8A8A8A', line: '#EFEFEF',
  page: '#FFF9EF', card: '#FFFFFF', lime: '#CFF330', link: '#0053EF',
}

const ICONS = {
  transaction: '💸', budget: '⚠️', card_limit: '💳', card_closing: '📅',
  card_due: '🔔', goal_reached: '🏆', goal_reminder: '🎯',
  weekly_report: '📊', monthly_report: '📈', test: '🔔',
  welcome: '👋', verify_email: '✉️', reset_password: '🔑',
}

// E-mails de conta: o usuário não "ativou" nada, e o rodapé de preferências
// de notificação não faz sentido neles.
const ACCOUNT_TYPES = new Set(['welcome', 'verify_email', 'reset_password'])

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
  welcome:        d => d.verifyUrl ? 'Confirme seu e-mail e comece no EAZY Finance' : 'Boas-vindas ao EAZY Finance',
  verify_email:   () => 'Confirme seu e-mail — EAZY Finance',
  reset_password: () => 'Redefinição de senha — EAZY Finance',
}

export function subjectFor(type, data = {}) {
  const fn = SUBJECTS[type] || SUBJECTS.test
  return fn(data)
}

// Conteúdo de cada tipo. `body` é HTML já escapado; `preheader` é o texto que
// aparece ao lado do assunto na caixa de entrada; `cta` vira o botão.
function content(type, data, appUrl) {
  const amount = data.amount != null
    ? Number(data.amount).toLocaleString('pt-BR', { style: 'currency', currency: data.currency || 'BRL' })
    : null
  const hi = (name) => name ? `, ${esc(name)}` : ''
  const openApp = appUrl ? { label: 'Abrir o EAZY', url: appUrl } : null

  const map = {
    transaction: {
      title: data.txType === 'income' ? 'Nova receita registrada' : 'Nova despesa registrada',
      body: `<b>${esc(data.name)}</b>${amount ? ` — ${esc(amount)}` : ''}${data.category ? `<br><span style="color:${C.muted};font-size:13px">${esc(data.category)}</span>` : ''}`,
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
      title: `Objetivo "${esc(data.goalName)}" atingido!`,
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
      title: 'Seu resumo semanal',
      body: `Receitas: <b>${esc(data.income || 'R$ 0')}</b> · Despesas: <b>${esc(data.expenses || 'R$ 0')}</b> · Saldo: <b>${esc(data.balance || 'R$ 0')}</b>`,
    },
    monthly_report: {
      title: 'Seu mês em resumo',
      body: `Receitas: <b>${esc(data.income || 'R$ 0')}</b> · Despesas: <b>${esc(data.expenses || 'R$ 0')}</b> · Saldo: <b>${esc(data.balance || 'R$ 0')}</b>`,
    },
    test: {
      title: 'Notificação de teste',
      body: 'Suas notificações por e-mail estão funcionando corretamente! ✅',
    },
    welcome: {
      title: `Boas-vindas${hi(data.name)}!`,
      preheader: data.verifyUrl
        ? 'Falta só confirmar seu e-mail para deixar a conta pronta.'
        : 'Sua conta está pronta. Bora organizar as finanças?',
      body: `Que bom ter você por aqui. O EAZY reúne carteiras, cartões, orçamento e objetivos num lugar só, para você enxergar seu dinheiro sem planilha.`
        + (data.verifyUrl
          ? `<br><br>Antes de começar, confirme que este e-mail é seu. Isso protege sua conta e garante que você consiga recuperar a senha se precisar.`
          : `<br><br>Comece cadastrando uma carteira e suas primeiras transações — o resto a gente organiza.`),
      cta: data.verifyUrl ? { label: 'Confirmar meu e-mail', url: data.verifyUrl } : openApp,
      note: data.verifyUrl ? 'O link de confirmação expira em alguns dias. Se expirar, peça outro pelo aviso no topo do app.' : null,
    },
    verify_email: {
      title: `Confirme seu e-mail${hi(data.name)}`,
      preheader: 'Um clique para confirmar que este endereço é seu.',
      body: 'Recebemos um pedido para confirmar este endereço na sua conta do EAZY Finance. Clique no botão abaixo para concluir.',
      cta: { label: 'Confirmar meu e-mail', url: data.verifyUrl },
      note: 'Se você não criou uma conta no EAZY Finance, ignore este e-mail — nenhuma conta será ativada.',
    },
    reset_password: {
      title: `Redefinir sua senha${hi(data.name)}`,
      preheader: 'Use o link para criar uma nova senha. Ele expira em 1 hora.',
      body: 'Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova. O link vale por <b>1 hora</b> e só pode ser usado uma vez.',
      cta: { label: 'Criar nova senha', url: data.resetUrl },
      note: 'Não foi você? Ignore este e-mail. Sua senha atual continua valendo e ninguém consegue alterá-la sem este link.',
    },
  }

  return map[type] || map.test
}

const button = ({ label, url }) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px">
  <tr><td style="border-radius:12px;background:${C.ink}">
    <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px">${esc(label)}</a>
  </td></tr>
</table>`

export function buildEmail(type, data = {}, { appUrl = '' } = {}) {
  const msg = content(type, data, appUrl)
  const isAccount = ACCOUNT_TYPES.has(type)
  const icon = ICONS[type] || '🔔'
  const prefsUrl = appUrl ? `${appUrl}/#/alerts` : ''
  const subject = subjectFor(type, data)
  // Botão de link de ação (verificar/redefinir) sempre leva o link reserva em
  // texto: alguns clientes bloqueiam botões e o usuário precisa poder copiar.
  const actionLink = isAccount && msg.cta && msg.cta.url !== appUrl ? msg.cta.url : null

  const footer = isAccount
    ? `Você recebe este e-mail por causa de uma ação na sua conta do EAZY Finance.<br>
       <b style="color:${C.text}">O EAZY nunca pede sua senha, código ou dados bancários por e-mail.</b>`
    : `Você recebe este e-mail porque ativou as notificações no EAZY Finance.
       ${prefsUrl ? `<br><a href="${esc(prefsUrl)}" style="color:${C.link};text-decoration:none">Gerenciar preferências</a>` : ''}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(msg.preheader || '')}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:'Inter',-apple-system,'Segoe UI',Roboto,Arial,sans-serif">

    <tr><td style="padding:0 4px 20px">
      <span style="font-size:22px;font-weight:800;color:${C.ink};letter-spacing:-0.6px">EAZY<span style="color:${C.ink};background:${C.lime};border-radius:4px;padding:0 3px;margin-left:2px">.</span></span>
      <span style="font-size:12px;color:${C.muted};margin-left:8px">Finanças pessoais</span>
    </td></tr>

    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:36px 32px">
      <div style="font-size:36px;line-height:1;margin-bottom:16px">${icon}</div>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:800;color:${C.ink};letter-spacing:-0.4px">${msg.title}</h1>
      <div style="font-size:15px;line-height:1.65;color:${C.text}">${msg.body}</div>
      ${msg.cta ? button(msg.cta) : ''}
      ${actionLink ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${C.muted}">Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="${esc(actionLink)}" style="color:${C.link};word-break:break-all">${esc(actionLink)}</a></p>` : ''}
      ${data.note ? `<p style="margin:16px 0 0;font-size:13px;color:${C.muted};font-style:italic">${esc(data.note)}</p>` : ''}
      ${msg.note ? `<p style="margin:24px 0 0;padding:14px 16px;background:${C.page};border-radius:12px;font-size:13px;line-height:1.55;color:${C.text}">${msg.note}</p>` : ''}
    </td></tr>

    <tr><td style="padding:24px 8px 0;font-size:12px;line-height:1.6;color:${C.muted};text-align:center">
      ${footer}
      <br><br>© ${new Date().getFullYear()} EAZY Finance${appUrl ? ` · <a href="${esc(appUrl)}" style="color:${C.muted}">${esc(appUrl.replace(/^https?:\/\//, ''))}</a>` : ''}
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`

  // Versão texto: filtros de spam pontuam mal e-mail só-HTML, e alguns
  // leitores (relógio, leitor de tela, cliente em modo texto) só mostram esta.
  const strip = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
  const text = [
    'EAZY Finance',
    '',
    strip(msg.title),
    '',
    strip(msg.body),
    msg.cta ? `\n${msg.cta.label}: ${msg.cta.url}` : '',
    data.note ? `\n${data.note}` : '',
    msg.note ? `\n${strip(msg.note)}` : '',
    '',
    '—',
    strip(footer).replace(/\s*\n\s*/g, '\n'),
  ].join('\n')

  return { subject, html, text }
}

// Mantido para quem só precisa do HTML.
export const buildHtml = (type, data, opts) => buildEmail(type, data, opts).html
