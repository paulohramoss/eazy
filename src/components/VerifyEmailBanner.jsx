import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { useApp } from '../context/AppContext'

// Aparece só para contas de e-mail/senha ainda não verificadas. Contas do
// Google já chegam verificadas pelo próprio provedor.
export default function VerifyEmailBanner() {
  const { user, resendVerification } = useAuth()
  const toast = useToast()
  const { t } = useApp()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('eazy_verify_dismissed') === '1')
  const [sending, setSending] = useState(false)

  const isPasswordAccount = user?.providerData?.some(p => p.providerId === 'password')
  if (!user || user.emailVerified || !isPasswordAccount || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    // sessionStorage e não localStorage: o aviso some nesta sessão, mas volta na
    // próxima enquanto o e-mail continuar sem verificação.
    try { sessionStorage.setItem('eazy_verify_dismissed', '1') } catch { /* modo privado */ }
  }

  const resend = async () => {
    setSending(true)
    try {
      await resendVerification()
      toast.success(t('verify.sent'))
    } catch (err) {
      toast.error(t(err?.code === 'auth/too-many-requests' ? 'verify.tooMany' : 'verify.failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="verify-banner" role="status">
      <i className="fi fi-rr-envelope-open" />
      <span className="verify-banner-text">
        {t('verify.text', { email: user.email })}
      </span>
      <button className="verify-banner-action" onClick={resend} disabled={sending}>
        {t(sending ? 'verify.sending' : 'verify.resend')}
      </button>
      <button className="verify-banner-close" onClick={dismiss} aria-label={t('verify.dismiss')}>
        <i className="fi fi-rr-cross-small" />
      </button>
    </div>
  )
}
