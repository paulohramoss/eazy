import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  const modalRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  // Focus trap: foca o modal ao abrir (sem roubar foco de um autoFocus interno)
  // e devolve o foco pro elemento que estava ativo antes, ao fechar.
  useEffect(() => {
    const root = modalRef.current
    previouslyFocused.current = document.activeElement
    if (root && !root.contains(document.activeElement)) {
      (root.querySelector(FOCUSABLE_SELECTOR) || root).focus()
    }
    return () => previouslyFocused.current?.focus?.()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return
    const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal modal-${size}`}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
