// Job diário: tudo que precisa acontecer sem o app aberto.
//
//   1. gera as transações das recorrências vencidas
//   2. lembra fechamento e vencimento de fatura
//   3. lembrete semanal de objetivos
//   4. relatório semanal (domingo) e mensal (dia 1)
//
// Estes eram os cinco itens marcados "em breve" na tela de Alertas: todos
// dependiam de agendamento, que não existia.
//
// Agendado pelo bloco "crons" do vercel.json. Protegido por CRON_SECRET, então
// também pode ser disparado à mão para testar.
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../_lib/firebaseAdmin.js'
import { isCronRequest } from '../_lib/http.js'
import { advanceISO, cardCycleStartISO, partsInTz, todayISO } from '../_lib/dates.js'
import { alreadySent, deliver, fmtMoney, markSent } from '../_lib/notifyServer.js'

const APP_URL = (process.env.ALLOWED_ORIGINS || '').split(',')[0]?.trim() || ''
const link = (screen) => (APP_URL ? `${APP_URL}/#/${screen}` : undefined)

const byUser = (col, uid) => adminDb().collection(col).where('userId', '==', uid)

// ─── 1. Recorrências ─────────────────────────────────────────────────────────
// Uma regra ativa gera transações até alcançar hoje. O loop tem teto para uma
// regra abandonada há anos não gerar milhares de documentos de uma vez.
async function runRecurrences(uid, today) {
  const snap = await byUser('recurrences', uid).where('active', '==', true).get()
  let created = 0

  for (const docSnap of snap.docs) {
    const rec = docSnap.data()
    let next = rec.nextDate
    if (!next) continue

    const batch = adminDb().batch()
    let guard = 0

    while (next <= today && guard < 60) {
      if (rec.endDate && next > rec.endDate) break

      const txRef = adminDb().collection('transactions').doc()
      batch.set(txRef, {
        name: rec.name,
        amount: rec.amount,
        type: rec.type,
        category: rec.category || 'Outros',
        walletId: rec.walletId || '',
        cardId: rec.cardId || '',
        notes: rec.notes || '',
        date: next,
        status: 'completed',
        recurrenceId: docSnap.id,
        userId: uid,
        allowedUsers: [uid],
        createdAt: FieldValue.serverTimestamp(),
      })

      next = advanceISO(next, rec.frequency || 'monthly')
      guard++
      created++
    }

    if (guard > 0) {
      const finished = rec.endDate && next > rec.endDate
      batch.update(docSnap.ref, {
        nextDate: next,
        lastRunAt: FieldValue.serverTimestamp(),
        ...(finished ? { active: false } : {}),
      })
      await batch.commit()
    }
  }

  return created
}

// ─── 2. Faturas ──────────────────────────────────────────────────────────────

async function runCardReminders(uid, prefs, { iso, day, year, month }) {
  const wantsClosing = prefs.notifCardClosingDay
  const wantsDue = prefs.notifCardDueDay
  if (!wantsClosing && !wantsDue) return 0

  const [cardsSnap, txSnap] = await Promise.all([
    byUser('creditCards', uid).get(),
    byUser('transactions', uid).where('type', '==', 'expense').get(),
  ])
  if (cardsSnap.empty) return 0

  const txs = txSnap.docs.map(d => d.data())
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let sent = 0

  for (const cardDoc of cardsSnap.docs) {
    const card = cardDoc.data()
    const currency = prefs.currency || 'BRL'

    // Um cartão que fecha dia 31 precisa disparar no dia 30 em abril, senão o
    // aviso simplesmente nunca sai nesses meses.
    const closing = Math.min(card.closingDay || 0, lastDayOfMonth)
    const due = Math.min(card.dueDay || 0, lastDayOfMonth)

    const cycleStart = cardCycleStartISO(card.closingDay || 1, iso)
    const total = txs
      .filter(t => t.cardId === cardDoc.id && t.date && t.date >= cycleStart && t.status !== 'failed')
      .reduce((s, t) => s + (t.amount || 0), 0)

    const payload = {
      cardName: card.name,
      amount: total,
      currency,
      link: link('creditcards'),
    }

    if (wantsClosing && closing && day === closing) {
      const key = `card_closing_${cardDoc.id}_${iso}`
      if (!await alreadySent(uid, key)) {
        await deliver({
          uid, prefs, type: 'card_closing',
          title: `Fatura do ${card.name} fecha hoje`,
          body: `Total da fatura: ${fmtMoney(total, currency)}`,
          data: payload,
        })
        await markSent(uid, key)
        sent++
      }
    }

    if (wantsDue && due && day === due) {
      const key = `card_due_${cardDoc.id}_${iso}`
      if (!await alreadySent(uid, key)) {
        await deliver({
          uid, prefs, type: 'card_due',
          title: `Fatura do ${card.name} vence hoje`,
          body: `Fatura de ${fmtMoney(total, currency)} vence hoje`,
          data: payload,
        })
        await markSent(uid, key)
        sent++
      }
    }
  }

  return sent
}

// ─── 3. Lembrete de objetivos ────────────────────────────────────────────────

