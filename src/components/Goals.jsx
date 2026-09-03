import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import EmptyState from './EmptyState'
import confetti from 'canvas-confetti'
import { isoDate } from '../utils/date'

const EMPTY_FORM = { name: '', target: '', current: '0', deadline: '' }

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({ initial, onSave, onClose }) {
  const { currencySymbol, t } = useApp()
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
      title={t(initial ? 'goal.editTitle' : 'goal.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('action.save')}</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">{t('goal.name')}</label>
        <input
          className="form-input"
          placeholder={t('goal.namePlaceholder')}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('goal.targetAmount', { symbol: currencySymbol })}</label>
          <CurrencyInput className="form-input" value={form.target} onChange={v => set('target', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('goal.currentAmount', { symbol: currencySymbol })}</label>
          <CurrencyInput className="form-input" value={form.current} onChange={v => set('current', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('goal.deadline')}</label>
        <input className="form-input" type="date" min={isoDate()} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Alocar Fundos Modal ──────────────────────────────────────────────────────

function AlocarModal({ goal, onSave, onUndo, onClose }) {
  const { wallets, walletBalances, transactions, formatCurrency: fmt, currencySymbol, t, formatDate } = useApp()
  const [amount, setAmount] = useState(0)
  const [walletId, setWalletId] = useState(wallets[0]?.id || '')
  const remaining = goal.target - goal.current

  const available = walletBalances?.[walletId] ?? 0
  const insufficient = amount > 0 && amount > available

  const contributions = transactions
    .filter(tx => tx.goalId === goal.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const handleSave = () => {
    if (!amount || amount <= 0 || !walletId) return
    onSave(amount, walletId)
    onClose()
  }

  const shortcuts = [100, 500, 1000, remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i)

  return (
    <Modal
      title={t('goal.allocateTitle', { name: goal.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!amount || amount <= 0 || !walletId}
          >{t('goal.allocate')}</button>
        </>
      }
    >
      <div className="moovia-alocar-info">
        <div className="moovia-alocar-row">
          <span>{t('goal.currentProgress')}</span>
          <strong>{fmt(goal.current)} / {fmt(goal.target)}</strong>
        </div>
        <div className="moovia-progress-wrap" style={{ marginTop: 8 }}>
          <div
            className="moovia-progress-fill"
            style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
          />
        </div>
        <div className="moovia-alocar-remaining">{t('goal.remainingToFinish', { amount: fmt(remaining) })}</div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('goal.fromWallet')}</label>
        <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
          {wallets.length === 0 && <option value="">{t('goal.noWallets')}</option>}
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
          <div className="form-label" style={{ marginBottom: 4 }}>{t('goal.contributions')}</div>
          {contributions.map(c => (
            <div key={c.id} className="goal-contrib-row">
              <span>{c.date ? formatDate(c.date) : '—'}</span>
              <strong>{fmt(c.amount)}</strong>
              <button
                className="moovia-icon-btn danger"
                title={t('goal.undoContribution')}
                onClick={() => onUndo(c)}
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
  const { goals, addGoal, updateGoal, deleteGoal, contributeGoal, undoContribution, formatCurrency: fmt, t, formatDate } = useApp()
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
          <h2 className="moovia-page-title">{t('goal.pageTitle')}</h2>
          <p className="moovia-page-sub">{t('goal.pageSub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>
          {t('goal.add')}
        </button>
      </div>

      {/* Goal cards */}
      {goals.length === 0 ? (
        <div className="moovia-card">
          <EmptyState
            variant="screen"
            icon="fi-rr-star"
            title={t('goal.empty')}
            description={t('empty.noGoalsDesc')}
            action={{ label: t('goal.createFirst'), icon: 'fi-rr-plus', onClick: () => setAddModal(true) }}
          />
        </div>
      ) : (
        <div className="moovia-goals-grid">
          {sorted.map(goal => {
            const pct  = Math.min(Math.round((goal.current / goal.target) * 100), 100)
            const done = goal.current >= goal.target

            const deadlineFmt = goal.deadline ? formatDate(goal.deadline) : null

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
                    title={t(goal.starred ? 'goal.unstar' : 'goal.star')}
                    onClick={() => toggleStar(goal)}
                  >
                    <i className={`fi ${goal.starred ? 'fi-rr-star' : 'fi-rr-star'}`} />
                  </button>
                </div>

                {/* Amounts */}
                <div className="moovia-goal-amounts">
                  <span style={{ fontWeight: 700 }}>{fmt(goal.current)}</span>
                  <span className="moovia-goal-amounts-sub">{t('goal.accumulatedOf')}</span>
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
                      ? t('goal.overdue', { date: deadlineFmt })
                      : done
                        ? deadlineFmt
                        : perMonth
                          ? t('goal.savePerMonth', { date: deadlineFmt, amount: fmt(perMonth) })
                          : t('goal.missing', { date: deadlineFmt, amount: fmt(goal.target - goal.current) })}
                  </div>
                )}

                {/* Actions */}
                <div className="moovia-goal-actions">
                  {!done && (
                    <button className="btn moovia-alocar-btn" onClick={() => setAlocarItem(goal)}>
                      <i className="fi fi-rr-bank" />
                      {t('goal.allocateFunds')}
                    </button>
                  )}
                  {done && (
                    <span className="moovia-done-badge">
                      <i className="fi fi-rr-check" /> {t('goal.done')}
                    </span>
                  )}
                  <div className="moovia-goal-btns">
                    <button className="moovia-icon-btn" title={t('action.edit')} onClick={() => setEditItem(goal)}>
                      <i className="fi fi-rr-pencil" />
                    </button>
                    <button className="moovia-icon-btn danger" title={t('action.delete')} onClick={() => setDelItem(goal)}>
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
          title={t('goal.deleteTitle')}
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDelItem(null)}>{t('action.cancel')}</button>
              <button className="btn btn-danger" onClick={() => { deleteGoal(delItem.id); setDelItem(null) }}>{t('action.delete')}</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {t('goal.deleteConfirm', { name: delItem.name })}
          </p>
        </Modal>
      )}
    </div>
  )
}
