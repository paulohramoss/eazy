import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMOJIS = ['🏦', '✈️', '💻', '📈', '🏠', '🚗', '🎓', '💊', '🎮', '💍', '🐾', '🌴', '⛵', '📷']
const COLORS  = ['#6c63ff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#64748b', '#14b8a6', '#f97316']

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = { name: '', emoji: '🏦', target: '', current: '0', deadline: '', color: '#6c63ff' }

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, target: String(initial.target), current: String(initial.current) }
    : EMPTY_FORM
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.target || Number(form.target) <= 0) return
    onSave({ ...form, target: Number(form.target), current: Number(form.current) || 0 })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Meta' : 'Nova Meta'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Nome da Meta</label>
        <input className="form-input" placeholder="Ex: Viagem, Reserva, Carro..." value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Emoji</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EMOJIS.map(em => (
            <button
              key={em} type="button" onClick={() => set('emoji', em)}
              style={{
                width: 40, height: 40, fontSize: 20, borderRadius: 8, cursor: 'pointer',
                background: form.emoji === em ? 'rgba(108,99,255,0.2)' : 'var(--bg-hover)',
                border: form.emoji === em ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >{em}</button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor Alvo (R$)</label>
          <input className="form-input" type="number" min="1" step="0.01" placeholder="0,00" value={form.target} onChange={e => set('target', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor Atual (R$)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.current} onChange={e => set('current', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Prazo</label>
        <input className="form-input" type="date" min={today} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
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

// ─── Contribute Modal ─────────────────────────────────────────────────────────

function ContributeModal({ goal, onSave, onClose }) {
  const [amount, setAmount] = useState('')
  const remaining = goal.target - goal.current

  const handleSave = () => {
    const val = Number(amount)
    if (!val || val <= 0) return
    onSave(val)
    onClose()
  }

  return (
    <Modal
      title={`Contribuir para "${goal.name}"`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Adicionar</button>
        </>
      }
    >
      <div style={{ textAlign: 'center', padding: '8px 0 16px', fontSize: 36 }}>{goal.emoji}</div>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Progresso atual</span>
          <strong style={{ color: 'var(--text-primary)' }}>{fmt(goal.current)} / {fmt(goal.target)}</strong>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.round((goal.current / goal.target) * 100)}%`, background: goal.color }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Faltam {fmt(remaining)} para concluir
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Valor a adicionar (R$)</label>
        <input
          className="form-input" type="number" min="0.01" step="0.01"
          placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)}
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[100, 500, 1000, remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => (
          <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setAmount(String(v))}>
            {fmt(v)}
          </button>
        ))}
      </div>
    </Modal>
  )
}

function ConfirmModal({ name, onConfirm, onClose }) {
  return (
    <Modal
      title="Excluir Meta"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Excluir</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Deseja excluir a meta <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Goals() {
  const { goals, addGoal, updateGoal, deleteGoal, contributeGoal } = useApp()
  const [addModal, setAddModal]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [contItem, setContItem]   = useState(null)
  const [delItem, setDelItem]     = useState(null)

  const totalTarget  = goals.reduce((s, g) => s + g.target, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.current, 0)
  const completed    = goals.filter(g => g.current >= g.target).length

  return (
    <div className="screen">
      {/* Summary */}
      <div className="summary-strip">
        <div className="summary-stat">
          <div className="summary-stat-label">Total das Metas</div>
          <div className="summary-stat-value">{fmt(totalTarget)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Total Acumulado</div>
          <div className="summary-stat-value positive-text">{fmt(totalCurrent)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Metas Concluídas</div>
          <div className="summary-stat-value">{completed} / {goals.length}</div>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Suas Metas</span>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Nova Meta</button>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: 36 }}>🎯</span>
            <p>Nenhuma meta definida</p>
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>Criar primeira meta</button>
          </div>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map(goal => {
            const pct       = Math.min(Math.round((goal.current / goal.target) * 100), 100)
            const done      = goal.current >= goal.target
            const remaining = goal.target - goal.current
            const daysLeft  = goal.deadline
              ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)
              : null

            return (
              <div key={goal.id} className={`goal-card${done ? ' goal-card-done' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 32 }}>{goal.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{goal.name}</div>
                      {goal.deadline && (
                        <div style={{ fontSize: 11, color: daysLeft !== null && daysLeft < 30 ? 'var(--accent-red)' : 'var(--text-muted)', marginTop: 3 }}>
                          {done ? '✅ Concluída!' : daysLeft !== null ? `${daysLeft > 0 ? `${daysLeft} dias restantes` : 'Prazo vencido'}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" title="Contribuir" onClick={() => setContItem(goal)} style={{ color: 'var(--accent-light)' }}>+</button>
                    <button className="btn-icon" title="Editar" onClick={() => setEditItem(goal)}>✏️</button>
                    <button className="btn-icon danger" title="Excluir" onClick={() => setDelItem(goal)}>🗑️</button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Progresso</span>
                    <span style={{ fontWeight: 700, color: done ? 'var(--accent-green)' : 'var(--text-primary)' }}>{pct}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: done ? 'var(--accent-green)' : goal.color }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 4 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Acumulado</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{fmt(goal.current)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Objetivo</div>
                    <div style={{ fontWeight: 700 }}>{fmt(goal.target)}</div>
                  </div>
                </div>

                {!done && (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 4 }}
                    onClick={() => setContItem(goal)}
                  >
                    + Adicionar valor
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {addModal && <GoalModal onSave={addGoal} onClose={() => setAddModal(false)} />}
      {editItem && (
        <GoalModal
          initial={editItem}
          onSave={data => updateGoal(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {contItem && (
        <ContributeModal
          goal={contItem}
          onSave={amount => contributeGoal(contItem.id, amount)}
          onClose={() => setContItem(null)}
        />
      )}
      {delItem && (
        <ConfirmModal
          name={delItem.name}
          onConfirm={() => deleteGoal(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
