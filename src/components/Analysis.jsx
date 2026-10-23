import { useEffect, useMemo, useState } from 'react'
import { CatIcon, useApp } from '../context/AppContext'
import TrendChart from './charts/TrendChart'
import DonutChart from './charts/DonutChart'
import EmptyState from './EmptyState'
import { SERIES } from './charts/primitives'
import { isoDate } from '../utils/date'
import { DEFAULT_PERIOD, PERIODS, analyzePeriod, periodRange } from '../utils/analysis'
import { analysisReportCsv, csvFormat, downloadFile, exportFilename } from '../utils/exportCsv'

// O período escolhido sobrevive à troca de tela e ao reload: quem analisa um
// trimestre não quer voltar para "últimos 6 meses" a cada visita.
const PERIOD_KEY = 'eazy_analysis_period'

function loadPeriod() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY) || 'null')
    if (saved && PERIODS.includes(saved.period)) return saved
  } catch { /* modo privado ou lixo */ }
  return { period: DEFAULT_PERIOD, from: '', to: '' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { transactions, formatCurrency: fmt, formatDate, locale, t } = useApp()
  const monthShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale])
  const [{ period, from, to }, setFilter] = useState(loadPeriod)

  useEffect(() => {
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify({ period, from, to })) } catch { /* modo privado */ }
  }, [period, from, to])

  const today = isoDate()
  const { start, end } = periodRange(period, today, { from, to, transactions })
  const data = useMemo(() => analyzePeriod(transactions, start, end), [transactions, start, end])

  // Trocar o preset mostra o intervalo nas datas; mexer numa data passa para
  // "personalizado" a partir do intervalo que estava na tela.
  const choosePeriod = (p) => setFilter(p === 'custom'
    ? { period: p, from: start, to: end }
    : { period: p, from: '', to: '' })
  const setDate = (field) => (e) => setFilter({ period: 'custom', from: start, to: end, [field]: e.target.value })

  const periodLabel = period === 'custom'
    ? `${formatDate(start)} – ${formatDate(end)}`
    : t(`analysis.period.${period}`)

  // Por dia: só o número do dia. Por mês: mês curto, com o ano quando o
  // recorte atravessa a virada (senão "jan" aparece duas vezes sem distinção).
  const spansYears = start.slice(0, 4) !== end.slice(0, 4)
  const labelOf = (key) => {
    if (data.granularity === 'day') return String(Number(key.slice(8)))
    const [y, m] = key.split('-').map(Number)
    const name = monthShort.format(new Date(y, m - 1, 1))
    return spansYears ? `${name}/${String(y).slice(2)}` : name
  }

  // O TrendChart recebe { label, value } e cuida da escala e dos eixos.
  const toSeries = (pick) => data.series.map(d => ({ key: d.key, label: labelOf(d.key), value: pick(d) }))
  const incomeData  = toSeries(d => d.income)
  const expenseData = toSeries(d => d.expenses)
  const savingsData = toSeries(d => Math.max(d.income - d.expenses, 0))

  // Sem nenhum movimento no período, um gráfico de tendência é uma reta no zero
  // contra um eixo inventado. O estado vazio diz mais.
  const hasSeries = (arr) => arr.some(d => d.value > 0)
  const avgIncome   = data.income / data.months
  const avgExpenses = data.expenses / data.months
  const avgSavings  = Math.max(data.income - data.expenses, 0) / data.months
  const savingsRate = data.income > 0 ? Math.round(((data.income - data.expenses) / data.income) * 100) : 0

  const categories = Object.entries(data.byCategory).sort((a, b) => b[1].total - a[1].total)
  const totalAll = data.expenses

  // Mesmo recorte da tela. Na planilha a série sai com a data ISO (2026-10 ou
  // 2026-10-05), que o Excel ordena e reconhece sem depender do idioma.
  const exportReport = () => {
    const csv = analysisReportCsv(data, {
      start, end, periodLabel,
      bucketLabel: (key) => key,
      format: csvFormat(locale),
      labels: {
        summary: t('export.summary'), metric: t('export.metric'), value: t('export.value'),
        period: t('export.period'), start: t('export.start'), end: t('export.end'),
        totalIncome: t('export.totalIncome'), totalExpenses: t('export.totalExpenses'), net: t('export.net'),
        avgIncome: t('analysis.avgIncome'), avgExpenses: t('analysis.avgExpenses'),
        avgSavings: t('analysis.avgSavings'), savingsRate: t('analysis.savingsRate'),
        bucket: t(data.granularity === 'day' ? 'export.day' : 'export.month'),
        income: t('txModal.income'), expenses: t('txModal.expense'), savings: t('export.balance'),
        category: t('tx.category'), txCount: t('analysis.txCount'), totalSpent: t('analysis.totalSpent'),
        avgTicket: t('analysis.avgTicket'), share: t('export.share'),
      },
    })
    downloadFile(csv, exportFilename('relatorio', `${start}_a_${end}`, 'csv'), 'text/csv;charset=utf-8')
  }

  return (
    <div className="screen">
      {/* Período */}
      <div className="filter-bar">
        <select
          className="filter-select"
          value={period}
          onChange={e => choosePeriod(e.target.value)}
          aria-label={t('analysis.period')}
        >
          {PERIODS.map(p => <option key={p} value={p}>{t(`analysis.period.${p}`)}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            className="filter-select"
            value={start}
            onChange={setDate('from')}
            title={t('tx.dateFrom')}
            aria-label={t('tx.dateFrom')}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('tx.until')}</span>
          <input
            type="date"
            className="filter-select"
            value={end}
            onChange={setDate('to')}
            title={t('tx.dateTo')}
            aria-label={t('tx.dateTo')}
          />
        </div>
        <div className="filter-bar-end">
          <button className="btn btn-secondary filter-bar-add" onClick={exportReport}>
            <i className="fi fi-rr-file-spreadsheet" /> {t('export.report')}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="summary-strip summary-strip--4">
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgIncome')}</div>
          <div className="summary-stat-value positive-text">{fmt(avgIncome)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.perMonth')}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgExpenses')}</div>
          <div className="summary-stat-value negative-text">{fmt(avgExpenses)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.perMonth')}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgSavings')}</div>
          <div className="summary-stat-value">{fmt(avgSavings)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.perMonth')}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.savingsRate')}</div>
          <div className={`summary-stat-value ${savingsRate >= 20 ? 'positive-text' : savingsRate > 0 ? '' : 'negative-text'}`}>
            {savingsRate}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.ofTotalIncome')}</div>
        </div>
      </div>

      {/* Tendências */}
      <div className="charts-row">
        <div className="card">
          {hasSeries(incomeData) ? (
            <TrendChart
              title={t('analysis.incomeTrend')}
              subtitle={periodLabel}
              data={incomeData}
              color="var(--chart-income)"
            />
          ) : (
            <EmptyState
              icon="fi-rr-chart-line-up"
              title={t('empty.noChartData')}
              description={t('empty.noChartDataDesc')}
            />
          )}
        </div>

        <div className="card">
          {hasSeries(expenseData) ? (
            <TrendChart
              title={t('analysis.expenseTrend')}
              subtitle={periodLabel}
              data={expenseData}
              color="var(--chart-expense)"
            />
          ) : (
            <EmptyState
              icon="fi-rr-chart-line-up"
              title={t('empty.noChartData')}
              description={t('empty.noChartDataDesc')}
            />
          )}
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          {hasSeries(savingsData) ? (
            <TrendChart
              title={t('analysis.avgSavings')}
              subtitle={periodLabel}
              data={savingsData}
              color="var(--chart-1)"
            />
          ) : (
            <EmptyState
              icon="fi-rr-chart-line-up"
              title={t('empty.noChartData')}
              description={t('empty.noChartDataDesc')}
            />
          )}
        </div>

        <div className="card">
          {/* Mesma pergunta da Visão Geral — "para onde foi o dinheiro" —
              então mesmo formato: barras de tamanhos parecidos são muito mais
              difíceis de comparar do que fatias com os valores ao lado. */}
          {categories.length > 0 ? (
            <DonutChart
              title={t('analysis.byCategory')}
              subtitle={periodLabel}
              items={categories.map(([name, info]) => ({ name, value: info.total }))}
              centerLabel={t('chart.total')}
              renderIcon={(name) => <CatIcon category={name} />}
            />
          ) : (
            <EmptyState
              icon="fi-rr-chart-pie"
              title={t('empty.noChartData')}
              description={t('empty.noChartDataDesc')}
            />
          )}
        </div>
      </div>

      {/* Category stats table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{t('analysis.categorySummary')}</div>
            <div className="card-subtitle">{periodLabel}</div>
          </div>
        </div>
        {categories.length === 0 ? (
          <EmptyState
            icon="fi-rr-list"
            title={t('empty.noChartData')}
            description={t('empty.noChartDataDesc')}
          />
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>{t('tx.category')}</th>
                <th style={{ textAlign: 'right' }}>{t('analysis.txCount')}</th>
                <th style={{ textAlign: 'right' }}>{t('analysis.totalSpent')}</th>
                <th style={{ textAlign: 'right' }}>{t('analysis.avgTicket')}</th>
                <th style={{ textAlign: 'right' }}>{t('analysis.pctOfTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(([cat, info], i) => (
                <tr key={cat}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="chart-legend-swatch" style={{ background: SERIES[i] || 'var(--chart-other)' }} />
                      <CatIcon category={cat} />
                      <span style={{ fontWeight: 500 }}>{cat}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{info.count}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(info.total)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(info.total / info.count)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="category-tag">{((info.total / totalAll) * 100).toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
