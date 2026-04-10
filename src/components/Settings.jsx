import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CATEGORIES } from '../context/AppContext'

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }) {
  return (
    <div
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    />
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ icon, title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">
        <span style={{ fontSize: 18 }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { settings, updateSettings } = useApp()
  const [profile, setProfile] = useState({ name: settings.name, email: settings.email, initials: settings.initials })
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setProfile(prev => ({ ...prev, [k]: v }))

  const saveProfile = () => {
    if (!profile.name.trim()) return
    updateSettings(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const CURRENCIES = [
    { value: 'BRL', label: 'Real Brasileiro (R$)' },
    { value: 'USD', label: 'Dólar Americano ($)' },
    { value: 'EUR', label: 'Euro (€)' },
  ]

  const LANGUAGES = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'es',    label: 'Español' },
  ]

  return (
    <div className="screen">
      <div className="settings-grid">

        {/* Profile */}
        <Section icon="👤" title="Perfil">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {profile.initials || profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{settings.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{settings.email}</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={profile.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" value={profile.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Iniciais (avatar)</label>
              <input className="form-input" maxLength={2} value={profile.initials} onChange={e => set('initials', e.target.value.toUpperCase())} style={{ width: 80 }} />
            </div>
            <button className="btn btn-primary" onClick={saveProfile} style={{ alignSelf: 'flex-start' }}>
              {saved ? '✓ Salvo!' : 'Salvar perfil'}
            </button>
          </div>
        </Section>

        {/* Preferences */}
        <Section icon="⚙️" title="Preferências">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Moeda</label>
              <select
                className="form-select"
                value={settings.currency}
                onChange={e => updateSettings({ currency: e.target.value })}
              >
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Idioma</label>
              <select
                className="form-select"
                value={settings.language}
                onChange={e => updateSettings({ language: e.target.value })}
              >
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { key: 'notifications', label: 'Notificações', desc: 'Receber alertas de orçamento e metas' },
                { key: 'weeklyReport',  label: 'Relatório semanal', desc: 'Resumo financeiro toda segunda-feira' },
              ].map(row => (
                <div key={row.key} className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">{row.label}</div>
                    <div className="toggle-desc">{row.desc}</div>
                  </div>
                  <Toggle
                    on={settings[row.key]}
                    onChange={val => updateSettings({ [row.key]: val })}
                  />
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Categories info */}
        <Section icon="🏷️" title="Categorias Disponíveis">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Categorias usadas nas transações e orçamentos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <span key={cat} className="category-tag" style={{ fontSize: 12, padding: '4px 10px' }}>{cat}</span>
            ))}
          </div>
        </Section>

        {/* Data */}
        <Section icon="💾" title="Dados">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Os dados são armazenados localmente no navegador. Exporte para fazer backup ou importe para restaurar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status do armazenamento</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 600 }}>Ativo — dados em memória</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => alert('Funcionalidade de exportação será implementada em breve.')}
              >
                📤 Exportar dados (JSON)
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => alert('Funcionalidade de importação será implementada em breve.')}
              >
                📥 Importar dados
              </button>
            </div>
          </div>
        </Section>

        {/* About */}
        <Section icon="ℹ️" title="Sobre">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            {[
              { label: 'Aplicação',  value: 'EazyFinance' },
              { label: 'Versão',     value: '1.0.0' },
              { label: 'Framework',  value: 'React 19 + Vite 8' },
              { label: 'Tema',       value: 'Dark Mode' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}
