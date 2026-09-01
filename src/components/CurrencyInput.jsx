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
  // Estado, não ref: o valor é lido durante o render (padrão oficial de
  // "ajustar estado quando uma prop muda"), e ler ref no render é proibido.
  const [lastEmitted, setLastEmitted] = useState(() => toCents(value))

  // Resync when `value` changes from outside (e.g. programmatic reset/shortcut
  // buttons) — but not when it's just an echo of what we ourselves emitted.
  //
  // Ajuste durante o render, e não num efeito: o efeito só rodava DEPOIS de
  // pintar o valor velho, causando um frame com o texto errado e um render
  // extra em cascata. Este é o padrão recomendado para estado derivado de props
  // (react.dev/learn/you-might-not-need-an-effect).
  const cents = toCents(value)
  if (cents !== lastEmitted) {
    setLastEmitted(cents)
    setDisplay(format(cents))
  }

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setLastEmitted(0)
      setDisplay('')
      onChange(0)
      return
    }
    const nextCents = parseInt(digits, 10)
    setLastEmitted(nextCents)
    setDisplay(format(nextCents))
    onChange(nextCents / 100)
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
