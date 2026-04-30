import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { requestPushPermission, listenForegroundMessages, sendEmail, showLocalNotification } from '../notifications'

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }) {
  return (
    <div
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      role="switch"
      aria-checked={on}
      style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : { cursor: 'pointer' }}
    />
  )
}

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
  const { settings, updateSettings } = useApp()
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
    setPushStatus({ type: 'info', msg: 'Solicitando permissão...' })
    const result = await requestPushPermission()
    if (result.ok) {
      set('pushEnabled', true)
      if (result.token) set('fcmToken', result.token)
      setPushStatus({ type: 'ok', msg: 'Notificações push ativadas! Você receberá alertas mesmo com o app em segundo plano.' })
    } else {
      set('pushEnabled', false)
      const isBlocked = result.error?.includes('denied') || result.error?.includes('negada')
      setPushStatus({
        type: 'err',
        msg: isBlocked
          ? 'Permissão bloqueada. Desbloqueie as notificações nas configurações do navegador e tente novamente.'
          : `Erro: ${result.error}`,
      })
    }
  }

  // ── Testar notificação ───────────────────────────────────────────────────────

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    const results = []

    if (settings.pushEnabled) {
      showLocalNotification('EAZY Finance', 'Suas notificações push estão funcionando!')
      results.push('Push enviado')
    }

    if (settings.emailEnabled && settings.emailAddress) {
      const r = await sendEmail({
        to: settings.emailAddress,
        type: 'test',
        data: {},
      })
      results.push(r.ok ? 'E-mail enviado' : `E-mail: ${r.error}`)
      if (!r.ok) setEmailStatus({ type: 'err', msg: `Falha ao enviar e-mail: ${r.error}` })
      else setEmailStatus({ type: 'ok', msg: `E-mail enviado para ${settings.emailAddress}` })
    }

    if (!settings.pushEnabled && !settings.emailEnabled) {
      setTestResult({ type: 'info', msg: 'Ative ao menos um canal de notificação para testar.' })
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
              {anyChannelOn ? 'Notificações ativas' : 'Notificações desativadas'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {[
                settings.pushEnabled  && 'Push',
                settings.emailEnabled && 'E-mail',
                settings.smsEnabled   && 'SMS',
              ].filter(Boolean).join(' · ') || 'Nenhum canal configurado'}
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
          {testLoading ? 'Enviando...' : 'Testar notificação'}
        </button>
      </div>

      {testResult && (
        <StatusMsg type={testResult.type} msg={testResult.msg} />
      )}

      <div className="settings-grid" style={{ gap: 16 }}>

        {/* ── Canais ──────────────────────────────────────────── */}
        <Section icon="fi-rr-signal-alt" title="Canais de Notificação"
          subtitle="Escolha como você quer receber os avisos">

          {/* Push */}
          <Row
            icon="fi-rr-smartphone"
            label="Push — Navegador / PWA"
            desc="Notificações instantâneas no navegador e no celular quando o app for instalado"
            on={settings.pushEnabled}
            onChange={handlePushToggle}
          />
          {pushStatus && <StatusMsg type={pushStatus.type} msg={pushStatus.msg} />}

          {/* E-mail */}
          <Row
            icon="fi-rr-envelope"
            label="E-mail"
            desc={`Alertas enviados pelo EAZY Finance para o seu endereço de e-mail`}
            on={settings.emailEnabled}
            onChange={v => { set('emailEnabled', v); setEmailStatus(null) }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Endereço de e-mail</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@email.com"
                value={settings.emailAddress || ''}
                onChange={e => set('emailAddress', e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Será usado o e-mail do seu cadastro se não informar outro
              </div>
            </div>
          </Row>
          {emailStatus && <StatusMsg type={emailStatus.type} msg={emailStatus.msg} />}

          {/* SMS */}
          <Row
            icon="fi-rr-comment-sms"
            label="SMS"
            desc="Alertas críticos enviados para o seu número de celular"
            on={settings.smsEnabled}
            onChange={v => set('smsEnabled', v)}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Número de celular (com DDD)</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={settings.smsPhone || ''}
                onChange={e => set('smsPhone', e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Seu número será utilizado somente para envio de alertas do EAZY Finance
              </div>
            </div>
          </Row>
        </Section>

        {/* ── Transações ──────────────────────────────────────── */}
        <Section icon="fi-rr-exchange" title="Transações"
          subtitle="Seja notificado sobre movimentações na sua conta">

          <Row
            icon="fi-rr-plus-small"
            label="Nova transação registrada"
            desc="Cada vez que uma receita ou despesa for adicionada"
            on={settings.notifNewTransaction}
            onChange={v => set('notifNewTransaction', v)}
          />
          <Row
            icon="fi-rr-clock"
            label="Transação pendente"
            desc="Quando uma transação estiver aguardando confirmação"
            on={settings.notifPendingTransaction}
            onChange={v => set('notifPendingTransaction', v)}
          />
          <Row
            icon="fi-rr-triangle-warning"
            label="Despesa acima do limite"
            desc="Aviso quando uma despesa única ultrapassar o valor definido"
            on={settings.notifLargeExpense}
            onChange={v => set('notifLargeExpense', v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Valor mínimo (R$)</label>
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
        <Section icon="fi-rr-credit-card" title="Cartões de Crédito"
          subtitle="Monitore o uso dos seus cartões em tempo real">

          <Row
            icon="fi-rr-chart-line-up"
            label="Próximo ao limite (80%)"
            desc="Alerta quando o uso do cartão atingir 80% do limite"
            on={settings.notifCardNearLimit}
            onChange={v => set('notifCardNearLimit', v)}
          />
          <Row
            icon="fi-rr-ban"
            label="Limite atingido"
            desc="Notificação imediata quando o limite for esgotado"
            on={settings.notifCardLimitReached}
            onChange={v => set('notifCardLimitReached', v)}
          />
          <Row
            icon="fi-rr-calendar-clock"
            label="Dia de fechamento"
            desc="Lembrete no dia em que a fatura fecha"
            on={settings.notifCardClosingDay}
            onChange={v => set('notifCardClosingDay', v)}
          />
          <Row
            icon="fi-rr-calendar-exclamation"
            label="Dia de vencimento"
            desc="Lembrete no dia em que a fatura vence"
            on={settings.notifCardDueDay}
            onChange={v => set('notifCardDueDay', v)}
          />
        </Section>

        {/* ── Planejamento ────────────────────────────────────── */}
        <Section icon="fi-rr-layers" title="Planejamento"
          subtitle="Acompanhe orçamentos e objetivos financeiros">

          <Row
            icon="fi-rr-piggy-bank"
            label="Orçamento próximo ao limite"
            desc="Aviso quando 80% do orçamento de uma categoria for utilizado"
            on={settings.notifBudgetNearLimit}
            onChange={v => set('notifBudgetNearLimit', v)}
          />
          <Row
            icon="fi-rr-exclamation"
            label="Orçamento estourado"
            desc="Alerta imediato quando o limite de uma categoria for ultrapassado"
            on={settings.notifBudgetExceeded}
            onChange={v => set('notifBudgetExceeded', v)}
          />
          <Row
            icon="fi-rr-star"
            label="Objetivo atingido"
            desc="Comemore quando um objetivo financeiro for concluído"
            on={settings.notifGoalReached}
            onChange={v => set('notifGoalReached', v)}
          />
          <Row
            icon="fi-rr-bell"
            label="Lembrete semanal de objetivos"
            desc="Resumo semanal do progresso dos seus objetivos"
            on={settings.notifGoalReminder}
            onChange={v => set('notifGoalReminder', v)}
          />
        </Section>

        {/* ── Relatórios ──────────────────────────────────────── */}
        <Section icon="fi-rr-document" title="Relatórios Automáticos"
          subtitle="Resumos periódicos da sua vida financeira">

          <Row
            icon="fi-rr-calendar"
            label="Resumo semanal"
            desc="Todo domingo, um resumo das transações da semana"
            on={settings.notifWeeklyReport}
            onChange={v => set('notifWeeklyReport', v)}
          />
          <Row
            icon="fi-rr-chart-pie"
            label="Resumo mensal"
            desc="No primeiro dia do mês, análise completa do mês anterior"
            on={settings.notifMonthlyReport}
            onChange={v => set('notifMonthlyReport', v)}
          />
        </Section>
      </div>
    </div>
  )
}
