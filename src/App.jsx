import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import logoImg from './assets/image.png'
import { createPortal } from 'react-dom'
import Calculator from './components/Calculator'
import CurrencyConverter from './components/CurrencyConverter'
import Onboarding from './components/Onboarding'
import TransactionModal from './components/TransactionModal'
import './App.css'
import { useAuth } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import Login from './components/Login'

const Overview          = lazy(() => import('./components/Overview'))
const Transactions      = lazy(() => import('./components/Transactions'))
const Analysis          = lazy(() => import('./components/Analysis'))
const Wallets           = lazy(() => import('./components/Wallets'))
const Budget            = lazy(() => import('./components/Budget'))
const Goals             = lazy(() => import('./components/Goals'))
const Investments       = lazy(() => import('./components/Investments'))
const Settings          = lazy(() => import('./components/Settings'))
const Profile           = lazy(() => import('./components/Profile'))
const CreditCards       = lazy(() => import('./components/CreditCards'))
const Alerts            = lazy(() => import('./components/Alerts'))
const FinancialCalendar = lazy(() => import('./components/FinancialCalendar'))

// ─── Navigation Config ────────────────────────────────────────────────────────

const NAV = [
  { icon: 'fi-rr-dashboard', label: 'Visão Geral', screen: 'overview' },
  { icon: 'fi-rr-exchange', label: 'Transações', screen: 'transactions' },
  {
    section: 'Carteiras',
    icon: 'fi-rr-wallet',
    children: [
      { icon: 'fi-rr-bank', label: 'Minhas Contas', screen: 'wallets' },
      { icon: 'fi-rr-credit-card', label: 'Cartões de Crédito', screen: 'creditcards' },
    ],
  },
  {
    section: 'Planejamento',
    icon: 'fi-rr-layers',
    children: [
      { icon: 'fi-rr-piggy-bank', label: 'Orçamento', screen: 'budget' },
      { icon: 'fi-rr-star', label: 'Objetivos', screen: 'goals' },
      { icon: 'fi-rr-chart-line-up', label: 'Investimentos', screen: 'investments' },
      { icon: 'fi-rr-calendar', label: 'Calendário', screen: 'calendar' },
    ],
  },
  { icon: 'fi-rr-chart-pie', label: 'Análise', screen: 'analysis' },
  {
    section: 'Sistema',
    icon: 'fi-rr-settings',
    children: [
      { icon: 'fi-rr-bell', label: 'Alertas', screen: 'alerts' },
      { icon: 'fi-rr-user', label: 'Meu Perfil', screen: 'profile' },
      { icon: 'fi-rr-settings-sliders', label: 'Configurações', screen: 'settings' },
    ],
  },
]

const SCREEN_TITLES = {
  overview: { title: 'Visão Geral', sub: 'Resumo financeiro completo' },
  transactions: { title: 'Transações', sub: 'Histórico de movimentações' },
  analysis: { title: 'Análise', sub: 'Tendências e insights' },
  wallets: { title: 'Minhas Contas', sub: 'Saldos e carteiras' },
  budget: { title: 'Orçamento', sub: 'Limites por categoria' },
  goals: { title: 'Objetivos', sub: 'Acompanhe o progresso dos seus objetivos' },
  investments: { title: 'Investimentos', sub: 'Carteira de ativos' },
  calendar: { title: 'Calendário Financeiro', sub: 'Visualize receitas e despesas por data' },
  creditcards: { title: 'Cartões de Crédito', sub: 'Gerencie seus cartões e faturas' },
  alerts: { title: 'Notificações', sub: 'Canais e preferências de notificação' },
  profile: { title: 'Meu Perfil', sub: 'Informações pessoais da conta' },
  settings: { title: 'Configurações', sub: 'Preferências do sistema' },
}

const SCREENS = {
  overview: (nav) => <Overview onNavigate={nav} />,
  transactions: () => <Transactions />,
  analysis: () => <Analysis />,
  wallets: () => <Wallets />,
  budget: () => <Budget />,
  goals: () => <Goals />,
  investments: () => <Investments />,
  calendar: () => <FinancialCalendar />,
  creditcards: () => <CreditCards />,
  alerts: () => <Alerts />,
  profile: () => <Profile />,
  settings: () => <Settings />,
}

// ─── NavAccordion (inline expandable group) ───────────────────────────────────

