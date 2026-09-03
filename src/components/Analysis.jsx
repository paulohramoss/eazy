import { CatIcon, useApp } from '../context/AppContext'
import TrendChart from './charts/TrendChart'
import DonutChart from './charts/DonutChart'
import EmptyState from './EmptyState'
import { SERIES } from './charts/primitives'

// ─── Component ────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { transactions, monthlyChartData, spendingByCategory, monthlyIncome, monthlySavings, formatCurrency: fmt, t } = useApp()

  // O TrendChart recebe { label, value } e cuida da escala e dos eixos.
  const incomeData  = monthlyChartData.map(d => ({ key: d.key, label: d.label, value: d.income }))
  const expenseData = monthlyChartData.map(d => ({ key: d.key, label: d.label, value: d.expenses }))
  const savingsData = monthlyChartData.map(d => ({
    key: d.key, label: d.label, value: Math.max(d.income - d.expenses, 0),
  }))

  const mean = (arr) => (arr.length ? arr.reduce((sum, d) => sum + d.value, 0) / arr.length : 0)

  // Sem nenhum movimento no período, um gráfico de tendência é uma reta no zero
  // contra um eixo inventado. O estado vazio diz mais.
  const hasSeries = (arr) => arr.some(d => d.value > 0)
  const avgIncome   = mean(incomeData)
  const avgExpenses = mean(expenseData)
  const avgSavings  = mean(savingsData)
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0

  const categoryList = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])


  const topCategories = transactions
    .filter(tx => tx.type === 'expense' && tx.status !== 'failed')
    .reduce((acc, tx) => {
      const key = tx.category
      if (!acc[key]) acc[key] = { total: 0, count: 0 }
      acc[key].total += tx.amount
      acc[key].count += 1
      return acc
    }, {})

  return (
    <div className="screen">
      {/* Stats row */}
      <div className="summary-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgIncome')}</div>
          <div className="summary-stat-value positive-text">{fmt(avgIncome)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.last6')}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgExpenses')}</div>
          <div className="summary-stat-value negative-text">{fmt(avgExpenses)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.last6')}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('analysis.avgSavings')}</div>
          <div className="summary-stat-value">{fmt(avgSavings)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('analysis.last6')}</div>
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
              subtitle={t('analysis.last6Cap')}
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
              subtitle={t('analysis.last6Cap')}
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
              subtitle={t('analysis.last6Cap')}
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
          {/* Mesma pergunta da Visão Geral — "para onde foi o dinheiro do mês" —
              então mesmo formato: barras de tamanhos parecidos são muito mais
              difíceis de comparar do que fatias com os valores ao lado. */}
          {categoryList.length > 0 ? (
            <DonutChart
              title={t('analysis.byCategory')}
              subtitle={t('analysis.thisMonth')}
              items={categoryList.map(([name, value]) => ({ name, value }))}
              centerLabel={t('chart.total')}
              renderIcon={(name) => <CatIcon category={name} />}
            />
          ) : (
            <EmptyState
              icon="fi-rr-chart-pie"
              title={t('empty.noExpensesTitle')}
              description={t('empty.noExpensesDesc')}
            />
          )}
        </div>
      </div>

      {/* Category stats table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{t('analysis.categorySummary')}</div>
            <div className="card-subtitle">{t('analysis.allTime')}</div>
          </div>
        </div>
        {Object.keys(topCategories).length === 0 ? (
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
              {Object.entries(topCategories)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([cat, info], i) => {
                  const totalAll = Object.values(topCategories).reduce((s, v) => s + v.total, 0)
                  return (
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
                  )
                })
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
