import { useEffect, useMemo } from 'react'
import { createTranslator, detectLanguage } from '../i18n'
import { UPDATE_EVENT } from '../utils/swUpdate'
import { useToast } from './Toast'

// Aviso fixo de versão nova (ver utils/swUpdate). Fica acima do AppProvider,
// então o idioma vem do cache local, como no ToastProvider.
export default function UpdateNotice() {
  const toast = useToast()
  const t = useMemo(() => createTranslator(detectLanguage()), [])

  useEffect(() => {
    let shown = false
    const show = () => {
      if (shown) return
      shown = true
      toast.info(t('update.available'), {
        duration: 0,
        action: { label: t('update.reload'), onClick: () => window.location.reload() },
      })
    }
    // O evento pode ter disparado antes de este componente montar.
    if (window.__eazyUpdateReady) show()
    window.addEventListener(UPDATE_EVENT, show)
    return () => window.removeEventListener(UPDATE_EVENT, show)
  }, [toast, t])

  return null
}
