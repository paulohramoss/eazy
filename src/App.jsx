import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { useAuth } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import Login              from './components/Login'
import Overview           from './components/Overview'
import Transactions       from './components/Transactions'
import Analysis           from './components/Analysis'
import Wallets            from './components/Wallets'
import Budget             from './components/Budget'
import Goals              from './components/Goals'
import Investments        from './components/Investments'
import Settings           from './components/Settings'
import FinancialCalendar  from './components/FinancialCalendar'

// ─── Navigation Config ────────────────────────────────────────────────────────

const NAV = [
  { icon: 'fi-rr-dashboard',  label: 'Visão Geral',  screen: 'overview' },
  { icon: 'fi-rr-exchange',   label: 'Transações',   screen: 'transactions' },
  { icon: 'fi-rr-chart-pie',  label: 'Análise',      screen: 'analysis' },
  { icon: 'fi-rr-wallet',     label: 'Carteiras',    screen: 'wallets' },
  {
    section: 'Planejamento',
    icon: 'fi-rr-layers',
    children: [
      { icon: 'fi-rr-piggy-bank',    label: 'Orçamento',     screen: 'budget' },
      { icon: 'fi-rr-star',          label: 'Objetivos',     screen: 'goals' },
      { icon: 'fi-rr-chart-line-up', label: 'Investimentos', screen: 'investments' },
      { icon: 'fi-rr-calendar',      label: 'Calendário',    screen: 'calendar' },
    ],
  },
  {
    section: 'Sistema',
    icon: 'fi-rr-settings',
    children: [
      { icon: 'fi-rr-settings-sliders', label: 'Configurações', screen: 'settings' },
    ],
  },
]

const SCREEN_TITLES = {
  overview:     { title: 'Visão Geral',            sub: 'Resumo financeiro completo' },
  transactions: { title: 'Transações',             sub: 'Histórico de movimentações' },
  analysis:     { title: 'Análise',                sub: 'Tendências e insights' },
  wallets:      { title: 'Carteiras',              sub: 'Contas e saldos' },
  budget:       { title: 'Orçamento',              sub: 'Limites por categoria' },
  goals:        { title: 'Objetivos',              sub: 'Acompanhe o progresso dos seus objetivos' },
  investments:  { title: 'Investimentos',          sub: 'Carteira de ativos' },
  calendar:     { title: 'Calendário Financeiro',  sub: 'Visualize receitas e despesas por data' },
  settings:     { title: 'Configurações',          sub: 'Perfil e preferências' },
}

const SCREENS = {
  overview:     (nav) => <Overview onNavigate={nav} />,
  transactions: ()    => <Transactions />,
  analysis:     ()    => <Analysis />,
  wallets:      ()    => <Wallets />,
  budget:       ()    => <Budget />,
  goals:        ()    => <Goals />,
  investments:  ()    => <Investments />,
  calendar:     ()    => <FinancialCalendar />,
  settings:     ()    => <Settings />,
}

// ─── NavItem with flyout ──────────────────────────────────────────────────────

function NavGroup({ item, screen, setScreen }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const triggerRef      = useRef(null)
  const closeTimer      = useRef(null)
  const hasActive       = item.children.some(c => c.screen === screen)

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  const cancelClose = () => {
    clearTimeout(closeTimer.current)
  }

  const handleEnter = () => {
    cancelClose()
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.top, left: r.right + 8 })
    }
    setOpen(true)
  }

  return (
    <div
      className="nav-group"
      onMouseEnter={handleEnter}
      onMouseLeave={scheduleClose}
    >
      <div ref={triggerRef} className={`nav-item nav-group-trigger${hasActive ? ' active' : ''}`}>
        <i className={`fi ${item.icon} nav-icon`} />
        {item.section}
        <span className="nav-flyout-arrow">›</span>
      </div>

      {open && createPortal(
        <div
          className="nav-flyout"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {item.children.map(child => (
            <div
              key={child.screen}
              className={`nav-flyout-item${screen === child.screen ? ' active' : ''}`}
              onClick={() => { setScreen(child.screen); setOpen(false) }}
            >
              <i className={`fi ${child.icon} nav-flyout-icon`} />
              {child.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ settings, onNavigate, onClose, anchorRef, logOut }) {
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }

    const handleClick = (e) => {
      if (!anchorRef.current?.contains(e.target)) onCloseRef.current()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  // anchorRef is a stable ref object — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (screen) => { onNavigate(screen); onClose() }

  return createPortal(
    <div
      className="profile-dropdown"
      style={{ top: pos.top, right: pos.right }}
    >
      {/* Header */}
      <div className="profile-dropdown-header">
        <div className="profile-dropdown-avatar">
          {settings.initials || settings.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="profile-dropdown-info">
          <div className="profile-dropdown-name">{settings.name}</div>
          <div className="profile-dropdown-email">{settings.email}</div>
        </div>
      </div>

      <div className="profile-dropdown-divider" />

      <div className="profile-dropdown-item" onClick={() => go('settings')}>
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
  const [screen, setScreen]         = useState('overview')
  const [profileOpen, setProfileOpen] = useState(false)
  const { settings, pendingCount, toggleTheme } = useApp()
  const { logOut } = useAuth()
  const userCardRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const now     = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const { title, sub } = SCREEN_TITLES[screen] || SCREEN_TITLES.overview

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"><i className="fi fi-rr-sack-dollar" /></div>
          <span>Eazy<em>Finance</em></span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <NavGroup key={i} item={item} screen={screen} setScreen={setScreen} />
            ) : (
              <div
                key={item.screen}
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => setScreen(item.screen)}
              >
                <i className={`fi ${item.icon} nav-icon`} />
                {item.label}
                {item.screen === 'transactions' && pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount}</span>
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
            <p style={{ textTransform: 'capitalize' }}>{sub} · {dateStr}</p>
          </div>
          <div className="header-right">
            <button
              className="header-btn theme-toggle"
              title={settings.theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              onClick={toggleTheme}
            >
              <i className={`fi ${settings.theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'}`} />
            </button>

            {/* Profile trigger */}
            <div
              ref={userCardRef}
              className={`header-profile${profileOpen ? ' header-profile--open' : ''}`}
              onClick={() => setProfileOpen(o => !o)}
            >
              <div className="header-profile-avatar">
                {settings.initials || settings.name?.slice(0, 2).toUpperCase()}
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
                onNavigate={setScreen}
                onClose={() => setProfileOpen(false)}
                anchorRef={userCardRef}
                logOut={logOut}
              />
            )}
          </div>
        </header>

        <div className="content">
          {(SCREENS[screen] || SCREENS.overview)(setScreen)}
        </div>
      </main>
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
