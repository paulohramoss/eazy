import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

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
}

export default function Login() {
  const { signIn, signUp, signInGoogle } = useAuth()
  const [tab, setTab]       = useState('login')   // 'login' | 'register'
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoad]  = useState(false)

  const clearErr = () => setError('')

  const handle = async (fn) => {
    setLoad(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      console.error('[Auth error]', e.code, e.message)
      setError(ERR[e.code] || `Erro inesperado. (${e.code ?? e.message})`)
    } finally {
      setLoad(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (tab === 'login') {
      handle(() => signIn(email, password))
    } else {
      if (!name.trim()) { setError('Informe seu nome.'); return }
      handle(() => signUp(email, password, name.trim()))
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <i className="fi fi-rr-sack-dollar" />
          </div>
          <div>
            <div className="login-app-name">Eazy<em>Finance</em></div>
            <div className="login-app-sub">Seu dinheiro em 5 segundos</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="login-tabs">
          <button
            className={`login-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); clearErr() }}
          >
            Entrar
          </button>
          <button
            className={`login-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => { setTab('register'); clearErr() }}
          >
            Criar conta
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="form-input"
                placeholder="Seu nome"
                value={name}
                onChange={e => { setName(e.target.value); clearErr() }}
                autoFocus
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); clearErr() }}
              autoFocus={tab === 'login'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              placeholder={tab === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
              value={password}
              onChange={e => { setPass(e.target.value); clearErr() }}
            />
          </div>

          {error && (
            <div className="login-error">
              <i className="fi fi-rr-exclamation" />
              {error}
            </div>
          )}

          <button
            className="btn btn-primary login-btn-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? <><i className="fi fi-rr-spinner" /> Aguarde...</>
              : tab === 'login' ? 'Entrar' : 'Criar conta'
            }
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider"><span>ou continue com</span></div>

        {/* Google */}
        <button
          className="login-google-btn"
          onClick={() => handle(signInGoogle)}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c11 0 20.5-8 20.5-20 0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"/>
            <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 34.9 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.2l-6.5 5C9.5 39.1 16.3 43.5 24 43.5z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.2 5.2c3.7-3.4 6.3-8.5 6.3-14.9 0-1.2-.1-2.3-.4-3.5z" />
          </svg>
          Continuar com Google
        </button>

      </div>
    </div>
  )
}
