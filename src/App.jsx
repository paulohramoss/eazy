import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { useApp } from './context/AppContext'
import Overview     from './components/Overview'
import Transactions from './components/Transactions'
import Analysis     from './components/Analysis'
import Wallets      from './components/Wallets'
import Budget       from './components/Budget'
import Goals        from './components/Goals'
import Investments  from './components/Investments'
import Settings     from './components/Settings'

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
      { icon: 'fi-rr-star',          label: 'Metas',         screen: 'goals' },
      { icon: 'fi-rr-chart-line-up', label: 'Investimentos', screen: 'investments' },
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
  overview: { title: 'Visão Geral', sub: 'Resumo financeiro completo' },
  transactions: { title: 'Transações', sub: 'Histórico de movimentações' },
  analysis: { title: 'Análise', sub: 'Tendências e insights' },
  wallets: { title: 'Carteiras', sub: 'Contas e saldos' },
  budget: { title: 'Orçamento', sub: 'Limites por categoria' },
  goals: { title: 'Metas', sub: 'Objetivos financeiros' },
  investments: { title: 'Investimentos', sub: 'Carteira de ativos' },
  settings: { title: 'Configurações', sub: 'Perfil e preferências' },
}

const SCREENS = {
  overview:     (nav) => <Overview onNavigate={nav} />,
  transactions: ()    => <Transactions />,
  analysis:     ()    => <Analysis />,
  wallets:      ()    => <Wallets />,
  budget:       ()    => <Budget />,
  goals:        ()    => <Goals />,
  investments:  ()    => <Investments />,
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

// ─── Group icons ─────────────────────────────────────────────────────────────

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('overview')
  const { settings, pendingCount, toggleTheme } = useApp()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const now = new Date()
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
              <NavGroup
                key={i}
                item={item}
                screen={screen}
                setScreen={setScreen}
              />
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

        <div className="sidebar-footer">
          <div className="user-card" onClick={() => setScreen('settings')}>
            <div className="user-avatar">
              {settings.initials || settings.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{settings.name}</div>
              <div className="user-role">Conta Pessoal</div>
            </div>
            <i className="fi fi-rr-settings" style={{ color: 'var(--text-muted)', fontSize: 14 }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Header */}
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
            <button
              className="header-btn"
              title="Notificações"
              onClick={() => setScreen('transactions')}
            >
              <i className="fi fi-rr-bell" />
              {pendingCount > 0 && <span className="notif-dot" />}
            </button>
            <button
              className="header-btn"
              title="Configurações"
              onClick={() => setScreen('settings')}
            >
              <i className="fi fi-rr-settings" />
            </button>
          </div>
        </header>

        {/* Screen Content */}
        <div className="content">
          {(SCREENS[screen] || SCREENS.overview)(setScreen)}
        </div>
      </main>
    </div>
  )
}