async function runGoalReminder(uid, prefs, { iso, weekday }) {
  // Padrão segunda-feira; configurável por prefs.notifGoalReminderDay.
  const targetDay = Number(prefs.notifGoalReminderDay ?? 1)
  if (!prefs.notifGoalReminder || weekday !== targetDay) return 0

  const key = `goal_reminder_${iso}`
  if (await alreadySent(uid, key)) return 0

  const snap = await byUser('goals', uid).get()
  const goals = snap.docs
    .map(d => d.data())
    .filter(g => (g.current || 0) < (g.target || 0))
    .map(g => ({
      name: g.name,
      pct: g.target > 0 ? Math.round(((g.current || 0) / g.target) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8)

  if (!goals.length) return 0

  await deliver({
    uid, prefs, type: 'goal_reminder',
    title: 'O progresso dos seus objetivos',
    body: goals.map(g => `${g.name}: ${g.pct}%`).join(' · '),
    data: { goals, link: link('goals') },
  })
  await markSent(uid, key)
  return 1
}

// ─── 4. Relatórios ───────────────────────────────────────────────────────────

function summarize(txs, from, to) {
  const inRange = txs.filter(t =>
    t.date && t.date >= from && t.date <= to && t.status !== 'failed')
  const income = inRange.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)
  const expenses = inRange.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
  return { income, expenses, balance: income - expenses, count: inRange.length }
}

async function runReports(uid, prefs, { iso, weekday, day, year, month }) {
  const isSunday = weekday === 0
  const isFirstOfMonth = day === 1
  const wantsWeekly = prefs.notifWeeklyReport && isSunday
  const wantsMonthly = prefs.notifMonthlyReport && isFirstOfMonth
  if (!wantsWeekly && !wantsMonthly) return 0

  const currency = prefs.currency || 'BRL'
  const txSnap = await byUser('transactions', uid).get()
  const txs = txSnap.docs.map(d => d.data())
  let sent = 0

  if (wantsWeekly) {
    const key = `weekly_report_${iso}`
    if (!await alreadySent(uid, key)) {
      const start = new Date(`${iso}T00:00:00Z`)
      start.setUTCDate(start.getUTCDate() - 6)
      const s = summarize(txs, start.toISOString().slice(0, 10), iso)
      if (s.count > 0) {
        await deliver({
          uid, prefs, type: 'weekly_report',
          title: 'Seu resumo semanal',
          body: `Receitas: ${fmtMoney(s.income, currency)} · Despesas: ${fmtMoney(s.expenses, currency)}`,
          data: {
            income: fmtMoney(s.income, currency),
            expenses: fmtMoney(s.expenses, currency),
            balance: fmtMoney(s.balance, currency),
            currency, link: link('analysis'),
          },
        })
        sent++
      }
      await markSent(uid, key, { transactions: s.count })
    }
  }

  if (wantsMonthly) {
    const key = `monthly_report_${iso}`
    if (!await alreadySent(uid, key)) {
      // Dia 1: o mês fechado é o anterior.
      const prev = new Date(Date.UTC(year, month - 2, 1))
      const py = prev.getUTCFullYear()
      const pm = String(prev.getUTCMonth() + 1).padStart(2, '0')
      const lastDay = new Date(Date.UTC(py, prev.getUTCMonth() + 1, 0)).getUTCDate()
      const s = summarize(txs, `${py}-${pm}-01`, `${py}-${pm}-${lastDay}`)
      if (s.count > 0) {
        await deliver({
          uid, prefs, type: 'monthly_report',
          title: 'Resumo do mês',
          body: `Receitas: ${fmtMoney(s.income, currency)} · Despesas: ${fmtMoney(s.expenses, currency)}`,
          data: {
            income: fmtMoney(s.income, currency),
            expenses: fmtMoney(s.expenses, currency),
            balance: fmtMoney(s.balance, currency),
            currency, link: link('analysis'),
          },
        })
        sent++
      }
      await markSent(uid, key, { transactions: s.count })
    }
  }

  return sent
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!isCronRequest(req)) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  const when = partsInTz()
  const today = todayISO()
  const summary = { date: today, users: 0, recurrences: 0, notifications: 0, errors: [] }

  try {
    const usersSnap = await adminDb().collection('users').get()

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id
      const prefs = userDoc.data()?.prefs || {}
      summary.users++

      // Recorrências valem mesmo sem canal de notificação ligado: elas são
      // lançamento de dinheiro, não aviso.
      try {
        summary.recurrences += await runRecurrences(uid, today)
      } catch (err) {
        summary.errors.push(`${uid}/recurrences: ${err.message}`)
      }

      if (!prefs.emailEnabled && !prefs.pushEnabled) continue

      for (const [label, fn] of [
        ['cards', runCardReminders],
        ['goals', runGoalReminder],
        ['reports', runReports],
      ]) {
        try {
          summary.notifications += await fn(uid, prefs, when)
        } catch (err) {
          summary.errors.push(`${uid}/${label}: ${err.message}`)
        }
      }
    }

    console.log('[cron:daily]', JSON.stringify(summary))
    return res.status(200).json(summary)
  } catch (err) {
    console.error('[cron:daily]', err)
    return res.status(500).json({ error: err.message, summary })
  }
}
