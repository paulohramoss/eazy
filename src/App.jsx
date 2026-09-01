import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
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
import ErrorBoundary from './components/ErrorBoundary'
import VerifyEmailBanner from './components/VerifyEmailBanner'
import CommandPalette from './components/CommandPalette'
import { navigate as routerNavigate, routeFromHash, useHashRoute } from './utils/router'
import { createTranslator, detectLanguage } from './i18n'

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
const Recurrences       = lazy(() => import('./components/Recurrences'))

// ─── Navigation Config ────────────────────────────────────────────────────────

const NAV = [
  { icon: 'fi-rr-dashboard', labelKey: 'nav.overview', screen: 'overview' },
  { icon: 'fi-rr-exchange', labelKey: 'nav.transactions', screen: 'transactions' },
  {
    sectionKey: 'nav.wallets_section',
    icon: 'fi-rr-wallet',
    children: [
      { icon: 'fi-rr-bank', labelKey: 'nav.wallets', screen: 'wallets' },
      { icon: 'fi-rr-credit-card', labelKey: 'nav.creditcards', screen: 'creditcards' },
    ],
  },
  {
    sectionKey: 'nav.planning',
    icon: 'fi-rr-layers',
    children: [
      { icon: 'fi-rr-piggy-bank', labelKey: 'nav.budget', screen: 'budget' },
      { icon: 'fi-rr-star', labelKey: 'nav.goals', screen: 'goals' },
      { icon: 'fi-rr-chart-line-up', labelKey: 'nav.investments', screen: 'investments' },
      { icon: 'fi-rr-calendar', labelKey: 'nav.calendar', screen: 'calendar' },
      { icon: 'fi-rr-refresh', labelKey: 'nav.recurrences', screen: 'recurrences' },
    ],
  },
  { icon: 'fi-rr-chart-pie', labelKey: 'nav.analysis', screen: 'analysis' },
  {
    sectionKey: 'nav.system',
    icon: 'fi-rr-settings',
    children: [
      { icon: 'fi-rr-bell', labelKey: 'nav.alerts', screen: 'alerts' },
      { icon: 'fi-rr-user', labelKey: 'nav.profile', screen: 'profile' },
      { icon: 'fi-rr-settings-sliders', labelKey: 'nav.settings', screen: 'settings' },
    ],
  },
]

// No desktop as seções viram accordions na sidebar. No mobile a sidebar vira
// tab bar e os accordions são escondidos — sem isto estas telas ficariam
// inalcançáveis no celular. A aba "Mais" abre a folha com todas elas.
const NAV_SECTIONS = NAV.filter(i => i.sectionKey)
const MORE_SCREENS = NAV_SECTIONS.flatMap(sec => sec.children.map(c => c.screen))

// Só as chaves: os textos vêm do dicionário, então trocar de idioma muda o
// cabeçalho junto com o resto da interface.
const SCREEN_KEYS = [
  'overview', 'transactions', 'analysis', 'wallets', 'budget', 'goals',
  'investments', 'calendar', 'recurrences', 'creditcards', 'alerts',
  'profile', 'settings',
]

const SCREEN_TITLES = Object.fromEntries(SCREEN_KEYS.map(k => [k, true]))

// Telas navegáveis pela busca, derivadas da própria NAV para não haver duas
// listas para manter em sincronia.
const FLAT_SCREENS = NAV.flatMap(item =>
  item.sectionKey
    ? item.children.map(c => ({ screen: c.screen, labelKey: c.labelKey, icon: c.icon }))
    : [{ screen: item.screen, labelKey: item.labelKey, icon: item.icon }])

const SCREENS = {
  overview: (nav) => <Overview onNavigate={nav} />,
  transactions: () => <Transactions />,
  analysis: () => <Analysis />,
  wallets: () => <Wallets />,
  budget: () => <Budget />,
  goals: () => <Goals />,
  investments: () => <Investments />,
  calendar: () => <FinancialCalendar />,
  recurrences: () => <Recurrences />,
  creditcards: () => <CreditCards />,
  alerts: () => <Alerts />,
  profile: () => <Profile />,
  settings: () => <Settings />,
}

