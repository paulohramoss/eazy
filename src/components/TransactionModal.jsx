import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'

const EMPTY_FORM = {
  type: 'expense', name: '', category: 'Alimentação', amount: '',
  date: new Date().toISOString().split('T')[0],
  walletId: '', cardId: '', status: 'completed', notes: '', tags: [],
}

export default function TransactionModal({ initial, onSave, onClose, wallets, creditCards, categories }) {
  const { getCardCurrentUsed, formatCurrency: fmt, currencySymbol } = useApp()
  const [form, setForm] = useState(initial
    ? { ...initial, amount: String(initial.amount), tags: initial.tags || [] }
    : { ...EMPTY_FORM, walletId: wallets[0]?.id || '' }
  )
  const [repeatMode, setRepeatMode] = useState('unique')
  const [repeatCount, setRepeatCount] = useState(12)
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
    onSave({ ...form, amount: Number(form.amount) }, repeatMode, Number(repeatCount))
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Transação' : 'Nova Transação'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={limitExceeded}
            style={limitExceeded ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >Salvar</button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="completed">Concluído</option>
            <option value="pending">Pendente</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Descrição</label>
        <input className="form-input" placeholder="Ex: Supermercado, Salário..." value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valor ({currencySymbol})</label>
          <CurrencyInput className="form-input" value={form.amount} onChange={v => set('amount', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
      </div>
      {!initial && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Repetição</label>
            <select className="form-select" value={repeatMode} onChange={e => setRepeatMode(e.target.value)}>
              <option value="unique">Única</option>
              <option value="installment">Parcelada</option>
              <option value="recurring">Fixa / Recorrente</option>
            </select>
          </div>
          {repeatMode !== 'unique' && (
            <div className="form-group">
              <label className="form-label">{repeatMode === 'installment' ? 'Número de Parcelas' : 'Duração (Meses)'}</label>
              <input className="form-input" type="number" min="2" max="120" value={repeatCount} onChange={e => setRepeatCount(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">
            Carteira
            {form.cardId && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', marginLeft: 5 }}>(opcional)</span>}
          </label>
          <select
            className="form-select"
            value={form.walletId}
            onChange={e => set('walletId', e.target.value)}
            disabled={!!form.cardId}
            style={form.cardId ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            <option value="">— Nenhuma —</option>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>
      {form.type === 'expense' && creditCards.length > 0 && (
        <div className="form-group">
          <label className="form-label">Cartão de crédito</label>
          <select className="form-select" value={form.cardId} onChange={e => handleCardChange(e.target.value)}>
            <option value="">— Não usar cartão —</option>
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
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Limite insuficiente</div>
                    <div style={{ opacity: 0.85 }}>
                      Disponível: <strong>{fmt(cardAvailable)}</strong>
                      {' · '}Falta: <strong>{fmt(newAmount - cardAvailable)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>
                      Disponível: {fmt(cardAvailable)}
                      {newAmount > 0 && (
                        <span style={{ fontWeight: 400, opacity: 0.75 }}>
                          {' → '}
                          {fmt(cardAvailable - newAmount)}
                          {' após'}
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
        <label className="form-label">Tags</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {(form.tags || []).map(tag => (
            <span key={tag} style={{
              fontSize: 12, padding: '3px 8px', borderRadius: 99,
              background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              #{tag}
              <button onClick={() => set('tags', form.tags.filter(t => t !== tag))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="form-input" placeholder="Adicionar tag..." value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
                if (!form.tags.includes(t)) set('tags', [...(form.tags || []), t])
                setTagInput('')
              }
            }} style={{ flex: 1 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Pressione Enter para adicionar</div>
      </div>
      <div className="form-group">
        <label className="form-label">Observações</label>
        <textarea className="form-textarea" placeholder="Opcional..." value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}
