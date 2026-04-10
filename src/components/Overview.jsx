import { useApp } from '../context/AppContext'
import { CATEGORY_ICONS } from '../context/AppContext'

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ data }) {
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
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2d3e" strokeWidth="18" />
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
          <span className="donut-center-label">Distribuição</span>
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

// ─── Component ────────────────────────────────────────────────────────────────

const COLORS = ['#6c63ff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#64748b']

export default function Overview() {
  const {
    totalBalance, monthlyIncome, monthlyExpenses, monthlySavings,
    lastIncome, lastExpenses, lastSavings, spendingByCategory, monthlyChartData, pctChange,
  } = useApp()

  const metrics = [
    {
      label: 'Saldo Total', value: fmt(totalBalance), icon: 'fi-rr-wallet', color: 'purple',
      change: pctChange(totalBalance, totalBalance * 0.92), dir: 'up', period: 'estimativa'
    },
    {
      label: 'Receitas', value: fmt(monthlyIncome), icon: 'fi-rr-chart-line-up', color: 'green',
      change: pctChange(monthlyIncome, lastIncome), dir: monthlyIncome >= lastIncome ? 'up' : 'down', period: 'vs mês anterior'
    },
    {
      label: 'Despesas', value: fmt(monthlyExpenses), icon: 'fi-rr-money-bill-wave', color: 'red',
      change: pctChange(monthlyExpenses, lastExpenses), dir: monthlyExpenses <= lastExpenses ? 'up' : 'down', period: 'vs mês anterior'
    },
    {
      label: 'Economias', value: fmt(Math.max(monthlySavings, 0)), icon: 'fi-rr-piggy-bank', color: 'yellow',
      change: pctChange(monthlySavings, lastSavings), dir: monthlySavings >= lastSavings ? 'up' : 'down', period: 'vs mês anterior'
    },
  ]

  const maxBar = Math.max(...monthlyChartData.map(d => Math.max(d.income, d.expenses)), 1)

  const categoryEntries = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
  const donutData = categoryEntries.map(([name, val], i) => ({
    name, pct: val, color: COLORS[i % COLORS.length],
  }))

  const STATUS_LABEL = { completed: '● Concluído', pending: '◌ Pendente' }

  return (
    <div className="screen">
      {/* Metrics */}
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className="metric-card">
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

      {/* Charts Row */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Receitas vs Despesas</div>
              <div className="card-subtitle">Últimos 6 meses</div>
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
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent)' }} />Receitas</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(108,99,255,0.3)' }} />Despesas</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Categorias</div>
              <div className="card-subtitle">Distribuição de gastos</div>
            </div>
          </div>
          {donutData.length > 0
            ? <DonutChart data={donutData} />
            : <div className="empty-state"><p>Sem gastos este mês</p></div>
          }
        </div>
      </div>
    </div>
  )
}
