import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createTranslator, detectLanguage } from '../i18n'

// Feedback não-bloqueante. Substitui os alert() espalhados pelo app, que
// travavam a thread e destoavam do visual do resto da interface.

const ToastContext = createContext(null)

const ICONS = {
  success: 'fi-rr-check',
  error:   'fi-rr-cross-circle',
  info:    'fi-rr-info',
  warning: 'fi-rr-triangle-warning',
}

const COLORS = {
  success: 'var(--accent-green, #16a34a)',
  error:   'var(--accent-red, #dc2626)',
  info:    'var(--accent, #0053EF)',
  warning: 'var(--accent-orange, #ea580c)',
}

export function ToastProvider({ children }) {
  // Este provider fica acima do AppProvider, então o idioma vem do cache local
  // e não das preferências do Firestore.
  const t = useMemo(() => createTranslator(detectLanguage()), [])
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(item => item.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const toast = useCallback((message, { type = 'info', duration = 4000 } = {}) => {
    const id = ++idRef.current
    setToasts(list => [...list, { id, message, type }])
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration))
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    toast,
    dismiss,
    success: (m, o) => toast(m, { ...o, type: 'success' }),
    error:   (m, o) => toast(m, { ...o, type: 'error', duration: o?.duration ?? 6000 }),
    info:    (m, o) => toast(m, { ...o, type: 'info' }),
    warning: (m, o) => toast(m, { ...o, type: 'warning' }),
  }), [toast, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        // aria-live faz o leitor de tela anunciar a mensagem sem roubar o foco.
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map(item => (
            <div key={item.id} className="toast" style={{ borderLeftColor: COLORS[item.type] }}>
              <i className={`fi ${ICONS[item.type]}`} style={{ color: COLORS[item.type] }} />
              <span className="toast-message">{item.message}</span>
              <button className="toast-close" onClick={() => dismiss(item.id)} aria-label={t('a11y.closeNotice')}>
                <i className="fi fi-rr-cross-small" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

// Fallback no console quando usado fora do provider: um aviso nunca deve
// derrubar a tela que estava tentando avisar.
const NOOP = {
  toast: (m) => console.log('[toast]', m),
  dismiss: () => {},
  success: (m) => console.log('[toast:success]', m),
  error:   (m) => console.error('[toast:error]', m),
  info:    (m) => console.log('[toast:info]', m),
  warning: (m) => console.warn('[toast:warning]', m),
}

export const useToast = () => useContext(ToastContext) || NOOP
