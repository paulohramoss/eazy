import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CATEGORIES, CATEGORY_ICONS } from '../context/AppContext'
import Modal from './Modal'

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COLORS = ['#6c63ff', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#64748b', '#14b8a6', '#f97316']

// ─── Budget Modal ─────────────────────────────────────────────────────────────

function BudgetModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, limit: String(initial.limit) }
    : { category: 'Alimentação', limit: '', color: '#6c63ff' }
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
          {CATEGORIES.filter(c => !['Salário', 'Freelance', 'Investimentos', 'Outros Rendimentos'].includes(c))
            .map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Limite Mensal (R$)</label>
        <input
          className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
          value={form.limit} onChange={e => set('limit', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Cor</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(color => (
            <button
              key={color} type="button" onClick={() => set('color', color)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: color, cursor: 'pointer',
                border: form.color === color ? '3px solid white' : '3px solid transparent',
                outline: form.color === color ? `2px solid ${color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

function ConfirmModal({ name, onConfirm, onClose }) {
  return (
    <Modal
      title="Remover Orçamento"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Remover</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Deseja remover o orçamento de <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Budget() {
  const { budgets, spendingByCategory, addBudget, updateBudget, deleteBudget, monthlyExpenses } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem]   = useState(null)

  const totalBudget   = budgets.reduce((s, b) => s + b.limit, 0)
  const totalSpent    = budgets.reduce((s, b) => s + (spendingByCategory[b.category] || 0), 0)
  const totalRemaining = totalBudget - totalSpent
  const overallPct    = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="screen">
      {/* Overview */}
      <div className="summary-strip">
        <div className="summary-stat">
          <div className="summary-stat-label">Total Orçado</div>
          <div className="summary-stat-value">{fmt(totalBudget)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>este mês</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Total Gasto</div>
          <div className={`summary-stat-value ${totalSpent > totalBudget ? 'negative-text' : ''}`}>{fmt(totalSpent)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{overallPct}% do orçamento</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Disponível</div>
          <div className={`summary-stat-value ${totalRemaining < 0 ? 'negative-text' : 'positive-text'}`}>{fmt(totalRemaining)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>sem categoria: {fmt(monthlyExpenses - totalSpent > 0 ? monthlyExpenses - totalSpent : 0)}</div>
        </div>
      </div>

      {/* Overall progress */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Progresso Geral do Orçamento</span>
          <span style={{ fontSize: 13, color: overallPct > 100 ? 'var(--accent-red)' : overallPct > 80 ? 'var(--accent-yellow)' : 'var(--accent-green)', fontWeight: 600 }}>
            {overallPct}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(overallPct, 100)}%`,
              background: overallPct > 100 ? 'var(--accent-red)' : overallPct > 80 ? 'var(--accent-yellow)' : 'var(--accent-green)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{fmt(totalSpent)} gasto</span>
          <span>{fmt(totalBudget)} total</span>
        </div>
      </div>

      {/* Budget items */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Categorias</span>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Novo Orçamento</button>
      </div>

      {budgets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: 32 }}>📊</span>
            <p>Nenhum orçamento definido</p>
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>Criar primeiro orçamento</button>
          </div>
        </div>
      ) : (
        <div className="budget-list-wrap">
          {budgets.map(b => {
            const spent = spendingByCategory[b.category] || 0
            const pct   = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0
            const over  = spent > b.limit
            const warn  = !over && pct >= 80
            const fillColor = over ? 'var(--accent-red)' : warn ? 'var(--accent-yellow)' : b.color

            return (
              <div key={b.id} className="budget-item">
                <div className="budget-item-header">
                  <div className="budget-category">
                    <div className="budget-category-icon" style={{ background: `${b.color}20` }}>
                      {CATEGORY_ICONS[b.category] || '📦'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.category}</div>
                      {over && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 2 }}>⚠ Limite ultrapassado</div>}
                      {warn && !over && <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 2 }}>⚡ Próximo do limite</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="budget-amounts" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: over ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                        {fmt(spent)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        de {fmt(b.limit)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="Editar" onClick={() => setEditItem(b)}>✏️</button>
                      <button className="btn-icon danger" title="Remover" onClick={() => setDelItem(b)}>🗑️</button>
                    </div>
                  </div>
                </div>
                <div className="budget-bar">
                  <div className="budget-fill" style={{ width: `${Math.min(pct, 100)}%`, background: fillColor }} />
                </div>
                <div className="budget-bar-info">
                  <span>{pct}% utilizado</span>
                  <span style={{ color: over ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    {over ? `${fmt(spent - b.limit)} acima do limite` : `${fmt(b.limit - spent)} restante`}
                  </span>
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
        <ConfirmModal
          name={delItem.category}
          onConfirm={() => deleteBudget(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
