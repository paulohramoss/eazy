import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { requestPushPermission, listenForegroundMessages, sendEmail, showLocalNotification } from '../notifications'
import Toggle from './Toggle'

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({ icon, label, desc, on, onChange, disabled, badge, children }) {
  return (
    <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
          {icon && (
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0, color: 'var(--text-secondary)',
            }}>
              <i className={`fi ${icon}`} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="toggle-label">{label}</span>
              {badge && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  background: badge === 'em breve' ? 'var(--bg-hover)' : '#EEF3FF',
                  color: badge === 'em breve' ? 'var(--text-muted)' : 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{badge}</span>
              )}
            </div>
            {desc && <div className="toggle-desc">{desc}</div>}
          </div>
        </div>
        <Toggle on={!!on} onChange={onChange} disabled={disabled} />
      </div>
      {children && on && (
        <div style={{ marginTop: 10, marginLeft: 45 }}>{children}</div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ icon, title, subtitle, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title" style={{ marginBottom: subtitle ? 4 : 18 }}>
        <i className={`fi ${icon}`} style={{ fontSize: 17 }} />
        {title}
      </div>
      {subtitle && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>{subtitle}</p>
      )}
      {children}
    </div>
  )
}

// ─── Inline status ────────────────────────────────────────────────────────────

