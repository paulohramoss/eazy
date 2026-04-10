import { useState, useEffect } from 'react'
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
  { icon: '▦', label: 'Visão Geral',  screen: 'overview' },
  { icon: '↕', label: 'Transações',   screen: 'transactions' },
  { icon: '◑', label: 'Análise',      screen: 'analysis' },
  { icon: '◻', label: 'Carteiras',    screen: 'wallets' },
  { section: 'Planejamento' },
  { icon: '◎', label: 'Orçamento',    screen: 'budget' },
  { icon: '◈', label: 'Metas',        screen: 'goals' },
  { icon: '⬡', label: 'Investimentos', screen: 'investments' },
  { section: 'Sistema' },
  { icon: '◧', label: 'Configurações', screen: 'settings' },
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
          <div className="logo-icon">💰</div>
          <span>Eazy<em>Finance</em></span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <span key={i} className="nav-section-label">{item.section}</span>
            ) : (
              <div
                key={item.screen}
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => setScreen(item.screen)}
              >
                <span className="nav-icon">{item.icon}</span>
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
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>⚙</span>
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
              {settings.theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="header-btn"
              title="Notificações"
              onClick={() => setScreen('transactions')}
            >
              🔔
              {pendingCount > 0 && <span className="notif-dot" />}
            </button>
            <button
              className="header-btn"
              title="Configurações"
              onClick={() => setScreen('settings')}
            >
              ⚙️
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
