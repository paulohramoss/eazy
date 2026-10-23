import { addDays, isoDate } from './date.js'

// Períodos da tela de Análise. Os presets cobrem meses inteiros — "este mês"
// inclui o que já está agendado até o dia 31, como no resto do app.
export const PERIODS = ['thisMonth', 'lastMonth', 'last3', 'last6', 'last12', 'thisYear', 'all', 'custom']
export const DEFAULT_PERIOD = 'last6'

const monthStart = (y, m) => isoDate(new Date(y, m, 1))
const monthEnd   = (y, m) => isoDate(new Date(y, m + 1, 0))

// { start, end } em ISO, ambos inclusivos. "all" vai da primeira à última
// transação; sem transações, cai no mês atual.
export function periodRange(period, today, { from, to, transactions = [] } = {}) {
  const [y, month] = today.split('-').map(Number)
  const m = month - 1 // 0-based, como o Date
  const lastN = (n) => ({ start: monthStart(y, m - (n - 1)), end: monthEnd(y, m) })

  switch (period) {
    case 'thisMonth': return lastN(1)
    case 'lastMonth': return { start: monthStart(y, m - 1), end: monthEnd(y, m - 1) }
    case 'last3':     return lastN(3)
    case 'last12':    return lastN(12)
    case 'thisYear':  return { start: `${y}-01-01`, end: `${y}-12-31` }
    case 'all': {
      const dates = transactions.map(tx => tx.date).filter(Boolean).sort()
      return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : lastN(1)
    }
    case 'custom': {
      // Datas invertidas viram o intervalo certo em vez de um período vazio.
      const a = from || to || today
      const b = to || from || today
      return a <= b ? { start: a, end: b } : { start: b, end: a }
    }
    default: return lastN(6)
  }
}

// Até ~um mês o gráfico vai por dia; acima disso, por mês. Uma linha de um
// ponto só não mostra tendência nenhuma.
const DAILY_MAX_DAYS = 31

const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000) + 1

// Chaves dos baldes (YYYY-MM ou YYYY-MM-DD) cobrindo o intervalo, em ordem.
export function bucketKeys(start, end) {
  if (daysBetween(start, end) <= DAILY_MAX_DAYS) {
    const keys = []
    for (let d = start; d <= end; d = addDays(d, 1)) keys.push(d)
    return { granularity: 'day', keys }
  }
  const keys = []
  let [y, m] = start.slice(0, 7).split('-').map(Number)
  const last = end.slice(0, 7)
  for (let k = start.slice(0, 7); k <= last; ) {
    keys.push(k)
    m += 1
    if (m > 12) { m = 1; y += 1 }
    k = `${y}-${String(m).padStart(2, '0')}`
  }
  return { granularity: 'month', keys }
}

// Tudo que a tela mostra, calculado sobre o mesmo recorte. Transação falha não
// entra (mesma regra do validTx do AppContext).
export function analyzePeriod(transactions, start, end) {
  const txs = transactions.filter(tx =>
    tx.status !== 'failed' && tx.date && tx.date >= start && tx.date <= end)

  const { granularity, keys } = bucketKeys(start, end)
  const keyOf = granularity === 'day' ? (d) => d : (d) => d.slice(0, 7)
  const buckets = new Map(keys.map(k => [k, { key: k, income: 0, expenses: 0 }]))
  const byCategory = {}
  let income = 0
  let expenses = 0

  for (const tx of txs) {
    const amount = tx.amount || 0
    const b = buckets.get(keyOf(tx.date))
    if (tx.type === 'income') {
      income += amount
      if (b) b.income += amount
    } else if (tx.type === 'expense') {
      expenses += amount
      if (b) b.expenses += amount
      const c = (byCategory[tx.category] ||= { total: 0, count: 0 })
      c.total += amount
      c.count += 1
    }
  }

  // Médias são mensais em qualquer granularidade: um recorte de 10 dias conta
  // como um mês, não como dez.
  const months = new Set(bucketKeys(start, end).keys.map(k => k.slice(0, 7))).size

  return {
    granularity,
    series: [...buckets.values()],
    income,
    expenses,
    months,
    byCategory,
  }
}
