import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CatIcon } from '../context/AppContext'
import Modal from './Modal'
import TransactionModal from './TransactionModal'
import { resolveWalletIcon } from '../utils/walletIcons'

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_LABEL = { completed: '● Concluído', pending: '◌ Pendente' }

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function ConfirmModal({ name, count, onConfirm, onClose }) {
  return (
    <Modal
      title={count ? 'Excluir Transações' : 'Excluir Transação'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Excluir</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        {count
          ? <>Deseja excluir <strong style={{ color: 'var(--text-primary)' }}>{count} transações</strong> selecionadas? Esta ação não pode ser desfeita.</>
          : <>Deseja excluir <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>? Esta ação não pode ser desfeita.</>
        }
      </p>
    </Modal>
  )
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <label className="tx-checkbox">
      <input
        type="checkbox"
        checked={checked}
        ref={el => { if (el) el.indeterminate = !!indeterminate }}
        onChange={onChange}
      />
      <span className="tx-checkbox-box" />
    </label>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Transactions() {
  const { transactions, wallets, creditCards, addTransaction, addMultipleTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, monthlyIncome, monthlyExpenses, categories, thisMonth } = useApp()

  const [search, setSearch] = useState('')
  const [filterType, setType] = useState('all')
  const [filterCat, setCat] = useState('all')
  const [filterStatus, setStatus] = useState('all')
  
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [filterEnd, setFilterEnd] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })

  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCat !== 'all' && t.category !== filterCat) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    
    if (filterStart && t.date && t.date < filterStart) return false
    if (filterEnd && t.date && t.date > filterEnd) return false

    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !t.category.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (sortConfig.key === 'date') {
      const dA = new Date(a.date).getTime()
      const dB = new Date(b.date).getTime()
      return sortConfig.direction === 'asc' ? dA - dB : dB - dA
    }
    if (sortConfig.key === 'amount') {
      const aA = a.type === 'expense' ? -a.amount : a.amount
      const aB = b.type === 'expense' ? -b.amount : b.amount
      return sortConfig.direction === 'asc' ? aA - aB : aB - aA
    }
    if (sortConfig.key === 'name') {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1
      if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    }
    return 0
  })

  const viewIncome = filtered.filter(t => t.type === 'income' && t.status !== 'failed').reduce((s, t) => s + (t.amount || 0), 0)
  const viewExpenses = filtered.filter(t => t.type === 'expense' && t.status !== 'failed').reduce((s, t) => s + (t.amount || 0), 0)
  const viewNet = viewIncome - viewExpenses

  const usedCategories = [...new Set(transactions.map(t => t.category))].sort()

  const filteredIds = filtered.map(t => t.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someSelected = filteredIds.some(id => selected.has(id)) && !allSelected
  const selectedCount = filteredIds.filter(id => selected.has(id)).length

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...filteredIds]))
    }
  }

  const clearSelection = () => setSelected(new Set())

  const handleBulkDelete = () => {
    bulkDeleteTransactions([...selected].filter(id => filteredIds.includes(id)))
    clearSelection()
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="fi fi-rr-sort-alt" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }} />
    return <i className={`fi fi-rr-angle-small-${sortConfig.direction === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 14, marginLeft: 2, position: 'relative', top: 2 }} />
  }

  return (
    <div className="screen">
      {/* Summary */}
      <div className="summary-strip">
        <div className="summary-stat">
          <div className="summary-stat-label">Receitas (filtro)</div>
          <div className="summary-stat-value positive-text">{fmt(viewIncome)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Despesas (filtro)</div>
          <div className="summary-stat-value negative-text">{fmt(viewExpenses)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Saldo (filtro)</div>
          <div className={`summary-stat-value ${viewNet >= 0 ? 'positive-text' : 'negative-text'}`}>{fmt(viewNet)}</div>
        </div>
      </div>

      {/* Filter bar + Add */}
      <div className="filter-bar">
        <div className="search-box">
          <i className="fi fi-rr-search search-icon" />
          <input
            className="search-input"
            placeholder="Buscar transações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input 
            type="date" 
            className="filter-select" 
            value={filterStart} 
            onChange={e => setFilterStart(e.target.value)} 
            title="Data inicial"
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
          <input 
            type="date" 
            className="filter-select" 
            value={filterEnd} 
            onChange={e => setFilterEnd(e.target.value)} 
            title="Data final"
          />
        </div>
        <select className="filter-select" value={filterType} onChange={e => setType(e.target.value)}>
          <option value="all">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select className="filter-select" value={filterCat} onChange={e => setCat(e.target.value)}>
          <option value="all">Todas as categorias</option>
          {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="completed">Concluído</option>
          <option value="pending">Pendente</option>
        </select>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAddModal(true)}>
          <i className="fi fi-rr-plus" /> Nova Transação
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tx-table-header">
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {filtered.length} transaç{filtered.length > 1 ? 'ões' : 'ão'}
          </span>

          {selectedCount > 0 && (
            <div className="tx-bulk-bar">
              <span className="tx-bulk-count">{selectedCount} selecionada{selectedCount > 1 ? 's' : ''}</span>
              <button className="btn btn-danger btn-sm" onClick={() => setBulkConfirm(true)}>
                <i className="fi fi-rr-trash" /> Excluir selecionadas
              </button>
              <button className="btn btn-secondary btn-sm" onClick={clearSelection}>
                Cancelar
              </button>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <i className="fi fi-rr-search" style={{ fontSize: 30, color: 'var(--text-muted)' }} />
            <p>Nenhuma transação encontrada</p>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tente ajustar os filtros</span>
          </div>
        ) : (<>
          {/* ── Desktop table ── */}
          <table className="transactions-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                  Descrição {renderSortIcon('name')}
                </th>
                <th style={{ textAlign: 'center' }}>Categoria</th>
                <th style={{ textAlign: 'center' }}>Carteira</th>
                <th style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>
                  Data {renderSortIcon('date')}
                </th>
                <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('amount')}>
                  Valor {renderSortIcon('amount')}
                </th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => {
                const wallet = wallets.find(w => w.id === tx.walletId)
                const isSelected = selected.has(tx.id)
                return (
                  <tr key={tx.id} className={isSelected ? 'tx-row-selected' : ''}>
                    <td style={{ paddingLeft: 20 }}>
                      <Checkbox checked={isSelected} onChange={() => toggleOne(tx.id)} />
                    </td>
                    <td>
                      <div className="tx-info">
                        <div className="tx-icon" style={{ background: 'var(--bg-hover)' }}>
                          <CatIcon category={tx.category} />
                        </div>
                        <div>
                          <div className="tx-name">{tx.name}</div>
                          {tx.tags?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                              {tx.tags.map(tag => (
                                <span key={tag} style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 99,
                                  background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', fontWeight: 600,
                                }}>#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="category-tag">{tx.category}</span></td>
                    <td className="tx-date" style={{ textAlign: 'center' }}>
                      {wallet ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <i className={`fi ${resolveWalletIcon(wallet.icon, wallet.type)}`} />
                          {wallet.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="tx-date" style={{ textAlign: 'center' }}>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                    <td className="tx-status">
                      <span className={`status-badge ${tx.status}`}>{STATUS_LABEL[tx.status]}</span>
                    </td>
                    <td>
                      <div className="table-actions" style={{ justifyContent: 'center' }}>
                        <button className="btn-icon" title="Editar" onClick={() => setEditItem(tx)}><i className="fi fi-rr-pencil" /></button>
                        <button className="btn-icon danger" title="Excluir" onClick={() => setDelItem(tx)}><i className="fi fi-rr-trash" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Mobile card-list ── */}
          <ul className="tx-card-list">
            {filtered.map(tx => {
              const wallet = wallets.find(w => w.id === tx.walletId)
              const isSelected = selected.has(tx.id)
              return (
                <li key={tx.id} className={`tx-card${isSelected ? ' tx-card--selected' : ''}`}
                  onClick={() => toggleOne(tx.id)}>
                  <div className="tx-icon" style={{ background: 'var(--bg-hover)', flexShrink: 0 }}>
                    <CatIcon category={tx.category} />
                  </div>
                  <div className="tx-card-body">
                    <div className="tx-card-top">
                      <span className="tx-card-name">{tx.name}</span>
                      <span className={`tx-card-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                    </div>
                    <div className="tx-card-meta">
                      <span className="category-tag">{tx.category}</span>
                      {wallet && <span className="tx-card-wallet">{wallet.name}</span>}
                    </div>
                    <div className="tx-card-bottom">
                      <span className="tx-date">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className={`status-badge ${tx.status}`}>{STATUS_LABEL[tx.status]}</span>
                      <div className="table-actions" style={{ marginLeft: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <button className="btn-icon" onClick={() => setEditItem(tx)}><i className="fi fi-rr-pencil" /></button>
                        <button className="btn-icon danger" onClick={() => setDelItem(tx)}><i className="fi fi-rr-trash" /></button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>)}
      </div>

      {addModal && (
        <TransactionModal wallets={wallets} creditCards={creditCards} categories={categories}
          onSave={(data, mode, count) => {
            if (mode === 'unique') addTransaction(data)
            else addMultipleTransactions(data, mode, count)
          }}
          onClose={() => setAddModal(false)} />
      )}
      {editItem && (
        <TransactionModal
          initial={editItem} wallets={wallets} creditCards={creditCards} categories={categories}
          onSave={(data) => updateTransaction(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <ConfirmModal
          name={delItem.name}
          onConfirm={() => deleteTransaction(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
      {bulkConfirm && (
        <ConfirmModal
          count={selectedCount}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkConfirm(false)}
        />
      )}
    </div>
  )
}
