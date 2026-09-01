import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import { dailyBalances } from '../utils/balances'
import { isoDate } from '../utils/date'

const fmtShort = (n, symbol) => {
  if (Math.abs(n) >= 1000) return `${symbol} ${(n / 1000).toFixed(1)}k`
  return `${symbol} ${Math.round(n)}`
}

const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']


export default function FinancialCalendar() {
  const { transactions, wallets, formatCurrency: fmt, currencySymbol, locale, t } = useApp()
  const now   = new Date()
  const todayKey = isoDate(now)

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const validTx = useMemo(
    () => transactions.filter(tx => tx.status !== 'failed' && tx.date), [transactions])

  const txByDate = useMemo(() => validTx.reduce((acc, tx) => {
    (acc[tx.date] ||= []).push(tx)
    return acc
  }, {}), [validTx])

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
  const goToday = () => {
    setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDay(null)
  }
  const onCurrentMonth = year === now.getFullYear() && month === now.getMonth()

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

  const cellKey = (c) =>
    `${c.year}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`

  // Saldo projetado no fim de cada dia da grade, numa passada só.
  const gridFrom = cellKey(cells[0])
  const gridTo   = cellKey(cells[cells.length - 1])
  const balanceByDay = useMemo(
    () => dailyBalances(wallets, validTx, gridFrom, gridTo),
    [wallets, validTx, gridFrom, gridTo])

  // Totais do mês visível (só os dias do próprio mês, sem o preenchimento).
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTotals = useMemo(() => {
    const inMonth = validTx.filter(tx => tx.date.startsWith(monthPrefix))
    const income   = inMonth.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
    const expenses = inMonth.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [validTx, monthPrefix])

  const lastDayKey = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`
  const endOfMonthBalance = balanceByDay[lastDayKey] ?? 0

  const negativeDays = Object.entries(balanceByDay)
    .filter(([day, bal]) => bal < 0 && day.startsWith(monthPrefix)).length

  const selectedTxs = selectedDay ? (txByDate[selectedDay] || []) : []

  return (
    <div className="screen moovia-screen">
      {/* Page header */}
      <div className="moovia-page-header">
        <div>
          <h2 className="moovia-page-title">{t('cal.title')}</h2>
          <p className="moovia-page-sub">{t('cal.sub')}</p>
        </div>
        <div className="cal-nav-controls">
          <button className="cal-nav-btn" onClick={prevMonth}>
            <i className="fi fi-rr-angle-left" />
          </button>
          <span className="cal-month-label">{MONTHS_PT[month]} {year}</span>
          <button className="cal-nav-btn" onClick={nextMonth}>
            <i className="fi fi-rr-angle-right" />
          </button>
          {!onCurrentMonth && (
            <button className="btn btn-secondary btn-sm" onClick={goToday}>{t('cal.today')}</button>
          )}
        </div>
      </div>

      {/* Totais do mês visível */}
      <div className="cal-month-summary">
        <div>
          <span className="cal-summary-label">{t('tx.income')}</span>
          <span className="cal-summary-value positive-text">+{fmt(monthTotals.income)}</span>
        </div>
        <div>
          <span className="cal-summary-label">{t('tx.expenses')}</span>
          <span className="cal-summary-value negative-text">−{fmt(monthTotals.expenses)}</span>
        </div>
        <div>
          <span className="cal-summary-label">{t('cal.result')}</span>
          <span className={`cal-summary-value ${monthTotals.net >= 0 ? 'positive-text' : 'negative-text'}`}>
            {monthTotals.net >= 0 ? '+' : '−'}{fmt(Math.abs(monthTotals.net))}
          </span>
        </div>
        <div>
          <span className="cal-summary-label">{t('cal.endOfMonthBalance')}</span>
          <span className={`cal-summary-value ${endOfMonthBalance < 0 ? 'negative-text' : ''}`}>
            {fmt(endOfMonthBalance)}
          </span>
        </div>
        {negativeDays > 0 && (
          <div className="cal-summary-warn">
            <i className="fi fi-rr-exclamation" />
            {negativeDays} dia{negativeDays > 1 ? 's' : ''} com saldo negativo
          </div>
        )}
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
              const key = cellKey(cell)
              const txs      = txByDate[key] || []
              const isToday  = key === todayKey
              const isSel    = key === selectedDay
              const balance  = balanceByDay[key]
              const negative = balance != null && balance < 0

              return (
                <div
                  key={ci}
                  className={[
                    'cal-cell',
                    !cell.current ? 'cal-cell-other' : '',
                    isToday ? 'cal-cell-today' : '',
                    isSel   ? 'cal-cell-selected' : '',
                    txs.length > 0 ? 'cal-cell-has-tx' : '',
                    negative && cell.current ? 'cal-cell-negative' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(isSel ? null : key)}
                >
                  <span className={`cal-day-num${isToday ? ' cal-day-today-num' : ''}`}>
                    {cell.day}
                  </span>

                  {txs.length > 0 && (
                    <div className="cal-tx-list">
                      {txs.slice(0, 2).map((tx, i) => (
                        <div key={i} className={`cal-tx-pill cal-tx-${tx.type}`}>
                          <span className="cal-tx-dot" />
                          <span className="cal-tx-amt">{fmtShort(tx.amount, currencySymbol)}</span>
                        </div>
                      ))}
                      {txs.length > 2 && (
                        <div className="cal-tx-more">+{txs.length - 2}</div>
                      )}
                    </div>
                  )}

                  {/* Saldo projetado no fim do dia — o motivo de existir o calendário. */}
                  {balance != null && (
                    <div className={`cal-day-balance${negative ? ' cal-day-balance-neg' : ''}`}>
                      {fmtShort(balance, currencySymbol)}
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
        <Modal
          title={new Date(selectedDay + 'T12:00').toLocaleDateString(locale, {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
          onClose={() => setSelectedDay(null)}
        >
          {selectedTxs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
              Nenhuma transação neste dia.
            </p>
          ) : (
            <div className="cal-detail-list">
              {selectedTxs.map(tx => (
                <div key={tx.id} className="cal-detail-item">
                  <div className="cal-detail-left">
                    <div className={`cal-detail-dot cal-tx-${tx.type}`} />
                    <div>
                      <div className="cal-detail-name">{tx.name}</div>
                      <div className="cal-detail-cat">{tx.category}</div>
                    </div>
                  </div>
                  <div className={`cal-detail-amount ${tx.type === 'income' ? 'positive-text' : 'negative-text'}`}>
                    {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="cal-detail-balance">
            <span>{t('cal.projectedEndOfDay')}</span>
            <strong className={(balanceByDay[selectedDay] ?? 0) < 0 ? 'negative-text' : ''}>
              {fmt(balanceByDay[selectedDay] ?? 0)}
            </strong>
          </div>

          {/* Day totals */}
          {selectedTxs.length > 0 && (() => {
            const inc = selectedTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
            const exp = selectedTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
            return (
              <div className="cal-detail-totals">
                {inc > 0 && <span className="positive-text">+{fmt(inc)} receitas</span>}
                {exp > 0 && <span className="negative-text">−{fmt(exp)} despesas</span>}
              </div>
            )
          })()}
        </Modal>
      )}
    </div>
  )
}
