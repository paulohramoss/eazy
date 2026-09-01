import { useState } from 'react'
import { useApp } from '../context/AppContext'
import CurrencyInput from './CurrencyInput'

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, t }) {
  const r = 60, cx = 75, cy = 75
  const circumference = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.pct, 0) || 1

  const segments = data.reduce((acc, seg) => {
    const dash = (seg.pct / total) * circumference
    const offset = acc.length > 0 ? acc[acc.length - 1].nextOffset : 0
    acc.push({ ...seg, dash, gap: circumference - dash, offset, nextOffset: offset + dash })
    return acc
  }, [])

  return (
    <div className="donut-wrap">
      <div className="donut-chart">
        <svg className="donut-svg" width="150" height="150" viewBox="0 0 150 150">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="18" />
          {segments.map((seg, i) => (
            <circle
              key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth="18"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{Math.round((data.reduce((s, d) => s + d.pct, 0) / total) * 100) || 100}%</span>
          <span className="donut-center-label">{t('overview.distribution')}</span>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{ background: seg.color }} />
            <div className="donut-legend-info">
              <span className="donut-legend-name">{seg.name}</span>
              <span className="donut-legend-pct">{Math.round((seg.pct / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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

const COLORS = ['#0053EF', '#CFF330', '#0A0A0A', '#E8382A', '#18A058', '#BBBBBB']

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

  const maxBar = Math.max(...monthlyChartData.map(d => Math.max(d.income, d.expenses)), 1)

  const categoryEntries = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
  const donutData = categoryEntries.map(([name, val], i) => ({
    name, pct: val, color: COLORS[i % COLORS.length],
  }))

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
            <div className="card-header">
              <div>
                <div className="card-title">{t('overview.incomeVsExpenses')}</div>
                <div className="card-subtitle">{t('overview.last6Months')}</div>
              </div>
            </div>
            <div className="chart-bars">
              {monthlyChartData.map((d, i) => (
                <div key={i} className="chart-bar-group">
                  <div className="chart-bar income" style={{ height: `${(d.income / maxBar) * 100}%` }} title={fmt(d.income)} />
                  <div className="chart-bar expenses" style={{ height: `${(d.expenses / maxBar) * 100}%` }} title={fmt(d.expenses)} />
                </div>
              ))}
            </div>
            <div className="chart-labels">
              {monthlyChartData.map(d => <span key={d.key} className="chart-label">{d.label}</span>)}
            </div>
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent)' }} />{t('overview.income')}</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(108,99,255,0.3)' }} />{t('overview.expenses')}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{t('overview.categories')}</div>
                <div className="card-subtitle">{t('overview.spendingSplit')}</div>
              </div>
            </div>
            {donutData.length > 0
              ? <DonutChart data={donutData} t={t} />
              : <div className="empty-state"><p>{t('overview.noExpenses')}</p></div>
            }
          </div>
        </div>

        {/* Can I Spend */}
        <CanISpend remaining={remaining} />
      </div>
    </div>
  )
}