function NavAccordion({ item, screen, setScreen, badges = {} }) {
  const hasActive = item.children.some(c => c.screen === screen)
  const [prevHasActive, setPrevHasActive] = useState(hasActive)
  const [open, setOpen] = useState(hasActive)

  if (hasActive !== prevHasActive) {
    setPrevHasActive(hasActive)
    if (hasActive) setOpen(true)
  }

  return (
    <div className="nav-accordion">
      <div
        className={`nav-item nav-accordion-trigger${hasActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <i className={`fi ${item.icon} nav-icon`} />
        <span>{item.section}</span>
        <i className={`fi fi-rr-angle-small-down nav-accordion-arrow${open ? ' open' : ''}`} />
      </div>
      {open && (
        <div className="nav-accordion-children">
          {item.children.map(child => (
            <div
              key={child.screen}
              className={`nav-item nav-item--child${screen === child.screen ? ' active' : ''}`}
              onClick={() => setScreen(child.screen)}
            >
              <i className={`fi ${child.icon} nav-icon`} />
              {child.label}
              {badges[child.screen] > 0 && (
                <span className="nav-badge" style={{ background: 'var(--accent-red)' }}>{badges[child.screen]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ settings, onNavigate, onClose, anchorRef, logOut }) {
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const onCloseRef = useRef(onClose)
  const dropdownRef = useRef(null)
  onCloseRef.current = onClose

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }

    const handleClick = (e) => {
      if (
        !anchorRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) onCloseRef.current()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
    // anchorRef is a stable ref object — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (screen) => { onNavigate(screen); onClose() }

  return createPortal(
    <div
      ref={dropdownRef}
      className="profile-dropdown"
      style={{ top: pos.top, right: pos.right }}
    >
      {/* Header */}
      <div className="profile-dropdown-header">
        <div className="profile-dropdown-avatar" style={{ overflow: 'hidden', padding: 0 }}>
          {settings.photoURL
            ? <img src={settings.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : (settings.initials || settings.name?.slice(0, 2).toUpperCase())
          }
        </div>
        <div className="profile-dropdown-info">
          <div className="profile-dropdown-name">{settings.name}</div>
          <div className="profile-dropdown-email">{settings.email}</div>
        </div>
      </div>

      <div className="profile-dropdown-divider" />

      <div className="profile-dropdown-item" onClick={() => go('profile')}>
        <i className="fi fi-rr-user" />
        Meu perfil
      </div>
      <div className="profile-dropdown-item" onClick={() => go('settings')}>
        <i className="fi fi-rr-settings-sliders" />
        Configurações da conta
      </div>

      <div className="profile-dropdown-divider" />

      <div className="profile-dropdown-item profile-dropdown-item--danger" onClick={logOut}>
        <i className="fi fi-rr-sign-out-alt" />
        Sair
      </div>
    </div>,
    document.body
  )
}

// ─── Dashboard (requer auth + AppContext) ────────────────────────────────────

function Dashboard() {
  const [screen, setScreen] = useState(() => {
    const saved = localStorage.getItem('eazy_screen')
    return (saved && SCREEN_TITLES[saved]) ? saved : 'overview'
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [converterOpen, setConverterOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const {
    settings, pendingCount, alertsDueCount, toggleTheme, wallets, dbLoading,
    creditCards, categories, addTransaction, addMultipleTransactions,
  } = useApp()
  const { logOut, user } = useAuth()
  const userCardRef = useRef(null)
  const calcBtnRef = useRef(null)
  const converterBtnRef = useRef(null)

  // Biometric Lock State
  // Read directly from localStorage — settings starts as PREF_DEFAULTS and only
  // hydrates from localStorage inside a useEffect, so reading settings here would
  // always see biometricEnabled=false on first render.
  const [isLocked, setIsLocked] = useState(() =>
    !!(JSON.parse(localStorage.getItem(`bio_${user.uid}`) || 'false'))
  )

  const handleBiometricUnlock = async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const rawIdStr = localStorage.getItem('eazy_biometric_id');
      const allowCredentials = rawIdStr ? [{
        type: 'public-key',
        id: Uint8Array.from(atob(rawIdStr), c => c.charCodeAt(0))
      }] : [];
      
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials,
          userVerification: "required",
          timeout: 60000
        }
      });
      setIsLocked(false);
    } catch (e) {
      console.error(e);
      alert('Falha na autenticação biométrica. Tente novamente.');
    }
  }

  // Auto-prompt on mount (and if isLocked flips back to true in the future).
  // deps=[isLocked] avoids the stale-closure bug of deps=[].
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isLocked) handleBiometricUnlock()
  }, [isLocked])

  const navigate = (s) => { setScreen(s); localStorage.setItem('eazy_screen', s) }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const { title, sub } = SCREEN_TITLES[screen] || SCREEN_TITLES.overview

  if (isLocked) {
    return (
      <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-card)', borderRadius: 24, boxShadow: 'var(--shadow)', maxWidth: 400, width: '90%' }}>
          <i className="fi fi-rr-fingerprint" style={{ fontSize: 64, color: 'var(--accent)', marginBottom: 24, display: 'block' }} />
          <h2 style={{ marginBottom: 12, fontSize: 24 }}>App Bloqueado</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, lineHeight: 1.5 }}>Use sua biometria (Face ID / Touch ID) para acessar suas finanças com segurança.</p>
          <button className="btn btn-primary" onClick={handleBiometricUnlock} style={{ width: '100%', padding: '14px', fontSize: 16 }}>
            Desbloquear App
          </button>
          <button className="btn btn-secondary" onClick={logOut} style={{ width: '100%', padding: '14px', fontSize: 16, marginTop: 12 }}>
            Sair da conta
          </button>
        </div>
      </div>
    )
  }

  if (!dbLoading && wallets.length === 0) return <Onboarding />

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-wrap">
            <img src={logoImg} alt="Eazy" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <NavAccordion key={i} item={item} screen={screen} setScreen={navigate}
                badges={{ alerts: alertsDueCount, transactions: pendingCount }} />
            ) : (
              <div
                key={item.screen}
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => navigate(item.screen)}
              >
                <i className={`fi ${item.icon} nav-icon`} />
                {item.label}
                {item.screen === 'transactions' && pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount}</span>
                )}
                {item.screen === 'alerts' && alertsDueCount > 0 && (
                  <span className="nav-badge" style={{ background: 'var(--accent-red)' }}>{alertsDueCount}</span>
                )}
              </div>
            )
          )}
        </nav>

      </aside>

      {/* Main */}
      <main className="main">
        <header className="header">
          <div className="header-left">
            <h1>{title}</h1>
            <p>
              <span>{sub}</span>
              <span className="header-date" style={{ textTransform: 'capitalize' }}>{dateStr}</span>
            </p>
          </div>
          <div className="header-right">
            <button
              ref={calcBtnRef}
              className={`header-btn${calcOpen ? ' header-btn--active' : ''}`}
              title="Calculadora"
              onClick={() => { setCalcOpen(o => !o); setConverterOpen(false) }}
            >
              <i className="fi fi-rr-calculator" />
            </button>

            <button
              ref={converterBtnRef}
              className={`header-btn${converterOpen ? ' header-btn--active' : ''}`}
              title="Conversor de moeda"
              onClick={() => { setConverterOpen(o => !o); setCalcOpen(false) }}
            >
              <i className="fi fi-rr-exchange" />
            </button>

            <button
              className="header-btn"
              title="Alertas"
              onClick={() => navigate('alerts')}
            >
              <i className="fi fi-rr-bell" />
              {alertsDueCount > 0 && <span className="alert-badge">{alertsDueCount}</span>}
            </button>

            <button
              className="header-btn theme-toggle"
              title={settings.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              onClick={toggleTheme}
            >
              <i className={`fi ${settings.theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'}`} />
            </button>

            {calcOpen && (
              <Calculator anchorRef={calcBtnRef} onClose={() => setCalcOpen(false)} />
            )}
            {converterOpen && (
              <CurrencyConverter anchorRef={converterBtnRef} onClose={() => setConverterOpen(false)} />
            )}

            {/* Profile trigger */}
            <div
              ref={userCardRef}
              className={`header-profile${profileOpen ? ' header-profile--open' : ''}`}
              onClick={() => setProfileOpen(o => !o)}
            >
              <div className="header-profile-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                {settings.photoURL
                  ? <img src={settings.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : (settings.initials || settings.name?.slice(0, 2).toUpperCase())
                }
              </div>
              <div className="header-profile-info">
                <div className="header-profile-name">{settings.name}</div>
                <div className="header-profile-role">Conta Pessoal</div>
              </div>
              <i
                className="fi fi-rr-angle-small-down"
                style={{ fontSize: 13, color: 'var(--text-muted)', transition: 'transform .2s', transform: profileOpen ? 'rotate(180deg)' : 'none' }}
              />
            </div>

            {profileOpen && (
              <ProfileDropdown
                settings={settings}
                onNavigate={navigate}
                onClose={() => setProfileOpen(false)}
                anchorRef={userCardRef}
                logOut={logOut}
              />
            )}
          </div>
        </header>

        <div className="content">
          <Suspense fallback={<div className="empty-state"><p>Carregando...</p></div>}>
            {(SCREENS[screen] || SCREENS.overview)(navigate)}
          </Suspense>
        </div>
      </main>

      <button className="fab" title="Nova Transação" onClick={() => setQuickAddOpen(true)}>
        <i className="fi fi-rr-plus" />
      </button>

      {quickAddOpen && (
        <TransactionModal
          wallets={wallets} creditCards={creditCards} categories={categories}
          onSave={(data, mode, count) => {
            if (mode === 'unique') addTransaction(data)
            else addMultipleTransactions(data, mode, count)
          }}
          onClose={() => setQuickAddOpen(false)}
        />
      )}
    </div>
  )
}

// ─── App root — gate de autenticação ─────────────────────────────────────────

export default function App() {
  const { user } = useAuth()

  if (!user) return <Login />

  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  )
}
