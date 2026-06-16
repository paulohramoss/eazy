import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const BUTTONS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
]

function evalExpr(a, op, b) {
  const x = parseFloat(a), y = parseFloat(b)
  if (op === '+') return x + y
  if (op === '−') return x - y
  if (op === '×') return x * y
  if (op === '÷') return y !== 0 ? x / y : 'Erro'
  return y
}

export default function Calculator({ anchorRef, onClose }) {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev]       = useState(null)
  const [op, setOp]           = useState(null)
  const [fresh, setFresh]     = useState(false)
  const [pos, setPos]         = useState({ top: 0, right: 0 })
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
    return () => document.removeEventListener('mousedown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const press = (key) => {
    if (key === 'C') { setDisplay('0'); setPrev(null); setOp(null); setFresh(false); return }
    if (key === '±') { setDisplay(d => String(-parseFloat(d))); return }
    if (key === '%') { setDisplay(d => String(parseFloat(d) / 100)); return }

    if (['+', '−', '×', '÷'].includes(key)) {
      setPrev(display); setOp(key); setFresh(true); return
    }

    if (key === '=') {
      if (prev !== null && op) {
        const result = evalExpr(prev, op, display)
        setDisplay(String(result))
        setPrev(null); setOp(null); setFresh(false)
      }
      return
    }

    if (key === '.') {
      if (fresh) { setDisplay('0.'); setFresh(false); return }
      if (!display.includes('.')) setDisplay(d => d + '.')
      return
    }

    const next = fresh ? key : (display === '0' ? key : display + key)
    setDisplay(next)
    setFresh(false)
  }

  useEffect(() => {
    const handler = (e) => {
      const map = { Enter: '=', Escape: null, Backspace: null }
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Backspace') {
        setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'); return
      }
      if (e.key === 'Enter') { press('='); return }
      if ('0123456789.+-*/'.includes(e.key)) {
        const k = e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key === '-' ? '−' : e.key
        press(k)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, prev, op, fresh])

  const isOp = (k) => ['+', '−', '×', '÷'].includes(k)

  return createPortal(
    <div ref={ref} className="calc-popup" style={{ top: pos.top, right: pos.right }}>
      <div className="calc-display">
        {op && <div className="calc-expr">{prev} {op}</div>}
        <div className="calc-main">{display}</div>
      </div>
      <div className="calc-grid">
        {BUTTONS.map((row, ri) => (
          <div key={ri} className="calc-row">
            {row.map(k => (
              <button
                key={k}
                className={`calc-btn ${k === '=' ? 'calc-btn--eq' : isOp(k) ? 'calc-btn--op' : k === 'C' || k === '±' || k === '%' ? 'calc-btn--fn' : ''} ${k === '0' ? 'calc-btn--zero' : ''}`}
                onClick={() => press(k)}
              >
                {k}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
