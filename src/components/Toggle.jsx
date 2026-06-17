export default function Toggle({ on, onChange, disabled }) {
  const toggle = () => !disabled && onChange(!on)

  return (
    <div
      className={`toggle ${on ? 'on' : ''}`}
      onClick={toggle}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={on}
      aria-disabled={disabled || undefined}
      style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : { cursor: 'pointer' }}
    />
  )
}
