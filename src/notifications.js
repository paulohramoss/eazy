import { getFirebaseMessaging, getToken, onMessage, VAPID_KEY } from './firebase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const API_BASE = import.meta.env.DEV ? 'http://localhost:5175' : ''

// ─── Email via Vercel function ────────────────────────────────────────────────

export async function sendEmail({ to, type, data = {} }) {
  if (!to) return { ok: false, error: 'Sem e-mail destinatário' }
  try {
    const res = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, data }),
    })
    const json = await res.json()
    return res.ok ? { ok: true } : { ok: false, error: json.error }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── Push — Solicitar permissão e registrar token FCM ────────────────────────

export async function requestPushPermission() {
  if (!('Notification' in window)) return { ok: false, error: 'Navegador não suporta notificações' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'Permissão negada pelo usuário' }

  try {
    const messaging = getFirebaseMessaging()
    if (!messaging) return { ok: false, error: 'FCM não disponível' }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    })
    return { ok: true, token }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── Push local (app aberto) ──────────────────────────────────────────────────

export function showLocalNotification(title, body, icon = '/logo.png') {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon })
}

// ─── Ouvir mensagens FCM em foreground ───────────────────────────────────────

export function listenForegroundMessages(callback) {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}

// ─── Dispatcher central ───────────────────────────────────────────────────────
// Chame esta função em qualquer evento do app.
// settings: objeto de settings do usuário (canais habilitados, e-mail, etc.)

export async function notify({ type, data = {}, settings }) {
  const { pushEnabled, emailEnabled, emailAddress } = settings

  const notifMap = {
    transaction:   settings.notifNewTransaction,
    transaction_pending: settings.notifPendingTransaction,
    large_expense: settings.notifLargeExpense,
    budget_near:   settings.notifBudgetNearLimit,
    budget_over:   settings.notifBudgetExceeded,
    card_near:     settings.notifCardNearLimit,
    card_limit:    settings.notifCardLimitReached,
    card_closing:  settings.notifCardClosingDay,
    card_due:      settings.notifCardDueDay,
    goal_reached:  settings.notifGoalReached,
    goal_reminder: settings.notifGoalReminder,
    weekly_report: settings.notifWeeklyReport,
    monthly_report:settings.notifMonthlyReport,
    test:          true,
  }

  if (!notifMap[type]) return

  const titles = {
    transaction:   `${data.txType === 'income' ? 'Nova receita' : 'Nova despesa'}: ${data.name}`,
    transaction_pending: `Transação pendente: ${data.name}`,
    large_expense: `Despesa alta: ${fmt(data.amount)}`,
    budget_near:   `Orçamento de ${data.category} em ${data.pct}%`,
    budget_over:   `Orçamento de ${data.category} estourado!`,
    card_near:     `Cartão ${data.cardName} em ${data.pct}% do limite`,
    card_limit:    `Cartão ${data.cardName}: limite atingido!`,
    card_closing:  `Fatura do ${data.cardName} fecha hoje`,
    card_due:      `Fatura do ${data.cardName} vence hoje`,
    goal_reached:  `Objetivo "${data.goalName}" concluído!`,
    goal_reminder: `Progresso dos objetivos`,
    weekly_report: `Seu resumo semanal`,
    monthly_report:`Resumo de ${data.month || 'mês anterior'}`,
    test:          `Teste de notificação — EAZY Finance`,
  }

  const bodies = {
    transaction:   data.amount ? fmt(data.amount) : '',
    transaction_pending: `${data.amount ? fmt(data.amount) : ''} aguardando confirmação`,
    large_expense: `${data.name} — ${fmt(data.amount)}`,
    budget_near:   `Você usou ${data.pct}% do limite de ${data.category}`,
    budget_over:   `Limite de ${data.category} ultrapassado`,
    card_near:     `Disponível: ${fmt(data.available)}`,
    card_limit:    `Limite de ${fmt(data.limit)} esgotado`,
    card_closing:  `Total da fatura: ${fmt(data.amount)}`,
    card_due:      `Fatura de ${fmt(data.amount)} vence hoje`,
    goal_reached:  `Meta de ${fmt(data.amount)} atingida`,
    goal_reminder: `Veja o progresso dos seus objetivos`,
    weekly_report: `Receitas: ${data.income} · Despesas: ${data.expenses}`,
    monthly_report:`Receitas: ${data.income} · Despesas: ${data.expenses}`,
    test:          `Suas notificações estão configuradas corretamente!`,
  }

  const title = titles[type] || titles.test
  const body  = bodies[type]  || ''

  // Push local (browser Notification API)
  if (pushEnabled) {
    showLocalNotification(title, body)
  }

  // E-mail
  if (emailEnabled && emailAddress) {
    // Mapeia tipo composto para tipo do template de e-mail
    const emailType = type.replace('_near', '_limit').replace('_over', '')
      || type === 'budget_near' ? 'budget'
      : type === 'budget_over'  ? 'budget'
      : type === 'card_near'    ? 'card_limit'
      : type === 'card_limit'   ? 'card_limit'
      : type
    sendEmail({ to: emailAddress, type: emailType, data }).catch(() => {})
  }
}
