// Planilhas exportadas pelo app (transações e relatório da Análise).
//
// O Excel em português lê CSV com ponto e vírgula e vírgula decimal; com
// vírgula como separador, a linha inteira caía numa coluna só e "1500.5"
// virava texto. O formato segue o locale: onde o decimal é vírgula, colunas
// por ponto e vírgula; senão, o CSV clássico.

export function csvFormat(locale) {
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find(p => p.type === 'decimal')?.value || '.'
  return { decimal, delimiter: decimal === ',' ? ';' : ',' }
}

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// Número cru (sem milhar nem moeda): é o que a planilha consegue somar.
export const csvNumber = (n, { decimal }) => (Number(n) || 0).toFixed(2).replace('.', decimal)

// BOM para o Excel abrir em UTF-8 (sem ele, acento vira "Ã§").
export function toCsv(rows, { delimiter }) {
  return '﻿' + rows.map(r => r.map(esc).join(delimiter)).join('\r\n')
}

/**
 * labels: { date, description, type, category, amount, status, wallet, card,
 *           tags, notes, income, expense, completed, pending }
 */
export function transactionsCsv(transactions, { wallets = [], creditCards = [], labels, format }) {
  const walletName = new Map(wallets.map(w => [w.id, w.name]))
  const cardName   = new Map(creditCards.map(c => [c.id, c.name]))
  const header = [
    labels.date, labels.description, labels.type, labels.category, labels.amount,
    labels.status, labels.wallet, labels.card, labels.tags, labels.notes,
  ]
  const rows = [...transactions]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(tx => [
      tx.date || '',
      tx.name || '',
      tx.type === 'income' ? labels.income : labels.expense,
      tx.category || '',
      csvNumber(tx.amount, format),
      tx.status === 'completed' ? labels.completed : labels.pending,
      walletName.get(tx.walletId) || '',
      cardName.get(tx.cardId) || '',
      (tx.tags || []).join(', '),
      tx.notes || '',
    ])
  return toCsv([header, ...rows], format)
}

// Nome de arquivo com a data local (toISOString passaria para o dia seguinte
// depois das 21h em BRT).
export const exportFilename = (prefix, date, ext) => `eazy-${prefix}-${date}.${ext}`

export function downloadFile(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  // Alguns navegadores ainda leem a URL depois do click: revogar no mesmo
  // tick às vezes baixava um arquivo vazio.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Relatório da Análise numa planilha só: resumo do período, a série (por mês
 * ou por dia, como no gráfico) e o resumo por categoria, separados por uma
 * linha em branco. `report` é o retorno de analyzePeriod.
 *
 * labels: { summary, metric, value, period, start, end, totalIncome,
 *           totalExpenses, net, avgIncome, avgExpenses, avgSavings,
 *           savingsRate, bucket, income, expenses, savings, category,
 *           txCount, totalSpent, avgTicket, share }
 */
export function analysisReportCsv(report, { start, end, periodLabel, bucketLabel, labels, format }) {
  const num = (n) => csvNumber(n, format)
  const net = report.income - report.expenses
  const months = report.months || 1
  const rate = report.income > 0 ? ((net / report.income) * 100) : 0

  const summary = [
    [labels.summary],
    [labels.metric, labels.value],
    [labels.period, periodLabel],
    [labels.start, start],
    [labels.end, end],
    [labels.totalIncome, num(report.income)],
    [labels.totalExpenses, num(report.expenses)],
    [labels.net, num(net)],
    [labels.avgIncome, num(report.income / months)],
    [labels.avgExpenses, num(report.expenses / months)],
    [labels.avgSavings, num(Math.max(net, 0) / months)],
    [labels.savingsRate, `${num(rate)}%`],
  ]

  const series = [
    [labels.bucket, labels.income, labels.expenses, labels.savings],
    ...report.series.map(s => [bucketLabel(s.key), num(s.income), num(s.expenses), num(s.income - s.expenses)]),
  ]

  const categories = [
    [labels.category, labels.txCount, labels.totalSpent, labels.avgTicket, labels.share],
    ...Object.entries(report.byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, c]) => [
        name, c.count, num(c.total), num(c.total / c.count),
        `${num(report.expenses ? (c.total / report.expenses) * 100 : 0)}%`,
      ]),
  ]

  return toCsv([...summary, [], ...series, [], ...categories], format)
}
