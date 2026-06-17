import { useState, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'

const CARD_COLORS = [
  '#0053EF', '#0A0A0A', '#1E1E1E', '#2A2A2A',
  '#141414', '#E8382A', '#18A058', '#555555',
  '#3370F5', '#0040C4', '#888888', '#BBBBBB',
]

const CARD_FLAGS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro']

const EMPTY_FORM = {
  name: '', flag: 'Visa', limit: '', closingDay: '10', dueDay: '17', color: '#1a1a2e',
}

// ─── Card Visual ──────────────────────────────────────────────────────────────

function CardVisual({ card, used, mini = false }) {
  const { formatCurrency: fmt } = useApp()
  const available = (card.limit || 0) - used
  const pct = card.limit ? Math.min((used / card.limit) * 100, 100) : 0

  return (
    <div className={`cc-card${mini ? ' cc-card--mini' : ''}`} style={{ backgroundColor: card.color, backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(0,0,0,0.25) 100%)' }}>
      <div className="cc-card-top">
        <div className="cc-card-name">{card.name}</div>
        <div className="cc-card-flag">{card.flag}</div>
      </div>
      <div className="cc-card-number">•••• •••• •••• ••••</div>
      <div className="cc-card-bottom">
        <div>
          <div className="cc-card-label">Disponível</div>
          <div className="cc-card-value">{fmt(available)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="cc-card-label">Limite total</div>
          <div className="cc-card-value">{fmt(card.limit)}</div>
        </div>
      </div>
      <div className="cc-card-bar">
        <div className="cc-card-bar-fill" style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : '#fff' }} />
      </div>
    </div>
  )
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

function CardModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, limit: String(initial.limit || '') }
    : { ...EMPTY_FORM }
  )
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.limit) return
    onSave({ ...form, limit: Number(form.limit), closingDay: Number(form.closingDay), dueDay: Number(form.dueDay) })
    onClose()
  }

  return (
    <Modal title={initial ? 'Editar Cartão' : 'Novo Cartão'} onClose={onClose} size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Nome do cartão</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Nubank, Inter..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Bandeira</label>
            <select className="form-select" value={form.flag} onChange={e => set('flag', e.target.value)}>
              {CARD_FLAGS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Limite</label>
            <CurrencyInput value={form.limit} onChange={v => set('limit', v)} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Dia de fechamento</label>
            <input className="form-input" type="number" min="1" max="31" value={form.closingDay} onChange={e => set('closingDay', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Dia de vencimento</label>
            <input className="form-input" type="number" min="1" max="31" value={form.dueDay} onChange={e => set('dueDay', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Cor do cartão</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {CARD_COLORS.map(c => (
              <button
                key={c}
                onClick={() => set('color', c)}
                style={{
                  width: 28, height: 28, borderRadius: 6, background: c, border: 'none', cursor: 'pointer',
                  outline: form.color === c ? '2px solid var(--accent)' : '2px solid transparent',
                  outlineOffset: 2,
                }}
              />
            ))}
            <label title="Cor personalizada" style={{
              width: 28, height: 28, borderRadius: 6, border: '2px dashed var(--border)',
              cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: !CARD_COLORS.includes(form.color) ? '2px solid var(--accent)' : '2px solid transparent',
              outlineOffset: 2, flexShrink: 0, background: !CARD_COLORS.includes(form.color) ? form.color : 'transparent',
            }}>
              <input
                type="color"
                value={form.color}
                onChange={e => set('color', e.target.value)}
                style={{ opacity: 0, width: 1, height: 1, position: 'absolute' }}
              />
              {CARD_COLORS.includes(form.color) && (
                <i className="fi fi-rr-paint-brush" style={{ fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              )}
            </label>
          </div>
        </div>
        <div>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Prévia</label>
          <CardVisual card={{ ...form, limit: Number(form.limit) || 0 }} used={0} />
        </div>
      </div>
    </Modal>
  )
}

// ─── Invoice / Fatura ─────────────────────────────────────────────────────────

function Invoice({ card, transactions, onClose }) {
  const { formatCurrency: fmt } = useApp()
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cardTx = transactions.filter(t => t.cardId === card.id && t.date?.startsWith(thisMonth))
  const total = cardTx.reduce((s, t) => s + (t.amount || 0), 0)

  return (
    <Modal title={`Fatura — ${card.name}`} onClose={onClose} size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vence dia {card.dueDay}</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total: {fmt(total)}</span>
        </div>
      }
    >
      {cardTx.length === 0 ? (
        <div className="empty-state"><p>Nenhum lançamento neste mês.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cardTx.map(t => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.date} · {t.category}</div>
              </div>
              <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ card, onConfirm, onClose }) {
  return (
    <Modal title="Excluir cartão" onClose={onClose} size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }} onClick={onConfirm}>Excluir</button>
        </div>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Tem certeza que deseja excluir o cartão <strong>{card.name}</strong>?<br />
        Esta ação não pode ser desfeita.
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CreditCards() {
  const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard, transactions, getCardCurrentUsed, formatCurrency: fmt } = useApp()
  const [modal, setModal] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const carouselRef = useRef(null)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // usedByCard agora usa ciclo de faturamento (reseta no closingDay)
  const usedByCard = useMemo(() => {
    const map = {}
    creditCards.forEach(c => {
      map[c.id] = getCardCurrentUsed(c.id)
    })
    return map
  }, [creditCards, getCardCurrentUsed])

  const totalLimit = creditCards.reduce((s, c) => s + (c.limit || 0), 0)
  const totalUsed = creditCards.reduce((s, c) => s + (usedByCard[c.id] || 0), 0)

  const activeCard = creditCards.find(c => c.id === selectedId) ?? creditCards[0] ?? null
  const used = activeCard ? (usedByCard[activeCard.id] || 0) : 0
  const usedPct = activeCard?.limit ? Math.min((used / activeCard.limit) * 100, 100) : 0

  const handleSave = (data) => {
    if (modal?.card) updateCreditCard(modal.card.id, data)
    else addCreditCard(data)
  }

  const cardTx = activeCard
    ? transactions
        .filter(t => t.cardId === activeCard.id && t.date?.startsWith(thisMonth))
        .sort((a, b) => b.date?.localeCompare(a.date))
    : []

  return (
    <div className="screen">

      {/* ── Summary KPIs ─────────────────────────────────────── */}
      <div className="metrics-grid" style={{ marginBottom: 28 }}>
        {[
          { label: 'Limite Total', value: fmt(totalLimit), icon: 'fi-rr-credit-card', color: 'purple' },
          { label: 'Fatura do Mês', value: fmt(totalUsed), icon: 'fi-rr-receipt', color: 'red' },
          { label: 'Disponível', value: fmt(totalLimit - totalUsed), icon: 'fi-rr-check-circle', color: 'green', negative: totalLimit - totalUsed < 0 },
          { label: 'Cartões', value: creditCards.length, icon: 'fi-rr-layers', color: 'yellow' },
        ].map(k => (
          <div key={k.label} className={`metric-card metric-card--${k.color}`}>
            <div className="metric-header">
              <span className="metric-label">{k.label}</span>
              <div className={`metric-icon ${k.color}`}><i className={`fi ${k.icon}`} /></div>
            </div>
            <div className="metric-value" style={k.negative ? { color: 'var(--accent-red)' } : undefined}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Card Carousel ────────────────────────────────────── */}
      <div className="cc-section-label">
        <i className="fi fi-rr-credit-card" />
        Meus Cartões
      </div>

      <div className="cc-carousel-wrapper">
        <div className="cc-carousel" ref={carouselRef}>
          {creditCards.map(card => (
            <div
              key={card.id}
              className={`cc-carousel-item${activeCard?.id === card.id ? ' cc-carousel-item--active' : ''}`}
              onClick={() => setSelectedId(card.id)}
            >
              <CardVisual card={card} used={usedByCard[card.id] || 0} />
            </div>
          ))}

          {/* Add card slot */}
          <div className="cc-carousel-item cc-carousel-add" onClick={() => setModal('add')}>
            <div className="cc-add-card">
              <div className="cc-add-icon"><i className="fi fi-rr-plus" /></div>
              <span>Adicionar cartão</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Detail ──────────────────────────────────────── */}
      {activeCard ? (
        <div className="cc-detail">

          {/* Header */}
          <div className="cc-detail-header">
            <div className="cc-detail-identity">
              <div className="cc-detail-dot" style={{ background: activeCard.color }} />
              <div>
                <div className="cc-detail-name">{activeCard.name}</div>
                <div className="cc-detail-meta">
                  {activeCard.flag} &nbsp;·&nbsp; Fecha dia {activeCard.closingDay} &nbsp;·&nbsp; Vence dia {activeCard.dueDay}
                </div>
              </div>
            </div>
            <div className="cc-detail-actions">
              <button className="btn btn-secondary cc-action-btn" onClick={() => setInvoice(activeCard)}>
                <i className="fi fi-rr-receipt" /> Ver fatura
              </button>
              <button className="btn btn-secondary cc-action-btn" onClick={() => setModal({ card: activeCard })}>
                <i className="fi fi-rr-edit" /> Editar
              </button>
              <button className="btn btn-secondary cc-action-btn cc-action-btn--danger" onClick={() => setDeleteTarget(activeCard)}>
                <i className="fi fi-rr-trash" /> Excluir
              </button>
            </div>
          </div>

          {/* Spending progress */}
          <div className="cc-spending">
            <div className="cc-spending-row">
              <span className="cc-spending-label">Gasto este mês</span>
              <span className="cc-spending-values">
                <span className="cc-spending-used">{fmt(used)}</span>
                <span className="cc-spending-sep"> / </span>
                <span className="cc-spending-limit">{fmt(activeCard.limit)}</span>
                <span className={`cc-spending-pct${usedPct > 80 ? ' cc-spending-pct--danger' : ''}`}>{usedPct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="cc-spending-bar">
              <div
                className="cc-spending-fill"
                style={{
                  width: `${usedPct}%`,
                  background: usedPct > 80 ? 'var(--accent-red)' : 'var(--accent)',
                }}
              />
            </div>
            <div className="cc-spending-row" style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Disponível</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: (activeCard.limit || 0) - used < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{fmt((activeCard.limit || 0) - used)}</span>
            </div>
          </div>

          {/* Transactions */}
          <div className="cc-tx-section">
            <div className="cc-tx-header">
              <span className="cc-section-label" style={{ marginBottom: 0 }}>
                <i className="fi fi-rr-list" /> Lançamentos do mês
              </span>
              {cardTx.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cardTx.length} {cardTx.length === 1 ? 'item' : 'itens'}</span>
              )}
            </div>

            {cardTx.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 100 }}>
                <i className="fi fi-rr-receipt" style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>Nenhum lançamento neste cartão este mês.</p>
              </div>
            ) : (
              <div className="cc-tx-list">
                {cardTx.map(t => (
                  <div key={t.id} className="cc-tx-item">
                    <div className="cc-tx-icon" style={{ background: `${activeCard.color}22`, color: activeCard.color }}>
                      <i className="fi fi-rr-shopping-cart" />
                    </div>
                    <div className="cc-tx-info">
                      <div className="cc-tx-name">{t.name}</div>
                      <div className="cc-tx-sub">
                        {t.date && new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                        {t.category && <span className="category-tag" style={{ fontSize: 10, marginLeft: 6 }}>{t.category}</span>}
                      </div>
                    </div>
                    <span className="cc-tx-amount">- {fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="settings-section">
          <div className="empty-state" style={{ minHeight: 180 }}>
            <i className="fi fi-rr-credit-card" style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }} />
            <p>Nenhum cartão cadastrado.<br />Clique em "Adicionar cartão" para começar.</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal === 'add' || modal?.card) && (
        <CardModal
          initial={modal?.card || null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {invoice && (
        <Invoice card={invoice} transactions={transactions} onClose={() => setInvoice(null)} />
      )}
      {deleteTarget && (
        <DeleteModal
          card={deleteTarget}
          onConfirm={() => { deleteCreditCard(deleteTarget.id); setDeleteTarget(null) }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
