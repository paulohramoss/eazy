import { addDays } from './date.js'

// Regra única de saldo do app. Vive fora do AppContext por ser função pura —
// dá para conferir a conta sem montar o React nem o Firestore.

/**
 * Saldo e movimentação de cada carteira acumulados até uma data (inclusive).
 *
 * @param wallets  carteiras, cada uma com id e balance (saldo inicial)
 * @param txs      transações já filtradas (sem as falhadas)
 * @param cutoff   data ISO 'YYYY-MM-DD'. Sem cutoff, soma tudo — inclusive
 *                 parcelas e recorrências com data futura, ou seja, a projeção.
 * @returns        { [walletId]: { balance, income, expenses } }
 *
 * Transação sem data fica de fora quando há cutoff: não dá para dizer se entra.
 */
export function walletStats(wallets, txs, cutoff) {
  return wallets.reduce((acc, w) => {
    const own = txs.filter(t =>
      t.walletId === w.id && (!cutoff || (t.date && t.date <= cutoff)))

    let income = 0
    let expenses = 0
    for (const t of own) {
      if (t.type === 'income') income += t.amount || 0
      else if (t.type === 'expense') expenses += t.amount || 0
    }

    acc[w.id] = { balance: (w.balance || 0) + income - expenses, income, expenses }
    return acc
  }, {})
}

/**
 * Saldo total no fim de cada dia de um intervalo, considerando todas as carteiras.
 *
 * Faz uma passada só: parte do saldo acumulado até a véspera de `fromIso` e vai
 * somando o líquido de cada dia. Chamar walletStats por dia daria o mesmo
 * resultado relendo todas as transações 42 vezes numa grade de mês.
 *
 * @returns { [dia ISO]: saldo }
 */
export function dailyBalances(wallets, txs, fromIso, toIso) {
  const opening = Object.values(walletStats(wallets, txs, addDays(fromIso, -1)))
    .reduce((sum, st) => sum + st.balance, 0)

  const net = {}
  for (const t of txs) {
    if (!t.date || t.date < fromIso || t.date > toIso) continue
    const delta = t.type === 'income' ? (t.amount || 0)
      : t.type === 'expense' ? -(t.amount || 0)
      : 0
    net[t.date] = (net[t.date] || 0) + delta
  }

  const out = {}
  let running = opening
  for (let day = fromIso; day <= toIso; day = addDays(day, 1)) {
    running += net[day] || 0
    out[day] = running
  }
  return out
}
