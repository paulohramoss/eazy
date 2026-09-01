import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import DeleteWithTransactionsModal from './DeleteWithTransactionsModal'
import { useToast } from './Toast'
import Checkbox from './Checkbox'
import { isoDate } from '../utils/date'
import CurrencyInput from './CurrencyInput'
import { DEFAULT_WALLET_ICON, WALLET_ICON_OPTIONS, resolveWalletIcon } from '../utils/walletIcons'

const WALLET_TYPES = [
  { value: 'checking',   labelKey: 'wallet.type.checking' },
  { value: 'savings',    labelKey: 'wallet.type.savings' },
  { value: 'credit',     labelKey: 'wallet.type.credit' },
  { value: 'investment', labelKey: 'wallet.type.investment' },
  { value: 'cash',       labelKey: 'wallet.type.cash' },
]
const TYPE_KEYS = Object.fromEntries(WALLET_TYPES.map(wt => [wt.value, wt.labelKey]))

const PRESET_COLORS = ['#0053EF', '#CFF330', '#0A0A0A', '#E8382A', '#18A058', '#F59E0B', '#3370F5', '#BBBBBB', '#555555', '#EEF3FF', '#B8DC1A', '#141414']

const EMPTY_FORM = { name: '', type: 'checking', balance: 0, color: '#0053EF', icon: DEFAULT_WALLET_ICON }


// ─── Wallet Modal ─────────────────────────────────────────────────────────────

