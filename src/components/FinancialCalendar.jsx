import { useState } from 'react'
import { useApp } from '../context/AppContext'

const fmt    = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (n) => {
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`
  return `R$ ${Math.round(n)}`
}

const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function FinancialCalendar() {
  const { transactions } = useApp()
  const now   = new Date()
  const todayKey = dateKey(now)

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  // Build txByDate map (exclude failed)
  const txByDate = {}
  transactions
    .filter(t => t.status !== 'failed' && t.date)
    .forEach(t => {
      if (!txByDate[t.date]) txByDate[t.date] = []
      txByDate[t.date].push(t)
    })

  // Navigate months
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Build calendar grid cells
  const firstDow   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()

  const cells = []
  // Padding from previous month
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, current: false, month: month - 1, year: month === 0 ? year - 1 : year })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, month, year })
  }
  // Padding to fill last row
  const remainder = cells.length % 7
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      cells.push({ day: d, current: false, month: month + 1, year: month === 11 ? year + 1 : year })
    }
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const selectedTxs = selectedDay ? (txByDate[selectedDay] || []) : []

  return (
    <div className="screen moovia-screen">
      {/* Page header */}
      <div className="moovia-page-header">
        <div>
          <h2 className="moovia-page-title">Calendário Financeiro</h2>
          <p className="moovia-page-sub">Visualize suas receitas e despesas por data.</p>
        </div>
        <div className="cal-nav-controls">
          <button className="cal-nav-btn" onClick={prevMonth}>
            <i className="fi fi-rr-angle-left" />
          </button>
          <span className="cal-month-label">{MONTHS_PT[month]} {year}</span>
          <button className="cal-nav-btn" onClick={nextMonth}>
            <i className="fi fi-rr-angle-right" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="moovia-card cal-card">
        {/* Day-of-week headers */}
        <div className="cal-header-row">
          {DAYS_PT.map(d => <div key={d} className="cal-dow-cell">{d}</div>)}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="cal-week-row">
            {week.map((cell, ci) => {
              const key = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
              const txs      = txByDate[key] || []
              const isToday  = key === todayKey
              const isSel    = key === selectedDay
              const hasIncome  = txs.some(t => t.type === 'income')
              const hasExpense = txs.some(t => t.type === 'expense')

              return (
                <div
                  key={ci}
                  className={[
                    'cal-cell',
                    !cell.current ? 'cal-cell-other' : '',
                    isToday ? 'cal-cell-today' : '',
                    isSel   ? 'cal-cell-selected' : '',
                    txs.length > 0 ? 'cal-cell-has-tx' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(isSel ? null : key)}
                >
                  <span className={`cal-day-num${isToday ? ' cal-day-today-num' : ''}`}>
                    {cell.day}
                  </span>

                  {txs.length > 0 && (
                    <div className="cal-tx-list">
                      {txs.slice(0, 2).map((t, i) => (
                        <div key={i} className={`cal-tx-pill cal-tx-${t.type}`}>
                          <span className="cal-tx-dot" />
                          <span className="cal-tx-amt">{fmtShort(t.amount)}</span>
                        </div>
                      ))}
                      {txs.length > 2 && (
                        <div className="cal-tx-more">+{txs.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div className="moovia-card">
          <div className="cal-detail-header">
            <span className="cal-detail-title">
              {new Date(selectedDay + 'T12:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
            <button
              className="moovia-icon-btn"
              onClick={() => setSelectedDay(null)}
              title="Fechar"
            >
              <i className="fi fi-rr-cross-small" />
            </button>
          </div>

          {selectedTxs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
              Nenhuma transação neste dia.
            </p>
          ) : (
            <div className="cal-detail-list">
              {selectedTxs.map(t => (
                <div key={t.id} className="cal-detail-item">
                  <div className="cal-detail-left">
                    <div className={`cal-detail-dot cal-tx-${t.type}`} />
                    <div>
                      <div className="cal-detail-name">{t.name}</div>
                      <div className="cal-detail-cat">{t.category}</div>
                    </div>
                  </div>
                  <div className={`cal-detail-amount ${t.type === 'income' ? 'positive-text' : 'negative-text'}`}>
                    {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Day totals */}
          {selectedTxs.length > 0 && (() => {
            const inc = selectedTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
            const exp = selectedTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
            return (
              <div className="cal-detail-totals">
                {inc > 0 && <span className="positive-text">+{fmt(inc)} receitas</span>}
                {exp > 0 && <span className="negative-text">−{fmt(exp)} despesas</span>}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
