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
          <span className="donut-center-value">{Math.round((data.reduce((s,d)=>s+d.pct,0)/total)*100)||100}%</span>
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

export default function Overview({ onNavigate }) {
  const {
    totalBalance, monthlyIncome, monthlyExpenses, monthlySavings,
    lastIncome, lastExpenses, lastSavings,
    transactions, goals, spendingByCategory, monthlyChartData, pctChange,
  } = useApp()

  const metrics = [
    { label: 'Saldo Total',   value: fmt(totalBalance),    icon: '◈', color: 'purple',
      change: pctChange(totalBalance, totalBalance * 0.92), dir: 'up', period: 'estimativa' },
    { label: 'Receitas',      value: fmt(monthlyIncome),   icon: '↑', color: 'green',
      change: pctChange(monthlyIncome, lastIncome),   dir: monthlyIncome >= lastIncome ? 'up' : 'down', period: 'vs mês anterior' },
    { label: 'Despesas',      value: fmt(monthlyExpenses), icon: '↓', color: 'red',
      change: pctChange(monthlyExpenses, lastExpenses), dir: monthlyExpenses <= lastExpenses ? 'up' : 'down', period: 'vs mês anterior' },
    { label: 'Economias',     value: fmt(Math.max(monthlySavings, 0)), icon: '★', color: 'yellow',
      change: pctChange(monthlySavings, lastSavings), dir: monthlySavings >= lastSavings ? 'up' : 'down', period: 'vs mês anterior' },
  ]

  const maxBar = Math.max(...monthlyChartData.map(d => Math.max(d.income, d.expenses)), 1)

  const categoryEntries = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
  const totalSpend = categoryEntries.reduce((s, [, v]) => s + v, 0) || 1
  const donutData = categoryEntries.map(([name, val], i) => ({
    name, pct: val, color: COLORS[i % COLORS.length],
  }))

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)

  const STATUS_LABEL = { completed: '● Concluído', pending: '◌ Pendente', failed: '✕ Falhou' }

  return (
    <div className="screen">
      {/* Metrics */}
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-header">
              <span className="metric-label">{m.label}</span>
              <div className={`metric-icon ${m.color}`}>{m.icon}</div>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-footer">
              <span className={`metric-change ${m.dir}`}>
                {m.dir === 'up' ? '↑' : '↓'} {Math.abs(m.change)}%
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

      {/* Bottom Row */}
      <div className="bottom-row">
        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Transações Recentes</div>
              <div className="card-subtitle">Últimas movimentações</div>
            </div>
            <button className="card-action" onClick={() => onNavigate('transactions')}>Ver todas</button>
          </div>
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <div className="tx-info">
                      <div className="tx-icon" style={{ background: 'var(--bg-hover)' }}>
                        {CATEGORY_ICONS[tx.category] || '💳'}
                      </div>
                      <div>
                        <div className="tx-name">{tx.name}</div>
                        <div className="tx-category">{tx.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tx-date">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="tx-status">
                    <span className={`status-badge ${tx.status}`}>{STATUS_LABEL[tx.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Goals */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Metas Financeiras</div>
              <div className="card-subtitle">Progresso atual</div>
            </div>
            <button className="card-action" onClick={() => onNavigate('goals')}>Gerenciar</button>
          </div>
          <div className="goals-list">
            {goals.map(goal => {
              const pct = Math.round((goal.current / goal.target) * 100)
              return (
                <div key={goal.id} className="goal-item">
                  <div className="goal-header">
                    <div className="goal-name"><span>{goal.emoji}</span>{goal.name}</div>
                    <div className="goal-amounts">
                      <strong>{fmt(goal.current)}</strong> / {fmt(goal.target)}
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: goal.color }} />
                  </div>
                  <div className="goal-pct">{pct}% concluído</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
