import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CATEGORIES, CatIcon } from '../context/AppContext'
import Modal from './Modal'

const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMPTY_FORM = {
  type: 'expense', name: '', category: 'Alimentação', amount: '',
  date: new Date().toISOString().split('T')[0],
  walletId: '', status: 'completed', notes: '',
}

const STATUS_LABEL = { completed: '● Concluído', pending: '◌ Pendente' }

// ─── Form Modal ───────────────────────────────────────────────────────────────

function TxModal({ initial, onSave, onClose, wallets }) {
  const [form, setForm] = useState(initial
    ? { ...initial, amount: String(initial.amount) }
    : { ...EMPTY_FORM, walletId: wallets[0]?.id || '' }
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.amount || Number(form.amount) <= 0) return
    onSave({ ...form, amount: Number(form.amount) })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Transação' : 'Nova Transação'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
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
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Carteira</label>
          <select className="form-select" value={form.walletId} onChange={e => set('walletId', e.target.value)}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
          </select>
        </div>
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
  const { transactions, wallets, addTransaction, updateTransaction, deleteTransaction, bulkDeleteTransactions, monthlyIncome, monthlyExpenses } = useApp()

  const [search, setSearch] = useState('')
  const [filterType, setType] = useState('all')
  const [filterCat, setCat] = useState('all')
  const [filterStatus, setStatus] = useState('all')
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCat !== 'all' && t.category !== filterCat) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !t.category.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date))

  const net = monthlyIncome - monthlyExpenses
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

  return (
    <div className="screen">
      {/* Summary */}
      <div className="summary-strip">
        <div className="summary-stat">
          <div className="summary-stat-label">Receitas (mês)</div>
          <div className="summary-stat-value positive-text">{fmt(monthlyIncome)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Despesas (mês)</div>
          <div className="summary-stat-value negative-text">{fmt(monthlyExpenses)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Saldo do mês</div>
          <div className={`summary-stat-value ${net >= 0 ? 'positive-text' : 'negative-text'}`}>{fmt(net)}</div>
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
            <span style={{ fontSize: 32 }}>🔍</span>
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
                <th>Descrição</th>
                <th style={{ textAlign: 'center' }}>Categoria</th>
                <th style={{ textAlign: 'center' }}>Carteira</th>
                <th style={{ textAlign: 'center' }}>Data</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
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
                        <div className="tx-name">{tx.name}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="category-tag">{tx.category}</span></td>
                    <td className="tx-date" style={{ textAlign: 'center' }}>{wallet ? `${wallet.icon} ${wallet.name}` : '—'}</td>
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
        <TxModal wallets={wallets} onSave={addTransaction} onClose={() => setAddModal(false)} />
      )}
      {editItem && (
        <TxModal
          initial={editItem} wallets={wallets}
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
