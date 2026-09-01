import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { advance, FREQUENCIES } from '../utils/date'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import Receipts from './Receipts'

const EMPTY_FORM = {
  type: 'expense', name: '', category: 'Alimentação', amount: '',
  date: new Date().toISOString().split('T')[0],
  walletId: '', cardId: '', status: 'completed', notes: '', tags: [],
}

export default function TransactionModal({ initial, onSave, onClose, wallets, creditCards, categories }) {
  const { getCardCurrentUsed, formatCurrency: fmt, currencySymbol, t, formatDate } = useApp()
  const [form, setForm] = useState(initial
    ? { ...initial, amount: String(initial.amount), tags: initial.tags || [] }
    : { ...EMPTY_FORM, walletId: wallets[0]?.id || '' }
  )
  const [repeatMode, setRepeatMode] = useState('unique')
  const [repeatCount, setRepeatCount] = useState(12)
  const [frequency, setFrequency] = useState('monthly')
  const [tagInput, setTagInput] = useState('')
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCardChange = (cardId) => {
    setForm(prev => ({
      ...prev,
      cardId,
      walletId: cardId ? '' : (wallets[0]?.id || ''),
    }))
  }

  // Validação de limite do cartão
  const selectedCard = form.cardId ? creditCards.find(c => c.id === form.cardId) : null
  const cardUsed = selectedCard ? getCardCurrentUsed(selectedCard.id) : 0
  const newAmount = Number(form.amount) || 0
  // Ao editar, desconta o valor original para não contar duas vezes
  const originalAmount = (initial?.cardId === form.cardId && initial?.type === 'expense')
    ? (Number(initial.amount) || 0)
    : 0
  const cardAvailable = selectedCard ? (selectedCard.limit || 0) - cardUsed + originalAmount : Infinity
  const limitExceeded = selectedCard && form.type === 'expense' && newAmount > cardAvailable

  const handleSave = () => {
    if (!form.name.trim() || !form.amount || Number(form.amount) <= 0) return
    if (limitExceeded) return
    onSave({ ...form, amount: Number(form.amount) }, repeatMode, Number(repeatCount), frequency)
    onClose()
  }

  return (
    <Modal
      title={t(initial ? 'txModal.editTitle' : 'txModal.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={limitExceeded}
            style={limitExceeded ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >{t('action.save')}</button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('txModal.type')}</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="income">{t('txModal.income')}</option>
            <option value="expense">{t('txModal.expense')}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('tx.status')}</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="completed">{t('tx.completed')}</option>
            <option value="pending">{t('tx.pending')}</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('tx.description')}</label>
        <input className="form-input" placeholder={t('txModal.namePlaceholder')} value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('txModal.value', { symbol: currencySymbol })}</label>
          <CurrencyInput className="form-input" value={form.amount} onChange={v => set('amount', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('tx.date')}</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
      </div>
      {!initial && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('txModal.repeat')}</label>
              <select className="form-select" value={repeatMode} onChange={e => setRepeatMode(e.target.value)}>
                <option value="unique">{t('txModal.once')}</option>
                <option value="installment">{t('txModal.installment')}</option>
                <option value="recurring">{t('txModal.recurring')}</option>
              </select>
            </div>

            {/* Parcelamento continua materializando as N parcelas: elas são um
                conjunto fechado e conhecido desde já. Já a recorrência vira uma
                regra, que dá para pausar e editar depois. */}
            {repeatMode === 'installment' && (
              <div className="form-group">
                <label className="form-label">{t('txModal.installmentCount')}</label>
                <input className="form-input" type="number" min="2" max="120"
                  value={repeatCount} onChange={e => setRepeatCount(e.target.value)} />
              </div>
            )}

            {repeatMode === 'recurring' && (
              <div className="form-group">
                <label className="form-label">{t('txModal.frequency')}</label>
                <select className="form-select" value={frequency} onChange={e => setFrequency(e.target.value)}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
                </select>
              </div>
            )}
          </div>

          {repeatMode === 'recurring' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('txModal.repeatTimes')}</label>
                <input className="form-input" type="number" min="0" max="600"
                  value={repeatCount} onChange={e => setRepeatCount(e.target.value)}
                  placeholder={t('txModal.noEndPlaceholder')} />
                <div className="form-hint">
                  {Number(repeatCount) > 1
                    ? t('txModal.lastOccurrence', { date: formatDate(advance(form.date, frequency, Number(repeatCount) - 1)) })
                    : t('txModal.noEnd')}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {initial?.id && (
        <div className="form-group">
          <label className="form-label">{t('txModal.receipts')}</label>
          <Receipts transactionId={initial.id} />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('tx.category')}</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">
            {t('tx.wallet')}
            {form.cardId && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', marginLeft: 5 }}>{t('txModal.optional')}</span>}
          </label>
          <select
            className="form-select"
            value={form.walletId}
            onChange={e => set('walletId', e.target.value)}
            disabled={!!form.cardId}
            style={form.cardId ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            <option value="">{t('txModal.none')}</option>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>
      {form.type === 'expense' && creditCards.length > 0 && (
        <div className="form-group">
          <label className="form-label">{t('txModal.creditCard')}</label>
          <select className="form-select" value={form.cardId} onChange={e => handleCardChange(e.target.value)}>
            <option value="">{t('txModal.noCard')}</option>
            {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Indicador de limite disponível */}
          {selectedCard && form.type === 'expense' && (
            <div style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              ...(limitExceeded
                ? { background: 'rgba(232,56,42,0.08)', border: '1px solid rgba(232,56,42,0.25)', color: 'var(--accent-red)' }
                : { background: 'rgba(24,160,88,0.08)', border: '1px solid rgba(24,160,88,0.2)', color: 'var(--accent-green)' }
              ),
            }}>
              <i className={`fi ${limitExceeded ? 'fi-rr-ban' : 'fi-rr-shield-check'}`} style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
              <div>
                {limitExceeded ? (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{t('txModal.limitExceeded')}</div>
                    <div style={{ opacity: 0.85 }}>
                      {t('txModal.availableIs', { amount: fmt(cardAvailable) })}
                      {' · '}{t('txModal.missingIs', { amount: fmt(newAmount - cardAvailable) })}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>
                      {t('txModal.availableIs', { amount: fmt(cardAvailable) })}
                      {newAmount > 0 && (
                        <span style={{ fontWeight: 400, opacity: 0.75 }}>
                          {' → '}
                          {fmt(cardAvailable - newAmount)}
                          {' '}{t('txModal.after')}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">{t('txModal.tags')}</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {(form.tags || []).map(tag => (
            <span key={tag} style={{
              fontSize: 12, padding: '3px 8px', borderRadius: 99,
              background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              #{tag}
              <button onClick={() => set('tags', form.tags.filter(x => x !== tag))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="form-input" placeholder={t('txModal.addTag')} value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                const newTag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
                if (!form.tags.includes(newTag)) set('tags', [...(form.tags || []), newTag])
                setTagInput('')
              }
            }} style={{ flex: 1 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('txModal.enterToAdd')}</div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('txModal.notes')}</label>
        <textarea className="form-textarea" placeholder={t('txModal.notesPlaceholder')} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}
