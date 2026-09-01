import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createTranslator, detectLanguage } from '../i18n'

const ERR = {
  'auth/user-not-found':           'E-mail não encontrado.',
  'auth/wrong-password':           'Senha incorreta.',
  'auth/email-already-in-use':     'E-mail já cadastrado.',
  'auth/weak-password':            'Senha deve ter ao menos 6 caracteres.',
  'auth/invalid-email':            'E-mail inválido.',
  'auth/invalid-credential':       'E-mail ou senha incorretos.',
  'auth/popup-closed-by-user':     'Login com Google cancelado.',
  'auth/cancelled-popup-request':  'Login com Google cancelado.',
  'auth/popup-blocked':            'Pop-up bloqueado pelo navegador. Permita pop-ups para este site.',
  'auth/operation-not-allowed':    'Login com Google não está ativado. Ative no Firebase Console.',
  'auth/unauthorized-domain':      'Domínio não autorizado no Firebase Console.',
  'auth/network-request-failed':   'Erro de rede. Verifique sua conexão.',
  'auth/too-many-requests':        'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/missing-email':            'Informe o e-mail.',
}

export default function Login() {
  const { signIn, signUp, signInGoogle, resetPassword } = useAuth()
  // A tela roda antes de existir usuário, então o idioma vem do cache local /
  // do navegador em vez das preferências do Firestore.
  const t = useMemo(() => createTranslator(detectLanguage()), [])
  const [tab, setTab]       = useState('login')   // 'login' | 'register' | 'reset'
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoad]  = useState(false)
  const [notice, setNotice] = useState('')
  const isRegister = tab === 'register'
  const isReset    = tab === 'reset'

  const clearErr = () => { setError(''); setNotice('') }

  const switchTab = (nextTab) => {
    setTab(nextTab)
    clearErr()
  }

  const handle = async (fn) => {
    setLoad(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      console.error('[Auth error]', e.code, e.message)
      setError(ERR[e.code] || t('login.unexpected', { code: e.code ?? e.message }))
    } finally {
      setLoad(false)
    }
  }

  // Sempre confirma o envio, mesmo quando o e-mail não existe: responder
  // "e-mail não encontrado" transformaria a tela num verificador de contas
  // cadastradas para quem estivesse sondando.
  const handleReset = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError(t('login.enterEmail')); return }
    setLoad(true); setError(''); setNotice('')
    try {
      await resetPassword(email.trim())
    } catch (err) {
      if (err.code !== 'auth/user-not-found' && err.code !== 'auth/invalid-credential') {
        console.error('[reset password]', err.code, err.message)
        setError(ERR[err.code] || t('login.resetFailed'))
        setLoad(false)
        return
      }
    }
    setNotice(t('login.resetSent', { email: email.trim() }))
    setLoad(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (tab === 'login') {
      handle(() => signIn(email, password))
    } else {
      if (!name.trim()) { setError(t('login.enterName')); return }
      handle(() => signUp(email, password, name.trim()))
    }
  }

  const GoogleButton = () => (
    <button
      className="login-google-btn"
      onClick={() => handle(signInGoogle)}
      disabled={loading}
      type="button"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c11 0 20.5-8 20.5-20 0-1.2-.1-2.3-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"/>
        <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 34.9 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.2l-6.5 5C9.5 39.1 16.3 43.5 24 43.5z"/>
        <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2c3.7-3.4 6.3-8.5 6.3-14.9 0-1.2-.1-2.3-.4-3.5z" />
      </svg>
      {t('login.google')}
    </button>
  )

  const Brand = () => (
    <div className="login-logo">
      <div className="login-logo-icon">
        <i className="fi fi-rr-sack-dollar" />
      </div>
      <div>
        <div className="login-app-name">Eazy<em>Finance</em></div>
        <div className="login-app-sub">{t('login.tagline')}</div>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      <div className={`login-card${isRegister ? ' is-register' : ''}`}>
        <div className="login-card-bg" aria-hidden="true" />

        <section className="login-hero login-hero-signup" aria-hidden={isRegister}>
          <div className="login-hero-icon">
            <i className="fi fi-rr-user-add" />
          </div>
          <h2>{t('login.newHere')}</h2>
          <p>{t('login.newHereSub')}</p>
          <button
            className="login-hero-action"
            onClick={() => switchTab('register')}
            type="button"
          >
            {t('login.createAccount')}
          </button>
        </section>

        <section className="login-hero login-hero-signin" aria-hidden={!isRegister}>
          <div className="login-hero-icon">
            <i className="fi fi-rr-sign-in-alt" />
          </div>
          <h2>{t('login.welcomeBack')}</h2>
          <p>{t('login.welcomeBackSub')}</p>
          <button
            className="login-hero-action"
            onClick={() => switchTab('login')}
            type="button"
          >
            {t('login.signIn')}
          </button>
        </section>

        <section className="login-form-panel login-form-signin" aria-hidden={isRegister}>
          <Brand />

          {/* A redefinição de senha reaproveita este painel em vez de virar um
              terceiro card: a animação do login depende de haver exatamente
              dois painéis deslizando. */}
          {isReset ? (
            <>
              <div className="login-form-header">
                <h1>{t('login.resetTitle')}</h1>
                <p>{t('login.resetSub')}</p>
              </div>

              <form className="login-form" onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">{t('login.email')}</label>
                  <input
                    id="reset-email"
                    className="form-input"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearErr() }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="login-error" role="alert">
                    <i className="fi fi-rr-exclamation" />
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="login-notice" role="status">
                    <i className="fi fi-rr-envelope" />
                    {notice}
                  </div>
                )}

                <button className="btn btn-primary login-btn-submit" type="submit" disabled={loading}>
                  {loading
                    ? <><i className="fi fi-rr-spinner" /> {t('login.sending')}</>
                    : t('login.resetSubmit')
                  }
                </button>
              </form>

              <button className="login-link-btn" type="button" onClick={() => switchTab('login')}>
                <i className="fi fi-rr-arrow-small-left" /> {t('login.backToLogin')}
              </button>
            </>
          ) : (
            <>
              <div className="login-form-header">
                <h1>{t('login.signIn')}</h1>
                <p>{t('login.signInSub')}</p>
              </div>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">{t('login.email')}</label>
                  <input
                    id="login-email"
                    className="form-input"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearErr() }}
                    autoComplete="email"
                    autoFocus={!isRegister}
                    disabled={isRegister}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="login-password">{t('login.password')}</label>
                  <input
                    id="login-password"
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPass(e.target.value); clearErr() }}
                    autoComplete="current-password"
                    disabled={isRegister}
                  />
                </div>

                <button
                  className="login-link-btn login-link-btn--right"
                  type="button"
                  onClick={() => switchTab('reset')}
                  disabled={isRegister}
                >
                  {t('login.forgot')}
                </button>

                {error && !isRegister && (
                  <div className="login-error" role="alert">
                    <i className="fi fi-rr-exclamation" />
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-primary login-btn-submit"
                  type="submit"
                  disabled={loading || isRegister}
                >
                  {loading && !isRegister
                    ? <><i className="fi fi-rr-spinner" /> {t('login.wait')}</>
                    : t('login.signIn')
                  }
                </button>
              </form>

              <div className="login-divider"><span>{t('login.orContinue')}</span></div>
              <GoogleButton />
            </>
          )}
        </section>

        <section className="login-form-panel login-form-signup" aria-hidden={!isRegister}>
          <Brand />

          <div className="login-form-header">
            <h1>{t('login.createAccount')}</h1>
            <p>{t('login.createAccountSub')}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('login.name')}</label>
              <input
                className="form-input"
                placeholder={t('login.namePlaceholder')}
                value={name}
                onChange={e => { setName(e.target.value); clearErr() }}
                autoComplete="name"
                autoFocus={isRegister}
                disabled={!isRegister}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('login.email')}</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearErr() }}
                autoComplete="email"
                disabled={!isRegister}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('login.password')}</label>
              <input
                className="form-input"
                type="password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={e => { setPass(e.target.value); clearErr() }}
                autoComplete="new-password"
                disabled={!isRegister}
              />
            </div>

            {error && isRegister && (
              <div className="login-error">
                <i className="fi fi-rr-exclamation" />
                {error}
              </div>
            )}

            <button
              className="btn btn-primary login-btn-submit"
              type="submit"
              disabled={loading || !isRegister}
            >
              {loading && isRegister
                ? <><i className="fi fi-rr-spinner" /> {t('login.wait')}</>
                : t('login.createAccount')
              }
            </button>
          </form>

          <div className="login-divider"><span>{t('login.orContinue')}</span></div>
          <GoogleButton />
        </section>
      </div>
    </div>
  )
}
