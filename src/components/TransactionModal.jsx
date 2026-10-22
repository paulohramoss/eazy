import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { advance, FREQUENCIES, isoDate } from '../utils/date'
import { useToast } from './Toast'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import Receipts from './Receipts'
import SplitEditor from './SplitEditor'
import SeriesScopeModal from './SeriesScopeModal'

// Quanto esperar a confirmação do servidor antes de tratar a escrita como
// enfileirada offline. Recusa de regra (permission-denied) chega bem antes.
const SERVER_ACK_TIMEOUT = 6000

// Função, não constante: a data era calculada uma vez ao carregar o módulo
// (app aberto de um dia para o outro lançava com a data de ontem) e em UTC
// (depois das 21h no Brasil já vinha como amanhã — e no último dia do mês
// caía fora do filtro da lista, parecendo que não tinha salvado).
const emptyForm = () => ({
  type: 'expense', name: '', category: 'Alimentação', amount: '',
  date: isoDate(),
  walletId: '', cardId: '', status: 'completed', notes: '', tags: [], split: null,
})

// `initial` é edição de uma transação existente; `draft` é um lançamento novo
// que já chega preenchido (vindo do lançamento rápido). A distinção importa:
// parcelamento e recorrência só aparecem em lançamento novo, e comprovante só
// em transação já salva.
export default function TransactionModal({ initial, draft, series, onSave, onSettle, onClose, wallets, creditCards, categories }) {
  const { getCardCurrentUsed, formatCurrency: fmt, currencySymbol, t, formatDate } = useApp()
  const toast = useToast()
  const [form, setForm] = useState(() => {
    if (initial) return { ...initial, amount: String(initial.amount), tags: initial.tags || [] }
    if (draft) return { ...emptyForm(), ...draft, amount: draft.amount ?? '', tags: draft.tags || [] }
    return { ...emptyForm(), walletId: wallets[0]?.id || '' }
  })
  // Antes o Salvar sem descrição ou valor simplesmente não fazia nada, e um
  // erro do Firestore sumia depois de o modal já ter fechado. Agora os dois
  // aparecem aqui, e o modal só fecha quando a gravação confirma.
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
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

  const nameMissing = !form.name.trim()
  const amountMissing = !(Number(form.amount) > 0)

  // Edição de um lançamento que tem irmãos (recorrência ou parcelas): antes
  // de gravar pergunta se vale só para ele, para os próximos ou para todos.
  const [askScope, setAskScope] = useState(false)
  const needsScope = !!(initial && series && series.totalCount > 1)

  const handleSave = async (scope) => {
    setTried(true)
    setSaveError('')
    if (nameMissing || amountMissing || limitExceeded || saving) return
    if (needsScope && !scope) { setAskScope(true); return }
    setAskScope(false)
    setSaving(true)
    try {
      const write = Promise.resolve(onSave({ ...form, amount: Number(form.amount) }, repeatMode, Number(repeatCount), frequency, scope))
      // Sem internet o Firestore aplica a escrita no cache local na hora, mas
      // a promessa só resolve quando o servidor confirma. Esperar por ela
      // deixaria o botão em "Salvando..." até a conexão voltar.
      const outcome = await Promise.race([
        write.then(() => 'saved'),
        new Promise(resolve => setTimeout(() => resolve('queued'), SERVER_ACK_TIMEOUT)),
      ])
      if (outcome === 'queued') {
        write.catch(err => console.error('[TransactionModal] gravação adiada falhou', err))
        toast.info(t('txModal.savedOffline'))
      } else if (repeatMode === 'recurring') {
        toast.success(t('txModal.savedRecurring', { date: formatDate(form.date) }))
      } else if (form.date.slice(0, 7) !== isoDate().slice(0, 7)) {
        // A lista abre filtrada no mês atual: sem isto, um lançamento de
        // outro mês parecia não ter sido salvo.
        toast.success(t('txModal.savedOtherMonth', { date: formatDate(form.date) }))
      } else {
        toast.success(t('txModal.saved'))
      }
      onClose()
    } catch (err) {
      console.error('[TransactionModal]', err)
      setSaveError(t('txModal.saveFailed', { error: err?.code || err?.message || String(err) }))
      setSaving(false)
    }
  }

  return (
    <>
    <Modal
      title={t(initial ? 'txModal.editTitle' : 'txModal.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave()}
            disabled={limitExceeded || saving}
            style={limitExceeded ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >{saving ? t('txModal.saving') : t('action.save')}</button>
        </>
      }
    >
      {saveError && (
        <div className="form-error-box" role="alert">
          <i className="fi fi-rr-cross-circle" aria-hidden="true" /> {saveError}
        </div>
      )}
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
        <input
          className={`form-input${tried && nameMissing ? ' input-error' : ''}`}
          placeholder={t('txModal.namePlaceholder')}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          aria-invalid={tried && nameMissing}
        />
        {tried && nameMissing && <div className="form-error">{t('txModal.nameRequired')}</div>}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('txModal.value', { symbol: currencySymbol })}</label>
          <CurrencyInput
            className={`form-input${tried && amountMissing ? ' input-error' : ''}`}
            value={form.amount}
            onChange={v => set('amount', v)}
            aria-invalid={tried && amountMissing}
          />
          {tried && amountMissing && <div className="form-error">{t('txModal.amountRequired')}</div>}
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
      {/* Dividir só faz sentido em despesa: ninguém racha um salário. */}
      {form.type === 'expense' && (
        <div className="form-group">
          <label className="form-label">{t('split.label')}</label>
          <SplitEditor
            amount={Number(form.amount) || 0}
            split={form.split}
            onChange={next => set('split', next)}
            onSettle={onSettle ? (p) => onSettle(form, p) : undefined}
          />
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
    {askScope && (
      <SeriesScopeModal
        kind={series.kind}
        action="edit"
        futureCount={series.futureCount}
        totalCount={series.totalCount}
        onChoose={scope => handleSave(scope)}
        onClose={() => setAskScope(false)}
      />
    )}
    </>
  )
}
