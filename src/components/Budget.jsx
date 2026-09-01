import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'

// ─── Budget Modal ─────────────────────────────────────────────────────────────

function BudgetModal({ initial, taken = [], onSave, onClose }) {
  const { categories, currencySymbol, t } = useApp()

  // Categorias de receita não fazem sentido como teto de gasto.
  const available = categories.filter(c =>
    !['Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos'].includes(c) &&
    (c === initial?.category || !taken.includes(c)))

  const [form, setForm] = useState(
    initial
      ? { ...initial, limit: String(initial.limit) }
      : { category: available[0] || '', limit: '' }
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.category || !form.limit || Number(form.limit) <= 0) return
    onSave({ ...form, limit: Number(form.limit) })
    onClose()
  }

  return (
    <Modal
      title={t(initial ? 'budget.editTitle' : 'budget.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('action.save')}</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">{t('budget.category')}</label>
        <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
          {available.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {available.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('budget.allTaken')}
          </span>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">{t('budget.monthlyLimit', { symbol: currencySymbol })}</label>
        <CurrencyInput className="form-input" value={form.limit} onChange={v => set('limit', v)} />
      </div>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Budget() {
  const { budgets, spendingByCategory, transactions, addBudget, updateBudget, deleteBudget, formatCurrency: fmt, t } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem,  setDelItem]  = useState(null)

  // Compute last-month rollover per category
  const now = new Date()
  const lastMonthKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const spendingLast = transactions
    .filter(tx => tx.status !== 'failed' && tx.type === 'expense' && tx.date?.startsWith(lastMonthKey))
    .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc }, {})

  // Ritmo: quanto do mês já passou. Serve para dizer se o gasto está adiantado.
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth   = now.getDate()
  const monthElapsed = dayOfMonth / daysInMonth

  const taken = budgets.map(b => b.category)

  return (
    <div className="screen moovia-screen">
      {/* Page header */}
      <div className="moovia-page-header">
        <div>
          <h2 className="moovia-page-title">{t('budget.pageTitle')}</h2>
          <p className="moovia-page-sub">{t('budget.pageSub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>
          {t('budget.add')}
        </button>
      </div>

      {/* Totais do mês */}
      {budgets.length > 0 && (() => {
        const totalLimit = budgets.reduce((sum, b) => {
          const created = b.createdAt?.toDate ? b.createdAt.toDate() : new Date()
          const isNew = created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
          return sum + b.limit + (isNew ? 0 : Math.max(0, b.limit - (spendingLast[b.category] || 0)))
        }, 0)
        const totalSpent = budgets.reduce((sum, b) => sum + (spendingByCategory[b.category] || 0), 0)
        const left = totalLimit - totalSpent
        return (
          <div className="cal-month-summary">
            <div>
              <span className="cal-summary-label">{t('budget.budgeted')}</span>
              <span className="cal-summary-value">{fmt(totalLimit)}</span>
            </div>
            <div>
              <span className="cal-summary-label">{t('budget.spent')}</span>
              <span className="cal-summary-value">{fmt(totalSpent)}</span>
            </div>
            <div>
              <span className="cal-summary-label">{t('budget.available')}</span>
              <span className={`cal-summary-value ${left < 0 ? 'negative-text' : 'positive-text'}`}>
                {fmt(left)}
              </span>
            </div>
            <div className="cal-summary-warn" style={{ background: 'none', color: 'var(--text-muted)' }}>
              {t('budget.dayProgress', { day: dayOfMonth, total: daysInMonth, pct: Math.round(monthElapsed * 100) })}
            </div>
          </div>
        )
      })()}

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="moovia-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <i className="fi fi-rr-piggy-bank" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t('budget.empty')}</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>{t('budget.createFirst')}</button>
        </div>
      ) : (
        <div className="moovia-list">
          {budgets.map(b => {
            const spent = spendingByCategory[b.category] || 0

            // Só há sobra se o orçamento já existia no mês passado.
            const createdAtDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date()
            const isNewThisMonth = createdAtDate.getFullYear() === now.getFullYear() && createdAtDate.getMonth() === now.getMonth()
            const rollover = isNewThisMonth ? 0 : Math.max(0, b.limit - (spendingLast[b.category] || 0))

            // A sobra era exibida mas não entrava na conta: o card dizia
            // "+R$ X do mês passado" e mesmo assim media tudo contra b.limit.
            const effectiveLimit = b.limit + rollover
            const remaining = effectiveLimit - spent
            const pctSpent  = effectiveLimit > 0 ? Math.min(Math.round((spent / effectiveLimit) * 100), 100) : 0
            const pctFill   = Math.max(0, 100 - pctSpent)
            const over      = spent > effectiveLimit

            // Projeção linear do gasto até o fim do mês.
            const projected = monthElapsed > 0 ? spent / monthElapsed : 0
            const aheadOfPace = !over && effectiveLimit > 0 && projected > effectiveLimit

            return (
              <div key={b.id} className="moovia-card moovia-budget-item">
                <div className="moovia-budget-top">
                  <span className="moovia-budget-name">{b.category}</span>
                  <div className="moovia-budget-actions">
                    <button className="moovia-icon-btn" title={t('action.edit')} onClick={() => setEditItem(b)}>
                      <i className="fi fi-rr-pencil" />
                    </button>
                    <button className="moovia-icon-btn danger" title={t('budget.remove')} onClick={() => setDelItem(b)}>
                      <i className="fi fi-rr-trash" />
                    </button>
                  </div>
                </div>

                <div className="moovia-budget-amounts">
                  <span className={over ? 'moovia-amount-over' : ''}>{fmt(Math.max(remaining, 0))}</span>
                  {' '}{t('budget.remainingOf')}{' '}
                  <span style={{ fontWeight: 700 }}>{fmt(effectiveLimit)}</span>
                </div>

                <div className="moovia-progress-wrap">
                  <div
                    className={`moovia-progress-fill${over ? ' moovia-progress-over' : ''}`}
                    style={{ width: `${pctFill}%` }}
                  />
                </div>

                <div className="moovia-budget-footer">
                  <span className={over ? 'moovia-amount-over' : 'moovia-pct-label'}>
                    {pctSpent}% {over ? t('budget.overLimit') : t('budget.spent')}
                  </span>
                  {rollover > 0 && (
                    <span className="moovia-rollover">
                      {t('budget.rollover', { limit: fmt(b.limit), rollover: fmt(rollover) })}
                    </span>
                  )}
                </div>

                {aheadOfPace && (
                  <div className="moovia-budget-pace">
                    <i className="fi fi-rr-exclamation" />
                    {t('budget.pace', { day: dayOfMonth, total: daysInMonth, projected: fmt(projected) })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {addModal && <BudgetModal taken={taken} onSave={addBudget} onClose={() => setAddModal(false)} />}
      {editItem && (
        <BudgetModal
          initial={editItem}
          taken={taken}
          onSave={data => updateBudget(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <Modal
          title={t('budget.removeTitle')}
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDelItem(null)}>{t('action.cancel')}</button>
              <button className="btn btn-danger" onClick={() => { deleteBudget(delItem.id); setDelItem(null) }}>{t('budget.remove')}</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {t('budget.removeConfirm', { category: delItem.category })}
          </p>
        </Modal>
      )}
    </div>
  )
}
