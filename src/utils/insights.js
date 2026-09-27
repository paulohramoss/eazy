// insights — transforma os números do mês em uma frase.
//
// A Visão Geral mostrava 4 cartões e 2 gráficos: correto, mas é painel de
// contador. A pergunta real de quem abre o app não é "qual minha taxa de
// poupança", é "tô bem ou tô ferrado esse mês?". Aqui ela é respondida.
//
// Devolve chave de tradução + parâmetros, nunca texto pronto: o app é
// trilíngue e a frase precisa atravessar o dicionário como todo o resto.

/** Dias que ainda faltam para o mês virar, contando hoje. */
export function daysLeftInMonth(todayIso) {
  const [y, m, d] = String(todayIso).split('-').map(Number)
  if (!y || !m || !d) return 0
  // Dia 0 do mês seguinte é o último dia deste — evita a tabela de 30/31/29.
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Math.max(lastDay - d + 1, 1)
}

const monthKey = (iso) => String(iso).slice(0, 7)

/**
 * Gasto médio por categoria nos meses anteriores (o mês corrente fica de fora:
 * ele está pela metade e puxaria a média para baixo).
 *
 * A média é por mês *em que a categoria apareceu*, não por mês do calendário —
 * senão quem compra remédio a cada dois meses parece estar sempre estourando.
 */
export function categoryAverages(transactions = [], opts = {}) {
  const { today = new Date().toISOString().slice(0, 10), months = 6, minMonths = 2 } = opts
  const current = monthKey(today)

  const [y, m] = current.split('-').map(Number)
  const window = new Set()
  for (let i = 1; i <= months; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    window.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const byCategory = new Map()
  for (const tx of transactions) {
    if (tx?.type !== 'expense' || tx.status === 'failed' || !tx.date) continue
    const key = monthKey(tx.date)
    if (!window.has(key)) continue

    let entry = byCategory.get(tx.category)
    if (!entry) { entry = { total: 0, months: new Set() }; byCategory.set(tx.category, entry) }
    entry.total += Number(tx.amount) || 0
    entry.months.add(key)
  }

  const out = {}
  for (const [category, { total, months: seen }] of byCategory) {
    if (seen.size < minMonths) continue
    out[category] = total / seen.size
  }
  return out
}

/**
 * Monta as frases do topo da Visão Geral.
 *
 * @returns {{key: string, params: object, tone: 'good'|'warn'|'bad'}[]}
 */
export function buildInsights(input = {}) {
  const {
    monthlyIncome = 0,
    monthlyExpenses = 0,
    spendingByCategory = {},
    averages = {},
    today = new Date().toISOString().slice(0, 10),
  } = input

  const insights = []
  const remaining = monthlyIncome - monthlyExpenses
  const daysLeft = daysLeftInMonth(today)

  // 1. Quanto dá para gastar por dia até o mês virar. É a métrica mais
  //    acionável que existe para quem vive de salário a salário — muito mais
  //    do que qualquer percentual.
  if (monthlyIncome > 0 || monthlyExpenses > 0) {
    if (remaining > 0) {
      insights.push({
        key: 'insight.perDay',
        params: { amount: remaining, perDay: remaining / daysLeft, days: daysLeft },
        tone: 'good',
      })
    } else if (remaining < 0) {
      insights.push({
        key: 'insight.over',
        params: { amount: Math.abs(remaining), days: daysLeft },
        tone: 'bad',
      })
    }
  }

  // 2. A categoria que mais destoou da própria média. Uma só: três frases
  //    viram um relatório, e relatório ninguém lê.
  let worst = null
  for (const [category, spent] of Object.entries(spendingByCategory)) {
    const avg = averages[category]
    if (!avg || avg <= 0 || spent <= 0) continue
    const pct = Math.round(((spent - avg) / avg) * 100)
    // 25% é ruído de mês curto; abaixo disso não vale interromper ninguém.
    if (pct < 25) continue
    if (!worst || pct > worst.params.pct) {
      worst = { key: 'insight.categoryUp', params: { category, pct, amount: spent }, tone: 'warn' }
    }
  }
  if (worst) insights.push(worst)

  return insights
}
