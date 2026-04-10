import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const WALLET_TYPES = [
  { value: 'checking', label: 'Conta Corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'credit', label: 'Cartão de Crédito' },
  { value: 'investment', label: 'Investimentos' },
  { value: 'cash', label: 'Dinheiro Físico' },
]
const TYPE_LABELS = Object.fromEntries(WALLET_TYPES.map(t => [t.value, t.label]))

const WALLET_ICONS = ['🏦', '🐷', '💳', '📈', '💵', '🏧', '💰', '🪙']
const WALLET_COLORS = ['#6c63ff', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#64748b', '#14b8a6', '#f97316']

const EMPTY_FORM = { name: '', type: 'checking', balance: '', color: '#6c63ff', icon: '🏦' }

// ─── Wallet Modal ─────────────────────────────────────────────────────────────

function WalletModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, balance: String(initial.balance) }
    : EMPTY_FORM
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || form.balance === '') return
    onSave({ ...form, balance: Number(form.balance) })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Carteira' : 'Nova Carteira'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Nome</label>
        <input className="form-input" placeholder="Ex: Nubank, Poupança..." value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            {WALLET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Saldo Atual (R$)</label>
          <input className="form-input" type="number" step="0.01" placeholder="0,00" value={form.balance} onChange={e => set('balance', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Ícone</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {WALLET_ICONS.map(icon => (
            <button
              key={icon}
              type="button"
              onClick={() => set('icon', icon)}
              style={{
                width: 40, height: 40, fontSize: 20, borderRadius: 8,
                background: form.icon === icon ? 'rgba(108,99,255,0.2)' : 'var(--bg-hover)',
                border: form.icon === icon ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >{icon}</button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cor</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {WALLET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => set('color', color)}
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
      title="Excluir Carteira"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Excluir</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Deseja excluir a carteira <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Wallets() {
  const { wallets, transactions, addWallet, updateWallet, deleteWallet, totalBalance } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [activeWallet, setActiveWallet] = useState(null)

  const walletTx = activeWallet
    ? transactions.filter(t => t.walletId === activeWallet)
    : []

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Patrimônio Total</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{fmt(totalBalance)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Nova Carteira</button>
      </div>

      {/* Wallet Cards */}
      <div className="wallets-grid">
        {wallets.map(w => {
          const income = transactions.filter(t => t.walletId === w.id && t.type === 'income' && t.status !== 'failed').reduce((s, t) => s + t.amount, 0)
          const expenses = transactions.filter(t => t.walletId === w.id && t.type === 'expense' && t.status !== 'failed').reduce((s, t) => s + t.amount, 0)
          const isActive = activeWallet === w.id

          return (
            <div
              key={w.id}
              className={`wallet-card${isActive ? ' wallet-card-selected' : ''}`}
              onClick={() => setActiveWallet(isActive ? null : w.id)}
            >
              <div className="wallet-card-accent" style={{ background: w.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 28 }}>{w.icon}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-icon"
                    title="Editar"
                    onClick={e => { e.stopPropagation(); setEditItem(w) }}
                  >✏️</button>
                  <button
                    className="btn-icon danger"
                    title="Excluir"
                    onClick={e => { e.stopPropagation(); setDelItem(w) }}
                  >🗑️</button>
                </div>
              </div>
              <div>
                <div className="wallet-card-name">{w.name}</div>
                <div className="wallet-card-balance">{fmt(w.balance)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="wallet-card-type">{TYPE_LABELS[w.type] || w.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'var(--accent-green)' }}>↑ {fmt(income)}</span>
                <span style={{ color: 'var(--accent-red)' }}>↓ {fmt(expenses)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Wallet transactions */}
      {activeWallet && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                Transações — {wallets.find(w => w.id === activeWallet)?.name}
              </div>
              <div className="card-subtitle">{walletTx.length} movimentação(ões)</div>
            </div>
            <button className="card-action" onClick={() => setActiveWallet(null)}>Fechar</button>
          </div>
          {walletTx.length === 0 ? (
            <div className="empty-state"><p>Nenhuma transação nesta carteira</p></div>
          ) : (
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {walletTx
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map(tx => (
                    <tr key={tx.id}>
                      <td><span style={{ fontWeight: 500 }}>{tx.name}</span></td>
                      <td><span className="category-tag">{tx.category}</span></td>
                      <td className="tx-date">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </td>
                      <td className="tx-status">
                        <span className={`status-badge ${tx.status}`}>
                          {{ completed: '● Concluído', pending: '◌ Pendente' }[tx.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {addModal && <WalletModal onSave={addWallet} onClose={() => setAddModal(false)} />}
      {editItem && (
        <WalletModal
          initial={editItem}
          onSave={data => updateWallet(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <ConfirmModal
          name={delItem.name}
          onConfirm={() => deleteWallet(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
