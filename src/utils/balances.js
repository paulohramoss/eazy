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
