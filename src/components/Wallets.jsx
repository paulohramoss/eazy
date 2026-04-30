import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import { DEFAULT_WALLET_ICON, WALLET_ICON_OPTIONS, resolveWalletIcon } from '../utils/walletIcons'

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const WALLET_TYPES = [
  { value: 'checking', label: 'Conta Corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'credit', label: 'Cartão de Crédito' },
  { value: 'investment', label: 'Investimentos' },
  { value: 'cash', label: 'Dinheiro Físico' },
]
const TYPE_LABELS = Object.fromEntries(WALLET_TYPES.map(t => [t.value, t.label]))

const PRESET_COLORS = ['#0053EF', '#CFF330', '#0A0A0A', '#E8382A', '#18A058', '#F59E0B', '#3370F5', '#BBBBBB', '#555555', '#EEF3FF', '#B8DC1A', '#141414']

const EMPTY_FORM = { name: '', type: 'checking', balance: '', color: '#0053EF', icon: DEFAULT_WALLET_ICON }

// ─── Wallet Modal ─────────────────────────────────────────────────────────────

function WalletModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, icon: resolveWalletIcon(initial.icon, initial.type), balance: String(initial.balance) }
    : EMPTY_FORM
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const selectedIcon = resolveWalletIcon(form.icon, form.type)

  const handleSave = () => {
    if (!form.name.trim() || form.balance === '') return
    onSave({ ...form, icon: selectedIcon, balance: Number(form.balance) })
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
          <CurrencyInput className="form-input" value={form.balance} onChange={v => set('balance', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Ícone</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(42px, 42px))', gap: 8 }}>
          {WALLET_ICON_OPTIONS.map(option => {
            const selected = selectedIcon === option.icon
            return (
              <button
                key={option.icon}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => set('icon', option.icon)}
                style={{
                  width: 42, height: 42, borderRadius: 9,
                  background: selected ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-hover)',
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                <i className={`fi ${option.icon}`} />
              </button>
            )
          })}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cor</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESET_COLORS.map(color => (
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
          <label title="Cor personalizada" style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
              background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`,
              border: !PRESET_COLORS.includes(form.color) ? '3px solid white' : '3px solid transparent',
              outline: !PRESET_COLORS.includes(form.color) ? `2px solid ${form.color}` : 'none',
            }} />
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, top: 0, left: 0 }}
            />
          </label>
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
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Saldo Total</div>
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
                <span style={{ fontSize: 25, color: w.color }}>
                  <i className={`fi ${resolveWalletIcon(w.icon, w.type)}`} />
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-icon"
                    title="Editar"
                    onClick={e => { e.stopPropagation(); setEditItem(w) }}
                  ><i className="fi fi-rr-pencil" /></button>
                  <button
                    className="btn-icon danger"
                    title="Excluir"
                    onClick={e => { e.stopPropagation(); setDelItem(w) }}
                  ><i className="fi fi-rr-trash" /></button>
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
