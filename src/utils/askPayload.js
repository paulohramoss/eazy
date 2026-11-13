// Monta o que vai para /api/ask: os lançamentos em formato compacto e o
// contexto (saldos, cartões, orçamentos, objetivos).
//
// Puro para testar o recorte, que é o que importa aqui: mandar só o
// necessário, e nunca mais que o servidor aceita.

import { addMonths } from './date.js'

export const ASK_MONTHS = 24
export const ASK_MAX_TX = 5000

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export function buildAskData({
  transactions = [], wallets = [], walletBalances = {}, creditCards = [], cardUsed = () => 0,
  budgets = [], goals = [], currency = 'BRL', today,
}) {
  const since = addMonths(today.slice(0, 8) + '01', -(ASK_MONTHS - 1))
  const accountName = new Map([
    ...wallets.map(w => [w.id, w.name]),
    ...creditCards.map(c => [c.id, c.name]),
  ])

  const tx = transactions
    .filter(t => t?.date && t.date >= since && t.status !== 'failed' && Number(t.amount) > 0)
    // Os mais recentes primeiro, para o corte (se houver) cair no passado distante.
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, ASK_MAX_TX)
    .map(t => {
      const row = { d: t.date, n: t.name || '', c: t.category || '', a: round2(t.amount), t: t.type === 'income' ? 'income' : 'expense' }
      if (t.status === 'pending') row.s = 'pending'
      const w = accountName.get(t.cardId) || accountName.get(t.walletId)
      if (w) row.w = w
      return row
    })

  return {
    currency,
    transactions: tx,
    wallets: wallets.map(w => ({ name: w.name, balance: round2(walletBalances[w.id] ?? w.balance) })),
    cards: creditCards.map(c => ({ name: c.name, limit: round2(c.limit), used: round2(cardUsed(c.id)) })),
    budgets: budgets.map(b => ({ category: b.category, limit: round2(b.limit) })),
    goals: goals.map(g => ({ name: g.name, target: round2(g.target), current: round2(g.current), deadline: g.deadline || '' })),
  }
}
