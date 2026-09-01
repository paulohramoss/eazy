import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import confetti from 'canvas-confetti'
import { isoDate, brDate } from '../utils/date'

const EMPTY_FORM = { name: '', target: '', current: '0', deadline: '' }

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({ initial, onSave, onClose }) {
  const { currencySymbol } = useApp()
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
          <label className="form-label">Valor Alvo ({currencySymbol})</label>
          <CurrencyInput className="form-input" value={form.target} onChange={v => set('target', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">Valor Atual ({currencySymbol})</label>
          <CurrencyInput className="form-input" value={form.current} onChange={v => set('current', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Prazo</label>
        <input className="form-input" type="date" min={isoDate()} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Alocar Fundos Modal ──────────────────────────────────────────────────────

function AlocarModal({ goal, onSave, onUndo, onClose }) {
  const { wallets, walletBalances, transactions, formatCurrency: fmt, currencySymbol } = useApp()
  const [amount, setAmount] = useState(0)
  const [walletId, setWalletId] = useState(wallets[0]?.id || '')
  const remaining = goal.target - goal.current

  const available = walletBalances?.[walletId] ?? 0
  const insufficient = amount > 0 && amount > available

  const contributions = transactions
    .filter(t => t.goalId === goal.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const handleSave = () => {
    if (!amount || amount <= 0 || !walletId) return
    onSave(amount, walletId)
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
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!amount || amount <= 0 || !walletId}
          >Alocar</button>
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
        <label className="form-label">Sai da carteira</label>
        <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
          {wallets.length === 0 && <option value="">Nenhuma carteira cadastrada</option>}
          {wallets.map(w => (
            <option key={w.id} value={w.id}>
              {w.name} — {fmt(walletBalances?.[w.id] ?? 0)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Valor a alocar ({currencySymbol})</label>
        <CurrencyInput className="form-input" value={amount} onChange={setAmount} autoFocus />
        {insufficient && (
          <span style={{ fontSize: 12, color: 'var(--accent-yellow)' }}>
            Acima do saldo da carteira ({fmt(available)}). O saldo vai ficar negativo.
          </span>
        )}
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

      {contributions.length > 0 && (
        <div className="goal-contribs">
          <div className="form-label" style={{ marginBottom: 4 }}>Aportes</div>
          {contributions.map(t => (
            <div key={t.id} className="goal-contrib-row">
              <span>{t.date ? brDate(t.date) : '—'}</span>
              <strong>{fmt(t.amount)}</strong>
              <button
                className="moovia-icon-btn danger"
                title="Desfazer aporte — devolve o valor à carteira"
                onClick={() => onUndo(t)}
              ><i className="fi fi-rr-trash" /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Goals() {
  const { goals, addGoal, updateGoal, deleteGoal, contributeGoal, undoContribution, formatCurrency: fmt } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [alocarItem, setAlocarItem] = useState(null)
  const [delItem,  setDelItem]  = useState(null)

  const handleContribute = (goalId, amount, walletId) => {
    const goal = goals.find(g => g.id === goalId)
    if (goal && goal.current < goal.target && goal.current + amount >= goal.target) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 9999 })
    }
    contributeGoal(goalId, amount, walletId)
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

            const deadlineFmt = goal.deadline ? brDate(goal.deadline) : null

            // Meses cheios até o prazo — arredonda pra cima para nunca subestimar.
            const monthsLeft = goal.deadline
              ? Math.max(0, Math.ceil(
                  (new Date(`${goal.deadline}T12:00:00`) - new Date(`${isoDate()}T12:00:00`))
                  / (1000 * 60 * 60 * 24 * 30.44)))
              : null
            const overdue = !done && goal.deadline && goal.deadline < isoDate()
            const perMonth = !done && monthsLeft > 0
              ? (goal.target - goal.current) / monthsLeft
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
                  <div className={`moovia-goal-deadline${overdue ? ' goal-deadline-late' : ''}`}>
                    {overdue
                      ? `Prazo vencido em ${deadlineFmt}`
                      : done
                        ? deadlineFmt
                        : perMonth
                          ? `${deadlineFmt} · guarde ${fmt(perMonth)}/mês`
                          : `${deadlineFmt} · falta ${fmt(goal.target - goal.current)}`}
                  </div>
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
          goal={goals.find(g => g.id === alocarItem.id) || alocarItem}
          onSave={(amount, walletId) => handleContribute(alocarItem.id, amount, walletId)}
          onUndo={undoContribution}
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
