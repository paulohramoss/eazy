import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'

const fmt  = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const TYPES  = ['Ação', 'Cripto', 'FII/ETF', 'Renda F.', 'Outro']
const COLORS = ['#6c63ff', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#64748b', '#14b8a6', '#f97316']

const EMPTY_FORM = { name: '', ticker: '', type: 'Ação', quantity: '', avgPrice: '', currentPrice: '', color: '#6c63ff' }

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function AllocationDonut({ data }) {
  const r = 70, cx = 85, cy = 85
  const circumference = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0) || 1

  const segments = data.reduce((acc, seg) => {
    const pct  = seg.value / total
    const dash = pct * circumference
    const off  = acc.length > 0 ? acc[acc.length - 1].nextOff : 0
    acc.push({ ...seg, dash, gap: circumference - dash, off, nextOff: off + dash })
    return acc
  }, [])

  return (
    <div className="donut-wrap" style={{ gap: 24 }}>
      <div className="donut-chart" style={{ width: 170, height: 170 }}>
        <svg className="donut-svg" width="170" height="170" viewBox="0 0 170 170">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2d3e" strokeWidth="20" />
          {segments.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth="20"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.off} strokeLinecap="round"
            >
              <title>{seg.name}: {((seg.value / total) * 100).toFixed(1)}%</title>
            </circle>
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{data.length}</span>
          <span className="donut-center-label">ativos</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{ background: seg.color }} />
            <div className="donut-legend-info">
              <span className="donut-legend-name">{seg.name}</span>
              <span className="donut-legend-pct">{((seg.value / total) * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Investment Modal ─────────────────────────────────────────────────────────

function InvModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { ...initial, quantity: String(initial.quantity), avgPrice: String(initial.avgPrice), currentPrice: String(initial.currentPrice) }
    : EMPTY_FORM
  )
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.ticker.trim() || !form.quantity || !form.avgPrice) return
    onSave({
      ...form,
      quantity: Number(form.quantity),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.currentPrice) || Number(form.avgPrice),
    })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Editar Ativo' : 'Novo Ativo'}
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
          <label className="form-label">Nome</label>
          <input className="form-input" placeholder="Ex: Vale S.A." value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ticker / Código</label>
          <input className="form-input" placeholder="Ex: VALE3" value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Quantidade</label>
          <input className="form-input" type="number" min="0" step="any" placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Preço Médio (R$)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.avgPrice} onChange={e => set('avgPrice', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Preço Atual (R$)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.currentPrice} onChange={e => set('currentPrice', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cor</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(color => (
            <button key={color} type="button" onClick={() => set('color', color)}
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
    <Modal title="Remover Ativo" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Remover</button>
      </>}
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Deseja remover <strong style={{ color: 'var(--text-primary)' }}>{name}</strong> da carteira?
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Investments() {
  const { investments, addInvestment, updateInvestment, deleteInvestment } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem]   = useState(null)

  const enriched = investments.map(inv => {
    const totalInvested = inv.quantity * inv.avgPrice
    const currentValue  = inv.quantity * inv.currentPrice
    const returnVal     = currentValue - totalInvested
    const returnPct     = totalInvested > 0 ? (returnVal / totalInvested) * 100 : 0
    return { ...inv, totalInvested, currentValue, returnVal, returnPct }
  })

  const totalInvested = enriched.reduce((s, i) => s + i.totalInvested, 0)
  const totalValue    = enriched.reduce((s, i) => s + i.currentValue, 0)
  const totalReturn   = totalValue - totalInvested
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

  const donutData = enriched.map(inv => ({ name: inv.ticker, value: inv.currentValue, color: inv.color }))

  const typeMap = enriched.reduce((acc, inv) => {
    if (!acc[inv.type]) acc[inv.type] = 0
    acc[inv.type] += inv.currentValue
    return acc
  }, {})

  return (
    <div className="screen">
      {/* Portfolio summary */}
      <div className="summary-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="summary-stat">
          <div className="summary-stat-label">Valor Total</div>
          <div className="summary-stat-value">{fmt(totalValue)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Total Investido</div>
          <div className="summary-stat-value">{fmt(totalInvested)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Retorno Total</div>
          <div className={`summary-stat-value ${totalReturn >= 0 ? 'positive-text' : 'negative-text'}`}>
            {totalReturn >= 0 ? '+' : ''}{fmt(totalReturn)}
          </div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">Rentabilidade</div>
          <div className={`summary-stat-value ${totalReturnPct >= 0 ? 'positive-text' : 'negative-text'}`}>
            {totalReturnPct >= 0 ? '+' : ''}{fmtN(totalReturnPct, 2)}%
          </div>
        </div>
      </div>

      <div className="charts-row">
        {/* Allocation chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Alocação por Tipo</div>
              <div className="card-subtitle">Distribuição da carteira</div>
            </div>
          </div>
          {donutData.length > 0 ? (
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
              <AllocationDonut data={donutData} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([type, val], i) => (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{type}</span>
                      <span style={{ fontWeight: 600 }}>{((val / totalValue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${(val / totalValue) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state"><p>Nenhum ativo cadastrado</p></div>
          )}
        </div>

        {/* Stats card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">Resumo</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Ativos na carteira', value: investments.length },
              { label: 'Maior valorização', value: enriched.length > 0 ? `${enriched.sort((a,b) => b.returnPct - a.returnPct)[0]?.ticker} (+${fmtN(Math.max(...enriched.map(i=>i.returnPct)),1)}%)` : '—' },
              { label: 'Maior alocação', value: enriched.length > 0 ? `${enriched.sort((a,b) => b.currentValue - a.currentValue)[0]?.ticker} (${((enriched.sort((a,b) => b.currentValue - a.currentValue)[0]?.currentValue/totalValue)*100).toFixed(1)}%)` : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Investments Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Ativos ({investments.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>+ Novo Ativo</button>
        </div>
        {enriched.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 36 }}>📈</span>
            <p>Nenhum ativo na carteira</p>
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>Adicionar primeiro ativo</button>
          </div>
        ) : (
          <table className="transactions-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 20px 12px' }}>Ativo</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Preço Médio</th>
                <th style={{ textAlign: 'right' }}>Preço Atual</th>
                <th style={{ textAlign: 'right' }}>Valor Total</th>
                <th style={{ textAlign: 'right' }}>Retorno</th>
                <th style={{ textAlign: 'right' }}>Alocação</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {enriched.sort((a, b) => b.currentValue - a.currentValue).map(inv => (
                <tr key={inv.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: inv.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.ticker}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.name}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="category-tag">{inv.type}</span></td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtN(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)}</td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmt(inv.avgPrice)}</td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmt(inv.currentPrice)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmt(inv.currentValue)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: inv.returnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {inv.returnPct >= 0 ? '+' : ''}{fmtN(inv.returnPct, 2)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {inv.returnVal >= 0 ? '+' : ''}{fmt(inv.returnVal)}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>
                    {((inv.currentValue / totalValue) * 100).toFixed(1)}%
                  </td>
                  <td style={{ paddingRight: 20 }}>
                    <div className="table-actions">
                      <button className="btn-icon" title="Editar" onClick={() => setEditItem(inv)}>✏️</button>
                      <button className="btn-icon danger" title="Remover" onClick={() => setDelItem(inv)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addModal && <InvModal onSave={addInvestment} onClose={() => setAddModal(false)} />}
      {editItem && (
        <InvModal
          initial={editItem}
          onSave={data => updateInvestment(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <ConfirmModal
          name={delItem.name}
          onConfirm={() => deleteInvestment(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