function StatusMsg({ type, msg }) {
  if (!msg) return null
  const colors = {
    ok:   { bg: 'rgba(24,160,88,0.08)',  border: 'rgba(24,160,88,0.2)',  color: 'var(--accent-green)', icon: 'fi-rr-check-circle' },
    err:  { bg: 'rgba(232,56,42,0.08)', border: 'rgba(232,56,42,0.2)', color: 'var(--accent-red)',   icon: 'fi-rr-cross-circle' },
    info: { bg: '#EEF3FF',              border: 'rgba(0,83,239,0.2)',   color: 'var(--accent)',       icon: 'fi-rr-info' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      marginTop: 10, padding: '10px 14px', borderRadius: 10, fontSize: 13,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className={`fi ${c.icon}`} />
      {msg}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { settings, updateSettings, currencySymbol, t } = useApp()
  const set = (key, val) => updateSettings({ [key]: val })

  const [pushStatus,  setPushStatus]  = useState(null) // { type, msg }
  const [emailStatus, setEmailStatus] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult,  setTestResult]  = useState(null)

  // Ouve mensagens FCM em foreground
  useEffect(() => {
    const unsub = listenForegroundMessages(payload => {
      const { title, body } = payload.notification || {}
      showLocalNotification(title || 'EAZY Finance', body || '')
    })
    return unsub
  }, [])

  // ── Ativar Push ─────────────────────────────────────────────────────────────

  const handlePushToggle = async (enable) => {
    if (!enable) {
      set('pushEnabled', false)
      setPushStatus(null)
      return
    }
    setPushStatus({ type: 'info', msg: t('alerts.requestingPermission') })
    const result = await requestPushPermission()
    if (result.ok) {
      set('pushEnabled', true)
      if (result.token) set('fcmToken', result.token)
      setPushStatus({ type: 'ok', msg: t('alerts.pushEnabled') })
    } else {
      set('pushEnabled', false)
      const isBlocked = result.error?.includes('denied') || result.error?.includes('negada')
      setPushStatus({
        type: 'err',
        msg: isBlocked
          ? t('alerts.pushBlocked')
          : t('alerts.pushError', { error: result.error }),
      })
    }
  }

  // ── Testar notificação ───────────────────────────────────────────────────────

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    const results = []

    if (settings.pushEnabled) {
      showLocalNotification('EAZY Finance', t('alerts.pushWorking'))
      results.push(t('alerts.pushSent'))
    }

    if (settings.emailEnabled && settings.emailAddress) {
      const r = await sendEmail({
        to: settings.emailAddress,
        type: 'test',
        data: {},
      })
      results.push(r.ok ? t('alerts.emailSent') : t('alerts.emailFail', { error: r.error }))
      if (!r.ok) setEmailStatus({ type: 'err', msg: t('alerts.emailFailLong', { error: r.error }) })
      else setEmailStatus({ type: 'ok', msg: t('alerts.emailSentTo', { address: settings.emailAddress }) })
    }

    if (!settings.pushEnabled && !settings.emailEnabled) {
      setTestResult({ type: 'info', msg: t('alerts.enableOneChannel') })
    } else {
      setTestResult({ type: 'ok', msg: results.join(' · ') })
    }

    setTestLoading(false)
  }

  const anyChannelOn = settings.pushEnabled || settings.emailEnabled || settings.smsEnabled

  return (
    <div className="screen">

      {/* ── Banner ──────────────────────────────────────────── */}
      <div style={{
        background: anyChannelOn
          ? 'linear-gradient(135deg, #0053EF 0%, #3370F5 100%)'
          : '#0A0A0A',
        borderRadius: 16, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            <i className="fi fi-rr-bell" style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>
              {t(anyChannelOn ? 'alerts.on' : 'alerts.off')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {[
                settings.pushEnabled  && 'Push',
                settings.emailEnabled && t('alerts.email'),
                settings.smsEnabled   && 'SMS',
              ].filter(Boolean).join(' · ') || t('alerts.noChannel')}
            </div>
          </div>
        </div>
        <button
          onClick={handleTest}
          disabled={testLoading}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10, padding: '9px 18px', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: testLoading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
          }}
        >
          <i className={`fi ${testLoading ? 'fi-rr-spinner' : testResult?.type === 'ok' ? 'fi-rr-check' : 'fi-rr-paper-plane'}`} />
          {t(testLoading ? 'alerts.sending' : 'alerts.test')}
        </button>
      </div>

      {testResult && (
        <StatusMsg type={testResult.type} msg={testResult.msg} />
      )}

      <div className="settings-grid" style={{ gap: 16 }}>

        {/* ── Canais ──────────────────────────────────────────── */}
        <Section icon="fi-rr-signal-alt" title={t('alerts.channelsTitle')}
          subtitle={t('alerts.channelsSub')}>

          {/* Push */}
          <Row
            icon="fi-rr-smartphone"
            label={t('alerts.push')}
            desc={t('alerts.pushDesc')}
            on={settings.pushEnabled}
            onChange={handlePushToggle}
          />
          {pushStatus && <StatusMsg type={pushStatus.type} msg={pushStatus.msg} />}

          {/* E-mail */}
          <Row
            icon="fi-rr-envelope"
            label={t('alerts.email')}
            desc={t('alerts.emailDesc')}
            on={settings.emailEnabled}
            onChange={v => { set('emailEnabled', v); setEmailStatus(null) }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('alerts.emailAddress')}</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={settings.emailAddress || ''}
                onChange={e => set('emailAddress', e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {t('alerts.emailFallback')}
              </div>
            </div>
          </Row>
          {emailStatus && <StatusMsg type={emailStatus.type} msg={emailStatus.msg} />}

          {/* SMS */}
          <Row
            icon="fi-rr-comment-sms"
            label={t('alerts.sms')}
            desc={t('alerts.smsDesc')}
            on={settings.smsEnabled}
            onChange={v => set('smsEnabled', v)}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('alerts.smsPhone')}</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={settings.smsPhone || ''}
                onChange={e => set('smsPhone', e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {t('alerts.smsNote')}
              </div>
            </div>
          </Row>
        </Section>

        {/* ── Transações ──────────────────────────────────────── */}
        <Section icon="fi-rr-exchange" title={t('alerts.txTitle')}
          subtitle={t('alerts.txSub')}>

          <Row
            icon="fi-rr-plus-small"
            label={t('alerts.newTx')}
            desc={t('alerts.newTxDesc')}
            on={settings.notifNewTransaction}
            onChange={v => set('notifNewTransaction', v)}
          />
          <Row
            icon="fi-rr-clock"
            label={t('alerts.pendingTx')}
            desc={t('alerts.pendingTxDesc')}
            on={settings.notifPendingTransaction}
            onChange={v => set('notifPendingTransaction', v)}
          />
          <Row
            icon="fi-rr-triangle-warning"
            label={t('alerts.largeExpense')}
            desc={t('alerts.largeExpenseDesc')}
            on={settings.notifLargeExpense}
            onChange={v => set('notifLargeExpense', v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>{t('alerts.minAmount', { symbol: currencySymbol })}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={settings.notifLargeExpenseThreshold || '500'}
                onChange={e => set('notifLargeExpenseThreshold', e.target.value)}
                style={{ maxWidth: 140 }}
              />
            </div>
          </Row>
        </Section>

        {/* ── Cartões ─────────────────────────────────────────── */}
        <Section icon="fi-rr-credit-card" title={t('alerts.cardsTitle')}
          subtitle={t('alerts.cardsSub')}>

          <Row
            icon="fi-rr-chart-line-up"
            label={t('alerts.cardNear')}
            desc={t('alerts.cardNearDesc')}
            on={settings.notifCardNearLimit}
            onChange={v => set('notifCardNearLimit', v)}
          />
          <Row
            icon="fi-rr-ban"
            label={t('alerts.cardReached')}
            desc={t('alerts.cardReachedDesc')}
            on={settings.notifCardLimitReached}
            onChange={v => set('notifCardLimitReached', v)}
          />
          <Row
            icon="fi-rr-calendar-clock"
            label={t('alerts.cardClosing')}
            desc={t('alerts.cardClosingDesc')}
            on={settings.notifCardClosingDay}
            onChange={v => set('notifCardClosingDay', v)}
          />
          <Row
            icon="fi-rr-calendar-exclamation"
            label={t('alerts.cardDue')}
            desc={t('alerts.cardDueDesc')}
            on={settings.notifCardDueDay}
            onChange={v => set('notifCardDueDay', v)}
          />
        </Section>

        {/* ── Planejamento ────────────────────────────────────── */}
        <Section icon="fi-rr-layers" title={t('alerts.planningTitle')}
          subtitle={t('alerts.planningSub')}>

          <Row
            icon="fi-rr-piggy-bank"
            label={t('alerts.budgetNear')}
            desc={t('alerts.budgetNearDesc')}
            on={settings.notifBudgetNearLimit}
            onChange={v => set('notifBudgetNearLimit', v)}
          />
          <Row
            icon="fi-rr-exclamation"
            label={t('alerts.budgetOver')}
            desc={t('alerts.budgetOverDesc')}
            on={settings.notifBudgetExceeded}
            onChange={v => set('notifBudgetExceeded', v)}
          />
          <Row
            icon="fi-rr-star"
            label={t('alerts.goalReached')}
            desc={t('alerts.goalReachedDesc')}
            on={settings.notifGoalReached}
            onChange={v => set('notifGoalReached', v)}
          />
          <Row
            icon="fi-rr-bell"
            label={t('alerts.goalReminder')}
            desc={t('alerts.goalReminderDesc')}
            on={settings.notifGoalReminder}
            onChange={v => set('notifGoalReminder', v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>{t('alerts.weekday')}</label>
              <select
                className="form-select"
                value={settings.notifGoalReminderDay ?? 1}
                onChange={e => set('notifGoalReminderDay', Number(e.target.value))}
                style={{ maxWidth: 180 }}
              >
                {[0, 1, 2, 3, 4, 5, 6]
                  .map(i => <option key={i} value={i}>{t(`weekday.${i}`)}</option>)}
              </select>
            </div>
          </Row>
        </Section>

        {/* ── Relatórios ──────────────────────────────────────── */}
        <Section icon="fi-rr-document" title={t('alerts.reportsTitle')}
          subtitle={t('alerts.reportsSub')}>

          <Row
            icon="fi-rr-calendar"
            label={t('alerts.weekly')}
            desc={t('alerts.weeklyDesc')}
            on={settings.notifWeeklyReport}
            onChange={v => set('notifWeeklyReport', v)}
          />
          <Row
            icon="fi-rr-chart-pie"
            label={t('alerts.monthly')}
            desc={t('alerts.monthlyDesc')}
            on={settings.notifMonthlyReport}
            onChange={v => set('notifMonthlyReport', v)}
          />
        </Section>
      </div>
    </div>
  )
}