function WalletModal({ initial, onSave, onClose }) {
  const { currencySymbol, t } = useApp()
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
      title={t(initial ? 'wallet.editTitle' : 'wallet.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('action.save')}</button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">{t('wallet.name')}</label>
        <input className="form-input" placeholder={t('wallet.namePlaceholder')} value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('wallet.type')}</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            {WALLET_TYPES.map(wt => <option key={wt.value} value={wt.value}>{t(wt.labelKey)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Saldo Inicial ({currencySymbol})</label>
          <CurrencyInput className="form-input" value={form.balance} onChange={v => set('balance', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('wallet.icon')}</label>
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
        <label className="form-label">{t('wallet.color')}</label>
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
          <label title={t('wallet.customColor')} style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer' }}>
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

// Mensagem de confirmação: diz o que aconteceu com as transações, não só que a
// carteira sumiu.
function describeDeletion(t, count, affected, mode, targetName) {
  const base = count > 1 ? t('wallet.deletedMany', { count }) : t('wallet.deleted')
  if (!affected) return `${base}.`
  const key = mode === 'move' ? 'wallet.movedTx' : mode === 'delete' ? 'wallet.removedTx' : 'wallet.orphanedTx'
  return `${base}. ${t(key, { count: affected, target: targetName })}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Wallets() {
  const { wallets, transactions, walletStatsAsOf, addWallet, updateWallet, deleteWallet, bulkDeleteWallets, formatCurrency: fmt, formatDate, t } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [activeWallet, setActiveWallet] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [asOf, setAsOf] = useState(isoDate)
  const toast = useToast()

  const isToday = asOf === isoDate()
  const stats = useMemo(() => walletStatsAsOf(asOf), [walletStatsAsOf, asOf])
  const totalAsOf = useMemo(
    () => Object.values(stats).reduce((sum, st) => sum + st.balance, 0),
    [stats])

  // A lista do card também respeita o corte, senão os números não fecham.
  const walletTx = activeWallet
    ? transactions.filter(tx => tx.walletId === activeWallet && tx.date && tx.date <= asOf)
    : []

  // Derivar da lista atual descarta ids de carteiras já removidas e mantém a ordem da grid.
  const selectedIds = useMemo(() => wallets.filter(w => selected.has(w.id)).map(w => w.id), [wallets, selected])
  const allSelected = wallets.length > 0 && selectedIds.length === wallets.length
  const someSelected = selectedIds.length > 0 && !allSelected

  const countTx = (ids) => transactions.filter(tx => ids.includes(tx.walletId)).length

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(wallets.map(w => w.id)))
  const clearSelection = () => setSelected(new Set())

  const handleBulkDelete = async (mode, targetId) => {
    const ids = selectedIds
    if (ids.includes(activeWallet)) setActiveWallet(null)
    clearSelection()
    const affected = await bulkDeleteWallets(ids, { mode, targetId })
    toast.success(describeDeletion(t, ids.length, affected, mode, wallets.find(w => w.id === targetId)?.name))
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="wallets-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {isToday ? t('wallet.totalToday') : t('wallet.totalOn', { date: formatDate(asOf) })}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{fmt(totalAsOf)}</div>
        </div>
        <div className="wallets-header-actions">
          <label className="wallets-asof">
            <span>{t('wallet.balanceOn')}</span>
            <input
              type="date"
              className="form-input wallets-asof-input"
              value={asOf}
              onChange={e => setAsOf(e.target.value || isoDate())}
            />
          </label>
          {!isToday && (
            <button className="btn btn-secondary btn-sm" onClick={() => setAsOf(isoDate())}>{t('wallet.today')}</button>
          )}
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>{t('wallet.new')}</button>
        </div>
      </div>

      {/* Seleção múltipla */}
      {wallets.length > 0 && (
        <div className="wallets-toolbar">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
            label={t('wallet.selectAll')}
          />
          <span className="wallets-toolbar-label">
            {selectedIds.length > 0
              ? t('wallet.selectedCount', { count: selectedIds.length, total: wallets.length })
              : t('wallet.selectPrompt')}
          </span>
          {selectedIds.length > 0 && (
            <div className="tx-bulk-bar">
              <button className="btn btn-secondary btn-sm" onClick={clearSelection}>{t('wallet.clear')}</button>
              <button className="btn btn-danger btn-sm" onClick={() => setBulkConfirm(true)}>
                <i className="fi fi-rr-trash" style={{ marginRight: 6 }} />
                {t('wallet.deleteSelected')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wallet Cards */}
      {wallets.length === 0 ? (
        <div className="moovia-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <i className="fi fi-rr-wallet" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t('wallet.empty')}</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>{t('wallet.createFirst')}</button>
        </div>
      ) : (
      <div className="wallets-grid">
        {wallets.map(w => {
          const { balance: currentBalance, income, expenses } = stats[w.id] ?? { balance: w.balance, income: 0, expenses: 0 }
          const isActive = activeWallet === w.id
          const isChecked = selected.has(w.id)

          return (
            <div
              key={w.id}
              className={`wallet-card${isActive ? ' wallet-card-selected' : ''}${isChecked ? ' wallet-card--checked' : ''}`}
              onClick={() => setActiveWallet(isActive ? null : w.id)}
            >
              <div className="wallet-card-accent" style={{ background: w.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 25, color: w.color }}>
                  <i className={`fi ${resolveWalletIcon(w.icon, w.type)}`} />
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {/* stopPropagation: senão o clique também abre/fecha as transações do card */}
                  <span onClick={e => e.stopPropagation()} style={{ display: 'flex', marginRight: 2 }}>
                    <Checkbox
                      checked={isChecked}
                      onChange={() => toggleOne(w.id)}
                      label={`Selecionar ${w.name}`}
                    />
                  </span>
                  <button
                    className="btn-icon"
                    title={t('action.edit')}
                    onClick={e => { e.stopPropagation(); setEditItem(w) }}
                  ><i className="fi fi-rr-pencil" /></button>
                  <button
                    className="btn-icon danger"
                    title={t('action.delete')}
                    onClick={e => { e.stopPropagation(); setDelItem(w) }}
                  ><i className="fi fi-rr-trash" /></button>
                </div>
              </div>
              <div>
                <div className="wallet-card-name">{w.name}</div>
                <div className="wallet-card-balance">{fmt(currentBalance)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="wallet-card-type">{TYPE_KEYS[w.type] ? t(TYPE_KEYS[w.type]) : w.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'var(--accent-green)' }}>↑ {fmt(income)}</span>
                <span style={{ color: 'var(--accent-red)' }}>↓ {fmt(expenses)}</span>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* Wallet transactions */}
      {activeWallet && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {t('wallet.txTitle', { name: wallets.find(w => w.id === activeWallet)?.name })}
              </div>
              <div className="card-subtitle">
                {isToday
                  ? t('wallet.txCount', { count: walletTx.length })
                  : t('wallet.txCountUntil', { count: walletTx.length, date: formatDate(asOf) })}
              </div>
            </div>
            <button className="card-action" onClick={() => setActiveWallet(null)}>{t('action.close')}</button>
          </div>
          {walletTx.length === 0 ? (
            <div className="empty-state"><p>{t('wallet.noTx')}</p></div>
          ) : (
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>{t('tx.description')}</th>
                  <th>{t('tx.category')}</th>
                  <th>{t('tx.date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('tx.amount')}</th>
                  <th style={{ textAlign: 'center' }}>{t('tx.status')}</th>
                </tr>
              </thead>
              <tbody>
                {walletTx
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map(tx => (
                    <tr key={tx.id}>
                      <td><span style={{ fontWeight: 500 }}>{tx.name}</span></td>
                      <td><span className="category-tag">{tx.category}</span></td>
                      <td className="tx-date">{formatDate(tx.date)}</td>
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
        <DeleteWithTransactionsModal
          title={t('wallet.deleteOneTitle')}
          entityLabel="carteira"
          names={[delItem.name]}
          affectedCount={countTx([delItem.id])}
          targets={wallets.filter(w => w.id !== delItem.id).map(w => ({ id: w.id, name: w.name }))}
          onConfirm={async (mode, targetId) => {
            if (activeWallet === delItem.id) setActiveWallet(null)
            const affected = await deleteWallet(delItem.id, { mode, targetId })
            toast.success(describeDeletion(t, 1, affected, mode, wallets.find(w => w.id === targetId)?.name))
          }}
          onClose={() => setDelItem(null)}
        />
      )}
      {bulkConfirm && (
        <DeleteWithTransactionsModal
          title={t('wallet.deleteManyTitle')}
          entityLabel="carteira"
          names={wallets.filter(w => selected.has(w.id)).map(w => w.name)}
          affectedCount={countTx(selectedIds)}
          targets={wallets.filter(w => !selected.has(w.id)).map(w => ({ id: w.id, name: w.name }))}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkConfirm(false)}
        />
      )}
    </div>
  )
}
