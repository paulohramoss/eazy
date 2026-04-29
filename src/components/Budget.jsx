import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Budget Modal ─────────────────────────────────────────────────────────────

function BudgetModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, limit: String(initial.limit) }
      : { category: 'Alimentação', limit: '' }
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.category || !form.limit || Number(form.limit) <= 0) return
    onSave({ ...form, limit: Number(form.limit) })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Orçamento' : 'Novo Orçamento'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Categoria</label>
        <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
          {categories
            .filter(c => !['Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos'].includes(c))
            .map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Limite Mensal (R$)</label>
        <CurrencyInput className="form-input" value={form.limit} onChange={v => set('limit', v)} />
      </div>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Budget() {
  const { budgets, spendingByCategory, transactions, addBudget, updateBudget, deleteBudget, categories } = useApp()
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
    .filter(t => t.status !== 'failed' && t.type === 'expense' && t.date?.startsWith(lastMonthKey))
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc }, {})

  return (
    <div className="screen moovia-screen">
      {/* Page header */}
      <div className="moovia-page-header">
        <div>
          <h2 className="moovia-page-title">Orçamentos</h2>
          <p className="moovia-page-sub">Gerencie seus limites de gastos mensais.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>
          + Adicionar Orçamento
        </button>
      </div>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="moovia-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <i className="fi fi-rr-piggy-bank" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Nenhum orçamento definido</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>Criar primeiro orçamento</button>
        </div>
      ) : (
        <div className="moovia-list">
          {budgets.map(b => {
            const spent     = spendingByCategory[b.category] || 0
            const remaining = b.limit - spent
            const pctSpent  = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0
            const pctFill   = Math.max(0, 100 - pctSpent)
            const over      = spent > b.limit
            const rollover  = Math.max(0, b.limit - (spendingLast[b.category] || 0))

            return (
              <div key={b.id} className="moovia-card moovia-budget-item">
                <div className="moovia-budget-top">
                  <span className="moovia-budget-name">{b.category}</span>
                  <div className="moovia-budget-actions">
                    <button className="moovia-icon-btn" title="Editar" onClick={() => setEditItem(b)}>
                      <i className="fi fi-rr-pencil" />
                    </button>
                    <button className="moovia-icon-btn danger" title="Remover" onClick={() => setDelItem(b)}>
                      <i className="fi fi-rr-trash" />
                    </button>
                  </div>
                </div>

                <div className="moovia-budget-amounts">
                  <span className={over ? 'moovia-amount-over' : ''}>{fmt(Math.max(remaining, 0))}</span>
                  {' '}restantes de{' '}
                  <span style={{ fontWeight: 700 }}>{fmt(b.limit)}</span>
                </div>

                <div className="moovia-progress-wrap">
                  <div
                    className={`moovia-progress-fill${over ? ' moovia-progress-over' : ''}`}
                    style={{ width: `${pctFill}%` }}
                  />
                </div>

                <div className="moovia-budget-footer">
                  <span className={over ? 'moovia-amount-over' : 'moovia-pct-label'}>
                    {pctSpent}% {over ? 'acima do limite' : 'Gasto'}
                  </span>
                  {rollover > 0 && (
                    <span className="moovia-rollover">(+{fmt(rollover)} rollover)</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addModal && <BudgetModal onSave={addBudget} onClose={() => setAddModal(false)} />}
      {editItem && (
        <BudgetModal
          initial={editItem}
          onSave={data => updateBudget(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <Modal
          title="Remover Orçamento"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDelItem(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { deleteBudget(delItem.id); setDelItem(null) }}>Remover</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Deseja remover o orçamento de <strong style={{ color: 'var(--text-primary)' }}>{delItem.category}</strong>?
          </p>
        </Modal>
      )}
    </div>
  )
}
