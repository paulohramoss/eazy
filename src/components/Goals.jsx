import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import confetti from 'canvas-confetti'

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = { name: '', target: '', current: '0', deadline: '' }

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
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
      title={initial ? 'Editar Objetivo' : 'Novo Objetivo'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Nome do Objetivo</label>
        <input
          className="form-input"
          placeholder="Ex: Viagem, Reserva, Carro..."
          value={form.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor Alvo (R$)</label>
          <CurrencyInput className="form-input" value={form.target} onChange={v => set('target', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor Atual (R$)</label>
          <CurrencyInput className="form-input" value={form.current} onChange={v => set('current', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Prazo</label>
        <input className="form-input" type="date" min={today} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Alocar Fundos Modal ──────────────────────────────────────────────────────

function AlocarModal({ goal, onSave, onClose }) {
  const [amount, setAmount] = useState(0)
  const remaining = goal.target - goal.current

  const handleSave = () => {
    if (!amount || amount <= 0) return
    onSave(amount)
    onClose()
  }

  const shortcuts = [100, 500, 1000, remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i)

  return (
    <Modal
      title={`Alocar Fundos — ${goal.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Alocar</button>
        </>
      }
    >
      <div className="moovia-alocar-info">
        <div className="moovia-alocar-row">
          <span>Progresso atual</span>
          <strong>{fmt(goal.current)} / {fmt(goal.target)}</strong>
        </div>
        <div className="moovia-progress-wrap" style={{ marginTop: 8 }}>
          <div
            className="moovia-progress-fill"
            style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
          />
        </div>
        <div className="moovia-alocar-remaining">Faltam {fmt(remaining)} para concluir</div>
      </div>

      <div className="form-group">
        <label className="form-label">Valor a alocar (R$)</label>
        <CurrencyInput className="form-input" value={amount} onChange={setAmount} autoFocus />
      </div>

      {shortcuts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shortcuts.map(v => (
            <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setAmount(v)}>
              {fmt(v)}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Goals() {
  const { goals, addGoal, updateGoal, deleteGoal, contributeGoal } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [alocarItem, setAlocarItem] = useState(null)
  const [delItem,  setDelItem]  = useState(null)

  const handleContribute = (goalId, amount) => {
    const goal = goals.find(g => g.id === goalId)
    if (goal) {
      if (goal.current < goal.target && goal.current + amount >= goal.target) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 9999
        })
      }
    }
    contributeGoal(goalId, amount)
  }

  const toggleStar = (goal) =>
    updateGoal(goal.id, { starred: !goal.starred })

  // Starred goals first
  const sorted = [...goals].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))

  return (
    <div className="screen moovia-screen">
      {/* Page header */}
      <div className="moovia-page-header">
        <div>
          <h2 className="moovia-page-title">Objetivos</h2>
          <p className="moovia-page-sub">Acompanhe o progresso dos seus objetivos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>
          + Adicionar Objetivo
        </button>
      </div>

      {/* Goal cards */}
      {goals.length === 0 ? (
        <div className="moovia-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <i className="fi fi-rr-star" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Nenhum objetivo definido</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>Criar primeiro objetivo</button>
        </div>
      ) : (
        <div className="moovia-goals-grid">
          {sorted.map(goal => {
            const pct  = Math.min(Math.round((goal.current / goal.target) * 100), 100)
            const done = goal.current >= goal.target

            const deadlineFmt = goal.deadline
              ? new Date(goal.deadline + 'T12:00').toLocaleDateString('pt-BR')
              : null

            return (
              <div key={goal.id} className={`moovia-card moovia-goal-card${done ? ' moovia-goal-done' : ''}`}>
                {/* Top row */}
                <div className="moovia-goal-top">
                  <span className="moovia-goal-name">{goal.name}</span>
                  <button
                    className={`moovia-star-btn${goal.starred ? ' moovia-star-active' : ''}`}
                    title={goal.starred ? 'Remover destaque' : 'Destacar'}
                    onClick={() => toggleStar(goal)}
                  >
                    <i className={`fi ${goal.starred ? 'fi-rr-star' : 'fi-rr-star'}`} />
                  </button>
                </div>

                {/* Amounts */}
                <div className="moovia-goal-amounts">
                  <span style={{ fontWeight: 700 }}>{fmt(goal.current)}</span>
                  <span className="moovia-goal-amounts-sub"> acumulados de </span>
                  <span style={{ fontWeight: 700 }}>{fmt(goal.target)}</span>
                  <span className="moovia-goal-pct"> ({pct}%)</span>
                </div>

                {/* Progress bar */}
                <div className="moovia-progress-wrap">
                  <div
                    className="moovia-progress-fill"
                    style={{ width: `${pct}%`, background: done ? 'var(--accent-green)' : undefined }}
                  />
                </div>

                {/* Deadline */}
                {deadlineFmt && (
                  <div className="moovia-goal-deadline">{deadlineFmt}</div>
                )}

                {/* Actions */}
                <div className="moovia-goal-actions">
                  {!done && (
                    <button className="btn moovia-alocar-btn" onClick={() => setAlocarItem(goal)}>
                      <i className="fi fi-rr-bank" />
                      Alocar Fundos
                    </button>
                  )}
                  {done && (
                    <span className="moovia-done-badge">
                      <i className="fi fi-rr-check" /> Concluído
                    </span>
                  )}
                  <div className="moovia-goal-btns">
                    <button className="moovia-icon-btn" title="Editar" onClick={() => setEditItem(goal)}>
                      <i className="fi fi-rr-pencil" />
                    </button>
                    <button className="moovia-icon-btn danger" title="Excluir" onClick={() => setDelItem(goal)}>
                      <i className="fi fi-rr-trash" />
                    </button>
                  </div>
                </div>
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
      {alocarItem && (
        <AlocarModal
          goal={alocarItem}
          onSave={amount => handleContribute(alocarItem.id, amount)}
          onClose={() => setAlocarItem(null)}
        />
      )}
      {delItem && (
        <Modal
          title="Excluir Objetivo"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDelItem(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { deleteGoal(delItem.id); setDelItem(null) }}>Excluir</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Deseja excluir o objetivo <strong style={{ color: 'var(--text-primary)' }}>{delItem.name}</strong>?
          </p>
        </Modal>
      )}
    </div>
  )
}
