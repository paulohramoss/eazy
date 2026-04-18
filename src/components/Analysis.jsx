import { useApp } from '../context/AppContext'
import { CatIcon } from '../context/AppContext'

const fmt  = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (n) => n >= 1000 ? `R$${(n / 1000).toFixed(1)}k` : `R$${n.toFixed(0)}`

// ─── Line Chart ───────────────────────────────────────────────────────────────

function LineChart({ data, color, label }) {
  const W = 500, H = 140
  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min

  const pts = data.map((v, i) => ({
    x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
    y: H - 10 - ((v - min) / range) * (H - 30),
  }))

  const linePath = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = pts[i - 1]
    const cpx = (prev.x + p.x) / 2
    return `C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`
  }).join(' ')

  const fillPath = `M ${pts[0].x} ${H} ` +
    pts.map((p, i) => {
      if (i === 0) return `L ${p.x} ${p.y}`
      const prev = pts[i - 1]
      const cpx = (prev.x + p.x) / 2
      return `C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`
    }).join(' ') +
    ` L ${pts[pts.length - 1].x} ${H} Z`

  const gradId = `grad-${label.replace(/\s/g, '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5" fill={color} stroke="var(--bg-card)" strokeWidth="2">
          <title>{fmtK(data[i])}</title>
        </circle>
      ))}
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { transactions, monthlyChartData, spendingByCategory, monthlyIncome, monthlyExpenses, monthlySavings } = useApp()

  const incomeData   = monthlyChartData.map(d => d.income)
  const expenseData  = monthlyChartData.map(d => d.expenses)
  const savingsData  = monthlyChartData.map(d => Math.max(d.income - d.expenses, 0))
  const labels       = monthlyChartData.map(d => d.label)

  const avgIncome   = incomeData.reduce((s, v) => s + v, 0) / incomeData.length || 0
  const avgExpenses = expenseData.reduce((s, v) => s + v, 0) / expenseData.length || 0
  const avgSavings  = savingsData.reduce((s, v) => s + v, 0) / savingsData.length || 0
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0

  const categoryList = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])

  const maxCat = categoryList[0]?.[1] || 1

  const topCategories = transactions
    .filter(t => t.type === 'expense' && t.status !== 'failed')
    .reduce((acc, t) => {
      const key = t.category
      if (!acc[key]) acc[key] = { total: 0, count: 0 }
      acc[key].total += t.amount
      acc[key].count += 1
      return acc
    }, {})

  const COLORS = ['#6c63ff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#64748b']

  return (
    <div className="screen">
      {/* Stats row */}
      <div className="summary-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="summary-stat">
          <div className="summary-stat-label">Média de Receitas</div>
          <div className="summary-stat-value positive-text">{fmt(avgIncome)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>últimos 6 meses</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Média de Despesas</div>
          <div className="summary-stat-value negative-text">{fmt(avgExpenses)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>últimos 6 meses</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Média de Poupança</div>
          <div className="summary-stat-value">{fmt(avgSavings)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>últimos 6 meses</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Taxa de Poupança</div>
          <div className={`summary-stat-value ${savingsRate >= 20 ? 'positive-text' : savingsRate > 0 ? '' : 'negative-text'}`}>
            {savingsRate}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>do total de receitas</div>
        </div>
      </div>

      {/* Line Charts */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tendência de Receitas</div>
              <div className="card-subtitle">Últimos 6 meses</div>
            </div>
          </div>
          <LineChart data={incomeData} color="var(--accent-green)" label="receitas" />
          <div className="chart-labels" style={{ marginTop: 8 }}>
            {labels.map(l => <span key={l} className="chart-label">{l}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Taxa de Poupança</div>
              <div className="card-subtitle">Mensal</div>
            </div>
          </div>
          <LineChart data={savingsData} color="var(--accent)" label="poupanca" />
          <div className="chart-labels" style={{ marginTop: 8 }}>
            {labels.map(l => <span key={l} className="chart-label">{l}</span>)}
          </div>
        </div>
      </div>

      {/* Expense trend + category breakdown */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tendência de Despesas</div>
              <div className="card-subtitle">Últimos 6 meses</div>
            </div>
          </div>
          <LineChart data={expenseData} color="var(--accent-red)" label="despesas" />
          <div className="chart-labels" style={{ marginTop: 8 }}>
            {labels.map(l => <span key={l} className="chart-label">{l}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Gastos por Categoria</div>
              <div className="card-subtitle">Este mês</div>
            </div>
          </div>
          {categoryList.length === 0 ? (
            <div className="empty-state"><p>Sem dados este mês</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categoryList.map(([cat, val], i) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                      <CatIcon category={cat} />{cat}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(val / maxCat) * 100}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category stats table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Resumo por Categoria</div>
            <div className="card-subtitle">Histórico geral</div>
          </div>
        </div>
        {Object.keys(topCategories).length === 0 ? (
          <div className="empty-state"><p>Sem dados</p></div>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Nº transações</th>
                <th style={{ textAlign: 'right' }}>Total gasto</th>
                <th style={{ textAlign: 'right' }}>Ticket médio</th>
                <th style={{ textAlign: 'right' }}>% do total</th>
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
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
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
