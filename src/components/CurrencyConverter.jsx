import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const CURRENCIES = [
  { code: 'BRL', label: 'Real (BRL)', symbol: 'R$' },
  { code: 'USD', label: 'Dólar (USD)', symbol: '$' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'GBP', label: 'Libra (GBP)', symbol: '£' },
  { code: 'ARS', label: 'Peso Arg. (ARS)', symbol: '$' },
  { code: 'CLP', label: 'Peso Chi. (CLP)', symbol: '$' },
  { code: 'BTC', label: 'Bitcoin (BTC)', symbol: '₿' },
]

// Static fallback rates relative to BRL
const FALLBACK = { BRL: 1, USD: 0.19, EUR: 0.18, GBP: 0.15, ARS: 172, CLP: 178, BTC: 0.0000030 }

export default function CurrencyConverter({ anchorRef, onClose }) {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('BRL')
  const [rates, setRates] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const ref = useRef(null)

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    const handler = (e) => {
      if (!ref.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)

    fetch('https://open.er-api.com/v6/latest/BRL')
      .then(r => r.json())
      .then(data => { if (data.rates) setRates({ ...FALLBACK, ...data.rates, BRL: 1 }) })
      .catch(() => { })
      .finally(() => setLoading(false))

    return () => document.removeEventListener('mousedown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const convert = () => {
    const val = parseFloat(amount) || 0
    // Convert from → BRL → to
    const inBRL = val / (rates[from] || 1)
    const result = inBRL * (rates[to] || 1)
    return result.toLocaleString('pt-BR', { maximumFractionDigits: to === 'BTC' ? 8 : 2 })
  }

  const swap = () => { setFrom(to); setTo(from) }

  const fromSym = CURRENCIES.find(c => c.code === from)?.symbol || ''
  const toSym = CURRENCIES.find(c => c.code === to)?.symbol || ''

  return createPortal(
    <div ref={ref} className="calc-popup" style={{ top: pos.top, right: pos.right, width: 300 }}>
      <div style={{ padding: '14px 16px 0', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><i className="fi fi-rr-exchange" style={{ marginRight: 6 }} />Conversor de Moeda</span>
        {loading && <span style={{ fontSize: 11 }}>Atualizando...</span>}
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Valor</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={{ padding: '0 10px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', height: 40, display: 'flex', alignItems: 'center' }}>
              {fromSym}
            </span>
            <input
              className="form-input"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', flex: 1 }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">De</label>
            <select className="form-select" value={from} onChange={e => setFrom(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <button onClick={swap} className="btn btn-secondary" style={{ padding: '8px 10px', marginBottom: 1 }} title="Inverter">
            <i className="fi fi-rr-exchange" />
          </button>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Para</label>
            <select className="form-select" value={to} onChange={e => setTo(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px',
          textAlign: 'center', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            {amount || '0'} {from} =
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
            {toSym} {convert()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
