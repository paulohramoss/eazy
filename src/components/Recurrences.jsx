import { useMemo, useState } from 'react'
import { CatIcon, useApp } from '../context/AppContext'
import { advance, FREQUENCIES, isoDate } from '../utils/date'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import { useToast } from './Toast'

const freqKey = (v) => FREQUENCIES.find(f => f.value === v)?.labelKey || 'freq.monthly'

// ─── Edição ───────────────────────────────────────────────────────────────────

function EditModal({ item, wallets, creditCards, categories, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name: item.name || '',
    amount: String(item.amount ?? ''),
    type: item.type || 'expense',
    category: item.category || 'Outros',
    walletId: item.walletId || '',
    cardId: item.cardId || '',
    frequency: item.frequency || 'monthly',
    nextDate: item.nextDate || isoDate(),
    endDate: item.endDate || '',
    notes: item.notes || '',
  })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const save = () => {
    if (!form.name.trim() || !(Number(form.amount) > 0)) return
    onSave({ ...form, amount: Number(form.amount) })
    onClose()
  }

  return (
    <Modal
      title={t('rec.editTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('action.save')}</button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="rec-name">{t('rec.description')}</label>
          <input id="rec-name" className="form-input" value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('tx.amount')}</label>
          <CurrencyInput className="form-input" value={form.amount}
            onChange={v => set('amount', v)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="rec-type">{t('txModal.type')}</label>
          <select id="rec-type" className="form-select" value={form.type}
            onChange={e => set('type', e.target.value)}>
            <option value="expense">{t('txModal.expense')}</option>
            <option value="income">{t('txModal.income')}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rec-freq">{t('txModal.frequency')}</label>
          <select id="rec-freq" className="form-select" value={form.frequency}
            onChange={e => set('frequency', e.target.value)}>
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="rec-cat">{t('tx.category')}</label>
          <select id="rec-cat" className="form-select" value={form.category}
            onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rec-wallet">{t('rec.accountOrCard')}</label>
          <select
            id="rec-wallet"
            className="form-select"
            value={form.cardId ? `card:${form.cardId}` : `wallet:${form.walletId}`}
            onChange={e => {
              const [kind, id] = e.target.value.split(':')
              setForm(prev => ({
                ...prev,
                walletId: kind === 'wallet' ? id : '',
                cardId:   kind === 'card' ? id : '',
              }))
            }}
          >
            {wallets.map(w => <option key={w.id} value={`wallet:${w.id}`}>{w.name}</option>)}
            {creditCards.map(c => <option key={c.id} value={`card:${c.id}`}>{t('rec.cardSuffix', { name: c.name })}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="rec-next">{t('rec.nextOccurrence')}</label>
          <input id="rec-next" className="form-input" type="date" value={form.nextDate}
            onChange={e => set('nextDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rec-end">{t('rec.endsOn')}</label>
          <input id="rec-end" className="form-input" type="date" value={form.endDate}
            onChange={e => set('endDate', e.target.value)} />
          <div className="form-hint">{t('rec.endsHint')}</div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirmação de exclusão ──────────────────────────────────────────────────

function DeleteModal({ item, generated, onConfirm, onClose, t }) {
  return (
    <Modal
      title={t('rec.deleteTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>{t('rec.deleteRule')}</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
        {t('rec.deleteBody', { name: item.name })}
      </p>
      {generated > 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 12, lineHeight: 1.55 }}>
          {/* Apagar o histórico junto seria destruir movimentação que de fato
              aconteceu — o dinheiro entrou ou saiu. */}
          {t('rec.deleteKeepsHistory', { count: generated })}
        </p>
      )}
    </Modal>
  )
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function Recurrences() {
  const {
    recurrences, transactions, wallets, creditCards, categories,
    updateRecurrence, deleteRecurrence, toggleRecurrence, formatCurrency: fmt, t, formatDate,
  } = useApp()
  const toast = useToast()
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)

  const generatedCount = useMemo(() => {
    const counts = {}
    for (const tx of transactions) {
      if (tx.recurrenceId) counts[tx.recurrenceId] = (counts[tx.recurrenceId] || 0) + 1
    }
    return counts
  }, [transactions])

  const sorted = useMemo(() => [...recurrences].sort((a, b) => {
    // Ativas primeiro, depois por proximidade da próxima ocorrência.
    if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1
    return (a.nextDate || '').localeCompare(b.nextDate || '')
  }), [recurrences])

  const monthlyTotal = useMemo(() => {
    // Normaliza tudo para "por mês" só para dar uma noção de peso no orçamento.
    const perMonth = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }
    return sorted
      .filter(r => r.active !== false)
      .reduce((acc, r) => {
        const value = (r.amount || 0) * (perMonth[r.frequency] ?? 1)
        return r.type === 'income' ? acc + value : acc - value
      }, 0)
  }, [sorted])

  const target = (r) =>
    r.cardId ? creditCards.find(c => c.id === r.cardId)?.name
             : wallets.find(w => w.id === r.walletId)?.name

  if (!recurrences.length) {
    return (
      <div className="screen">
        <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
          <i className="fi fi-rr-refresh" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }} />
          <h3 style={{ marginBottom: 8 }}>{t('rec.emptyTitle')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55, maxWidth: 420, margin: '0 auto' }}>
            {t('rec.emptyBody')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="recurrence-summary">
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('rec.summaryLabel')}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
                        color: monthlyTotal >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {fmt(monthlyTotal)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5, textAlign: 'right' }}>
          {t('rec.summaryNote')}
        </div>
      </div>

      <div className="recurrence-list">
        {sorted.map(r => {
          const paused = r.active === false
          const ended = r.endDate && r.nextDate > r.endDate
          return (
            <div key={r.id} className={`recurrence-card${paused ? ' is-paused' : ''}`}>
              <div className="recurrence-icon">
                <CatIcon category={r.category} />
              </div>

              <div className="recurrence-info">
                <div className="recurrence-name">
                  {r.name}
                  <span className="recurrence-freq">{t(freqKey(r.frequency))}</span>
                  {paused && <span className="recurrence-tag">{t('rec.paused')}</span>}
                  {ended && !paused && <span className="recurrence-tag">{t('rec.ended')}</span>}
                </div>
                <div className="recurrence-meta">
                  {r.category}
                  {target(r) && <> · {target(r)}</>}
                  {generatedCount[r.id] > 0 && <> · {t('rec.postedCount', { count: generatedCount[r.id] })}</>}
                </div>
                <div className="recurrence-next">
                  {paused
                    ? t('rec.pausedNote')
                    : ended
                      ? t('rec.endedOn', { date: formatDate(r.endDate) })
                      : <>{t('rec.nextOn', { date: formatDate(r.nextDate) })}
                          {r.endDate && <> · {t('rec.until', { date: formatDate(r.endDate) })}</>}
                          {!r.endDate && <> · {t('rec.then', { date: formatDate(advance(r.nextDate, r.frequency)) })}</>}
                        </>
                  }
                </div>
              </div>

              <div className="recurrence-amount" style={{
                color: r.type === 'income' ? 'var(--accent-green)' : 'var(--text-primary)',
              }}>
                {r.type === 'income' ? '+' : '−'}{fmt(r.amount)}
              </div>

              <div className="recurrence-actions">
                <button
                  className="icon-btn"
                  title={t(paused ? 'rec.resume' : 'rec.pause')}
                  aria-label={`${t(paused ? 'rec.resume' : 'rec.pause')} ${r.name}`}
                  onClick={() => {
                    toggleRecurrence(r.id, paused)
                    toast.info(t(paused ? 'rec.resumed' : 'rec.pausedToast', { name: r.name }))
                  }}
                >
                  <i className={`fi ${paused ? 'fi-rr-play' : 'fi-rr-pause'}`} />
                </button>
                <button className="icon-btn" title={t('action.edit')} aria-label={`${t('action.edit')} ${r.name}`}
                  onClick={() => setEditItem(r)}>
                  <i className="fi fi-rr-pencil" />
                </button>
                <button className="icon-btn icon-btn--danger" title={t('action.delete')} aria-label={`${t('action.delete')} ${r.name}`}
                  onClick={() => setDelItem(r)}>
                  <i className="fi fi-rr-trash" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editItem && (
        <EditModal
          item={editItem}
          wallets={wallets}
          creditCards={creditCards}
          categories={categories}
          t={t}
          onSave={data => {
            updateRecurrence(editItem.id, data)
            toast.success(t('rec.updated'))
          }}
          onClose={() => setEditItem(null)}
        />
      )}

      {delItem && (
        <DeleteModal
          item={delItem}
          generated={generatedCount[delItem.id] || 0}
          t={t}
          onConfirm={() => {
            deleteRecurrence(delItem.id)
            toast.success(t('rec.deleted'))
          }}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
