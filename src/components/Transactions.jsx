import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CatIcon } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import { resolveWalletIcon } from '../utils/walletIcons'

const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMPTY_FORM = {
  type: 'expense', name: '', category: 'Alimentação', amount: '',
  date: new Date().toISOString().split('T')[0],
  walletId: '', cardId: '', status: 'completed', notes: '', tags: [],
}

const STATUS_LABEL = { completed: '● Concluído', pending: '◌ Pendente' }

// ─── Form Modal ───────────────────────────────────────────────────────────────

function TxModal({ initial, onSave, onClose, wallets, creditCards, categories }) {
  const { getCardCurrentUsed } = useApp()
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
          <label className="form-label">Valor (R$)</label>
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
                      Disponível: <strong>{(Number(cardAvailable) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      {' · '}Falta: <strong>{(newAmount - cardAvailable).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600 }}>
                      Disponível: {cardAvailable.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {newAmount > 0 && (
                        <span style={{ fontWeight: 400, opacity: 0.75 }}>
                          {' → '}
                          {(cardAvailable - newAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        ) : (
          <table className="transactions-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
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
        )}
      </div>

      {addModal && (
        <TxModal wallets={wallets} creditCards={creditCards} categories={categories} 
          onSave={(data, mode, count) => {
            if (mode === 'unique') addTransaction(data)
            else addMultipleTransactions(data, mode, count)
          }} 
          onClose={() => setAddModal(false)} />
      )}
      {editItem && (
        <TxModal
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
