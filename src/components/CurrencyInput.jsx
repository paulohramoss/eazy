import { useState } from 'react'

// Converts numeric cents to "1.000,00" display string
const format = (cents) => {
  if (!cents) return ''
  const s = String(Math.round(Math.abs(cents))).padStart(3, '0')
  const int = s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '0'
  return `${int},${s.slice(-2)}`
}

const toCents = (v) => Math.round((Number(v) || 0) * 100)

/**
 * Masked currency input for BRL values.
 * - Accepts numeric `value` (or string) as initial state.
 * - Calls `onChange(numericValue)` on every keystroke.
 * - Formats automatically: 1000000 cents → "10.000,00"
 */
export default function CurrencyInput({ value, onChange, className, placeholder, ...rest }) {
  const [display, setDisplay] = useState(() => format(toCents(value)))

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setDisplay('')
      onChange(0)
      return
    }
    const cents = parseInt(digits, 10)
    setDisplay(format(cents))
    onChange(cents / 100)
  }

  return (
    <input
      {...rest}
      className={className}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0,00'}
    />
  )
}