// ─── NavAccordion (inline expandable group) ───────────────────────────────────

function NavAccordion({ item, screen, setScreen, badges = {}, t }) {
  const hasActive = item.children.some(c => c.screen === screen)
  const [prevHasActive, setPrevHasActive] = useState(hasActive)
  const [open, setOpen] = useState(hasActive)

  if (hasActive !== prevHasActive) {
    setPrevHasActive(hasActive)
    if (hasActive) setOpen(true)
  }

  return (
    <div className="nav-accordion">
      <button
        type="button"
        className={`nav-item nav-accordion-trigger${hasActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <i className={`fi ${item.icon} nav-icon`} aria-hidden="true" />
        <span>{t(item.sectionKey)}</span>
        <i className={`fi fi-rr-angle-small-down nav-accordion-arrow${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-accordion-children">
          {item.children.map(child => (
            <button
              key={child.screen}
              type="button"
              className={`nav-item nav-item--child${screen === child.screen ? ' active' : ''}`}
              onClick={() => setScreen(child.screen)}
              aria-current={screen === child.screen ? 'page' : undefined}
            >
              <i className={`fi ${child.icon} nav-icon`} aria-hidden="true" />
              {t(child.labelKey)}
              {badges[child.screen] > 0 && (
                <span className="nav-badge" style={{ background: 'var(--accent-red)' }}>{badges[child.screen]}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Folha "Mais" (tab bar do mobile) ────────────────────────────────────────

function MoreSheet({ screen, onNavigate, onClose, badges, t }) {
  return createPortal(
    <div className="more-sheet-backdrop" onClick={onClose}>
      <div className="more-sheet" onClick={e => e.stopPropagation()}>
        <div className="more-sheet-handle" />
        {NAV_SECTIONS.map(sec => (
          <div key={sec.sectionKey} className="more-sheet-group">
            <div className="more-sheet-title">{t(sec.sectionKey)}</div>
            <div className="more-sheet-items">
              {sec.children.map(child => (
                <button
                  key={child.screen}
                  className={`more-sheet-item${screen === child.screen ? ' active' : ''}`}
                  onClick={() => { onNavigate(child.screen); onClose() }}
                >
                  <i className={`fi ${child.icon}`} />
                  <span>{t(child.labelKey)}</span>
                  {badges[child.screen] > 0 && (
                    <span className="more-sheet-badge">{badges[child.screen]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ settings, onNavigate, onClose, anchorRef, logOut, t }) {
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
      role="menu"
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

      <button type="button" role="menuitem" className="profile-dropdown-item" onClick={() => go('profile')}>
        <i className="fi fi-rr-user" />
        {t('profile.myProfile')}
      </button>
      <button type="button" role="menuitem" className="profile-dropdown-item" onClick={() => go('settings')}>
        <i className="fi fi-rr-settings-sliders" />
        {t('profile.accountSettings')}
      </button>

      <div className="profile-dropdown-divider" />

      <button type="button" role="menuitem" className="profile-dropdown-item profile-dropdown-item--danger" onClick={logOut}>
        <i className="fi fi-rr-sign-out-alt" />
        {t('profile.signOut')}
      </button>
    </div>,
    document.body
  )
}

// ─── Dashboard (requer auth + AppContext) ────────────────────────────────────

const isKnownScreen = (s) => !!SCREEN_TITLES[s]

// Sem hash na URL, retoma a última tela aberta; senão a Visão Geral.
const initialScreen = (() => {
  if (window.location.hash) return routeFromHash('overview')
  try {
    const saved = localStorage.getItem('eazy_screen')
    if (saved && isKnownScreen(saved)) return saved
  } catch { /* modo privado */ }
  return 'overview'
})()

function Dashboard() {
  // A URL é a fonte da verdade da tela. localStorage sobrou só como "última
  // tela visitada", usada quando se abre o app sem hash nenhum.
  const screen = useHashRoute(initialScreen, isKnownScreen)
  const [profileOpen, setProfileOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [converterOpen, setConverterOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const {
    settings, resolvedTheme, pendingCount, alertsDueCount, toggleTheme, wallets, dbLoading, walletCreated,
    creditCards, categories, addTransaction, addMultipleTransactions, createRecurringSeries,
    t, formatLongDate, locale,
  } = useApp()
  const { logOut } = useAuth()
  const userCardRef = useRef(null)
  const calcBtnRef = useRef(null)
  const converterBtnRef = useRef(null)

  const navigate = (s) => { routerNavigate(s) }

  useEffect(() => {
    try { localStorage.setItem('eazy_screen', screen) } catch { /* modo privado */ }
  }, [screen])

  // Ctrl/⌘+K abre a busca. O preventDefault evita o "buscar no site" do Firefox.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paletteScreens = useMemo(
    () => FLAT_SCREENS.map(s => ({ ...s, label: t(s.labelKey) })),
    [t])

  // O <html lang> vinha fixo em "en" do index.html. Além de ser lido por
  // leitores de tela para escolher a voz, ele afeta hifenização e a sugestão de
  // tradução do navegador.
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    document.getElementById('meta-theme-color')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#111111' : '#FFF9EF')
  }, [resolvedTheme])

  // Cacheia a preferência, não o tema resolvido: o boot script no index.html
  // resolve 'system' contra o SO na hora, então trocar o tema do sistema entre
  // sessões não deixa um valor velho grudado.
  useEffect(() => {
    try { localStorage.setItem('eazy_theme', settings.theme) } catch { /* modo privado */ }
  }, [settings.theme])

  const now = new Date()
  const dateStr = formatLongDate(now)
  const active = SCREEN_TITLES[screen] ? screen : 'overview'
  const title = t(`screen.${active}.title`)
  const sub   = t(`screen.${active}.sub`)

  // walletCreated cobre o caso em que a carteira foi gravada mas o listener
  // não conseguiu ler de volta — sem isso o onboarding se repete pra sempre.
  if (!dbLoading && wallets.length === 0 && !walletCreated) return <Onboarding />

  return (
    <div className="dashboard">
      <a className="skip-link" href="#conteudo">{t('a11y.skipToContent')}</a>

      {/* Sidebar */}
      <aside className="sidebar" aria-label={t('nav.more')}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-wrap">
            <img src={logoImg} alt="Eazy" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={t('a11y.mainNav')}>
          {NAV.map((item, i) =>
            item.sectionKey ? (
              <NavAccordion key={i} item={item} screen={screen} setScreen={navigate} t={t}
                badges={{ alerts: alertsDueCount, transactions: pendingCount }} />
            ) : (
              <button
                key={item.screen}
                type="button"
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => navigate(item.screen)}
                aria-current={screen === item.screen ? 'page' : undefined}
              >
                <i className={`fi ${item.icon} nav-icon`} aria-hidden="true" />
                {t(item.labelKey)}
                {item.screen === 'transactions' && pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount}</span>
                )}
                {item.screen === 'alerts' && alertsDueCount > 0 && (
                  <span className="nav-badge" style={{ background: 'var(--accent-red)' }}>{alertsDueCount}</span>
                )}
              </button>
            )
          )}

          <button
            type="button"
            className={`nav-item nav-item--more${MORE_SCREENS.includes(screen) ? ' active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
          >
            <i className="fi fi-rr-menu-burger nav-icon" aria-hidden="true" />
            {t('nav.more')}
          </button>
        </nav>

      </aside>

      {moreOpen && (
        <MoreSheet
          screen={screen}
          onNavigate={navigate}
          onClose={() => setMoreOpen(false)}
          badges={{ alerts: alertsDueCount, transactions: pendingCount }}
          t={t}
        />
      )}

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
              className="header-search"
              onClick={() => setPaletteOpen(true)}
              aria-label={t('palette.open')}
            >
              <i className="fi fi-rr-search" aria-hidden="true" />
              <span>{t('palette.open')}</span>
              <kbd className="palette-kbd">⌘K</kbd>
            </button>

            <button
              ref={calcBtnRef}
              className={`header-btn${calcOpen ? ' header-btn--active' : ''}`}
              title={t('header.calculator')}
              onClick={() => { setCalcOpen(o => !o); setConverterOpen(false) }}
            >
              <i className="fi fi-rr-calculator" />
            </button>

            <button
              ref={converterBtnRef}
              className={`header-btn${converterOpen ? ' header-btn--active' : ''}`}
              title={t('header.converter')}
              onClick={() => { setConverterOpen(o => !o); setCalcOpen(false) }}
            >
              <i className="fi fi-rr-exchange" />
            </button>

            <button
              className="header-btn"
              title={t('header.alerts')}
              onClick={() => navigate('alerts')}
            >
              <i className="fi fi-rr-bell" />
              {alertsDueCount > 0 && <span className="alert-badge">{alertsDueCount}</span>}
            </button>

            <button
              className="header-btn theme-toggle"
              title={t(resolvedTheme === 'dark' ? 'header.theme.toLight' : 'header.theme.toDark')}
              onClick={toggleTheme}
            >
              <i className={`fi ${resolvedTheme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'}`} />
            </button>

            {calcOpen && (
              <Calculator anchorRef={calcBtnRef} onClose={() => setCalcOpen(false)} />
            )}
            {converterOpen && (
              <CurrencyConverter anchorRef={converterBtnRef} onClose={() => setConverterOpen(false)} />
            )}

            {/* Profile trigger */}
            <button
              type="button"
              ref={userCardRef}
              className={`header-profile${profileOpen ? ' header-profile--open' : ''}`}
              onClick={() => setProfileOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <div className="header-profile-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                {settings.photoURL
                  ? <img src={settings.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : (settings.initials || settings.name?.slice(0, 2).toUpperCase())
                }
              </div>
              <div className="header-profile-info">
                <div className="header-profile-name">{settings.name}</div>
                <div className="header-profile-role">{t('header.personalAccount')}</div>
              </div>
              <i
                className="fi fi-rr-angle-small-down"
                style={{ fontSize: 13, color: 'var(--text-muted)', transition: 'transform .2s', transform: profileOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              />
            </button>

            {profileOpen && (
              <ProfileDropdown
                settings={settings}
                onNavigate={navigate}
                onClose={() => setProfileOpen(false)}
                anchorRef={userCardRef}
                logOut={logOut}
                t={t}
              />
            )}
          </div>
        </header>

        <div className="content" id="conteudo" tabIndex={-1}>
          <VerifyEmailBanner />
          <ErrorBoundary resetKey={screen} t={t}>
            <Suspense fallback={<div className="empty-state"><p>{t('action.loading')}</p></div>}>
              {(SCREENS[screen] || SCREENS.overview)(navigate)}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <button className="fab" title={t('action.newTransaction')} onClick={() => setQuickAddOpen(true)}>
        <i className="fi fi-rr-plus" />
      </button>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        screens={paletteScreens}
      />

      {quickAddOpen && (
        <TransactionModal
          wallets={wallets} creditCards={creditCards} categories={categories}
          onSave={(data, mode, count, frequency) => {
            if (mode === 'unique') addTransaction(data)
            else if (mode === 'recurring') createRecurringSeries(data, frequency, count)
            else addMultipleTransactions(data, mode, count)
          }}
          onClose={() => setQuickAddOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Biometric Lock Screen ────────────────────────────────────────────────────

function LockScreen({ onUnlock, onLogOut, error, busy }) {
  // O gate biométrico roda antes do AppProvider, então o idioma vem do cache
  // local em vez das preferências do Firestore.
  const t = useMemo(() => createTranslator(detectLanguage()), [])

  return (
    <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-card)', borderRadius: 24, boxShadow: 'var(--shadow)', maxWidth: 400, width: '90%' }}>
        <i className="fi fi-rr-fingerprint" style={{ fontSize: 64, color: 'var(--accent)', marginBottom: 24, display: 'block' }} />
        <h2 style={{ marginBottom: 12, fontSize: 24 }}>{t('lock.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, lineHeight: 1.5 }}>
          {t('lock.body')}
        </p>

        {error && (
          <div role="alert" style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13,
            background: 'var(--accent-red-soft, rgba(220,38,38,.1))', color: 'var(--accent-red)',
          }}>{error}</div>
        )}

        <button className="btn btn-primary" onClick={onUnlock} disabled={busy} style={{ width: '100%', padding: '14px', fontSize: 16 }}>
          {t(busy ? 'lock.waiting' : 'lock.unlock')}
        </button>
        <button className="btn btn-secondary" onClick={onLogOut} style={{ width: '100%', padding: '14px', fontSize: 16, marginTop: 12 }}>
          {t('lock.signOut')}
        </button>

        {/* O cadeado é uma trava de conveniência no dispositivo, não uma camada
            de segurança: quem controla o navegador consegue contorná-la. Quem
            protege os dados de verdade são o login e as regras do Firestore. */}
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('lock.disclaimer')}
        </p>
      </div>
    </div>
  )
}

// ─── AuthedApp — gate biométrico antes de montar o AppProvider ───────────────
// O AppProvider abre as subscriptions do Firestore (dados financeiros) assim que
// monta. Por isso o lock precisa decidir ANTES de montar AppProvider/Dashboard —
// senão os dados já estariam em memória enquanto a tela de cadeado é exibida.

function AuthedApp({ user }) {
  const { logOut } = useAuth()

  const [isLocked, setIsLocked] = useState(() =>
    !!(JSON.parse(localStorage.getItem(`bio_${user.uid}`) || 'false'))
  )
  const [bioError, setBioError] = useState('')
  const [bioBusy, setBioBusy] = useState(false)

  const handleBiometricUnlock = useCallback(async () => {
    setBioError('')
    setBioBusy(true)
    try {
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)
      const rawIdStr = localStorage.getItem('eazy_biometric_id')
      const allowCredentials = rawIdStr ? [{
        type: 'public-key',
        id: Uint8Array.from(atob(rawIdStr), c => c.charCodeAt(0)),
      }] : []

      await navigator.credentials.get({
        publicKey: { challenge, allowCredentials, userVerification: 'required', timeout: 60000 },
      })
      setIsLocked(false)
    } catch (e) {
      // alert() bloqueava a thread e destoava do resto do app; o erro agora
      // aparece na própria tela, com o botão continuando disponível.
      console.error('[biometric]', e)
      const t = createTranslator(detectLanguage())
      setBioError(t(e?.name === 'NotAllowedError' ? 'lock.cancelled' : 'lock.failed'))
    } finally {
      setBioBusy(false)
    }
  }, [])

  // Pede a biometria assim que a tela de cadeado aparece.
  useEffect(() => {
    if (isLocked) handleBiometricUnlock()
  }, [isLocked, handleBiometricUnlock])

  if (isLocked) {
    return (
      <LockScreen
        onUnlock={handleBiometricUnlock}
        onLogOut={logOut}
        error={bioError}
        busy={bioBusy}
      />
    )
  }

  // key={user.uid}: trocar de conta desmonta o provider inteiro, garantindo que
  // nenhum dado da conta anterior sobreviva em memória.
  return (
    <AppProvider key={user.uid}>
      <Dashboard />
    </AppProvider>
  )
}

// ─── App root — gate de autenticação ─────────────────────────────────────────

export default function App() {
  const { user } = useAuth()

  if (!user) return <Login />

  return <AuthedApp user={user} />
}
