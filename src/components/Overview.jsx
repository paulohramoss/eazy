import { useState } from 'react'
import { CatIcon, useApp } from '../context/AppContext'
import CurrencyInput from './CurrencyInput'
import BarChart from './charts/BarChart'
import DonutChart from './charts/DonutChart'
import EmptyState from './EmptyState'

// ─── Can I Spend Widget ───────────────────────────────────────────────────────

function CanISpend({ remaining }) {
  const { formatCurrency: fmt, currencySymbol, t } = useApp()
  const [amount, setAmount] = useState(0)
  const hasValue        = amount > 0
  const afterSpend      = remaining - amount
  const canSpend        = afterSpend >= 0
  const pct             = hasValue ? Math.min((amount / Math.max(remaining, 1)) * 100, 100) : 0

  return (
    <div className="card can-spend-card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <i className="fi fi-rr-calculator" style={{ marginRight: 8 }} />
            {t('overview.canSpend.title')}
          </div>
          <div className="card-subtitle">{t('overview.canSpend.sub')}</div>
        </div>
      </div>

      <div className="can-spend-body">
        {/* Available balance pill */}
        <div className="can-spend-balance">
          <span className="can-spend-balance-label">{t('overview.canSpend.available')}</span>
          <span className="can-spend-balance-value">{fmt(Math.max(remaining, 0))}</span>
        </div>

        {/* Input */}
        <div className="can-spend-input-wrap">
          <span className="can-spend-prefix">{currencySymbol}</span>
          <CurrencyInput
            className="can-spend-input"
            value={amount}
            onChange={setAmount}
          />
        </div>

        {/* Progress bar */}
        {hasValue && (
          <div className="can-spend-bar-wrap">
            <div className="can-spend-bar">
              <div
                className={`can-spend-fill ${canSpend ? 'ok' : 'over'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="can-spend-pct">{t('overview.canSpend.ofAvailable', { pct: pct.toFixed(0) })}</span>
          </div>
        )}

        {/* Result */}
        <div className={`can-spend-result ${!hasValue ? 'idle' : canSpend ? 'ok' : 'over'}`}>
          {!hasValue && (
            <>
              <i className="fi fi-rr-interrogation" />
              <span>{t('overview.canSpend.prompt')}</span>
            </>
          )}
          {hasValue && canSpend && (
            <>
              <i className="fi fi-rr-check-circle" />
              <div>
                <div className="can-spend-result-main">{t('overview.canSpend.yes')}</div>
                <div className="can-spend-result-sub">
                  {t('overview.canSpend.yesSub', { amount: fmt(afterSpend) })}
                </div>
              </div>
            </>
          )}
          {hasValue && !canSpend && (
            <>
              <i className="fi fi-rr-cross-circle" />
              <div>
                <div className="can-spend-result-main">{t('overview.canSpend.no')}</div>
                <div className="can-spend-result-sub">
                  {t('overview.canSpend.noSub', { amount: fmt(Math.abs(afterSpend)) })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export default function Overview() {
  const {
    totalBalance, monthlyIncome, monthlyExpenses, monthlySavings,
    lastIncome, lastExpenses, lastSavings, lastBalance, spendingByCategory, monthlyChartData, pctChange,
    formatCurrency: fmt, t,
  } = useApp()

  const remaining = monthlyIncome - monthlyExpenses

  const metrics = [
    {
      label: t('overview.totalBalance'), value: fmt(totalBalance), icon: 'fi-rr-wallet', color: 'purple',
      change: pctChange(totalBalance, lastBalance), dir: totalBalance >= lastBalance ? 'up' : 'down', period: t('overview.vsLastMonth')
    },
    {
      label: t('overview.income'), value: fmt(monthlyIncome), icon: 'fi-rr-chart-line-up', color: 'green',
      change: pctChange(monthlyIncome, lastIncome), dir: monthlyIncome >= lastIncome ? 'up' : 'down', period: t('overview.vsLastMonth')
    },
    {
      label: t('overview.expenses'), value: fmt(monthlyExpenses), icon: 'fi-rr-money-bill-wave', color: 'red',
      change: pctChange(monthlyExpenses, lastExpenses), dir: monthlyExpenses <= lastExpenses ? 'up' : 'down', period: t('overview.vsLastMonth')
    },
    {
      label: t('overview.savings'), value: fmt(Math.max(monthlySavings, 0)), icon: 'fi-rr-piggy-bank', color: 'yellow',
      change: pctChange(monthlySavings, lastSavings), dir: monthlySavings >= lastSavings ? 'up' : 'down', period: t('overview.vsLastMonth')
    },
  ]

  // Sem fatiar em 5 aqui: o donut cuida disso e dobra a cauda em "Outros",
  // para o total do centro continuar batendo com o gasto do mês.
  const categoryItems = Object.entries(spendingByCategory)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  return (
    <div className="screen">
      {/* Metrics */}
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className={`metric-card metric-card--${m.color}`}>
            <div className="metric-header">
              <span className="metric-label">{m.label}</span>
              <div className={`metric-icon ${m.color}`}><i className={`fi ${m.icon}`} /></div>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-footer">
              <span className={`metric-change ${m.dir}`}>
                <i className={`fi ${m.dir === 'up' ? 'fi-rr-arrow-alt-up' : 'fi-rr-arrow-alt-down'}`} />
                {Math.abs(m.change)}%
              </span>
              <span className="metric-period">{m.period}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Can I Spend */}
      <div className="overview-bottom-row">
        {/* Charts */}
        <div className="charts-row">
          <div className="card">
            {monthlyChartData.some(d => d.income > 0 || d.expenses > 0) ? (
              <BarChart
                title={t('overview.incomeVsExpenses')}
                subtitle={t('overview.last6Months')}
                data={monthlyChartData}
              />
            ) : (
              <EmptyState
                icon="fi-rr-chart-histogram"
                title={t('empty.noChartData')}
                description={t('empty.noChartDataDesc')}
              />
            )}
          </div>

          <div className="card">
            {categoryItems.length > 0 ? (
              <DonutChart
                title={t('overview.categories')}
                subtitle={t('overview.spendingSplit')}
                items={categoryItems}
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

        {/* Can I Spend */}
        <CanISpend remaining={remaining} />
      </div>
    </div>
  )
}
