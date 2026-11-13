import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import Toggle from './Toggle'
import { useToast } from './Toast'
import { LANGUAGES } from '../i18n'
import StatementImport from './StatementImport'
import { switchTheme } from '../utils/themeTransition'
import { clearCredentialId, saveCredentialId } from '../utils/biometric'

const THEME_OPTIONS = [
  { value: 'light',  labelKey: 'settings.themeLight',  icon: 'fi-rr-sun' },
  { value: 'dark',   labelKey: 'settings.themeDark',   icon: 'fi-rr-moon' },
  { value: 'system', labelKey: 'settings.themeSystem', icon: 'fi-rr-laptop' },
]

const CURRENCIES = [
  { value: 'BRL', labelKey: 'settings.currencyBRL' },
  { value: 'USD', labelKey: 'settings.currencyUSD' },
  { value: 'EUR', labelKey: 'settings.currencyEUR' },
]

// Preferências antigas, de antes da tela de Alertas ter os canais por tipo.
const LEGACY_TOGGLES = [
  { key: 'notifications', labelKey: 'settings.notifications', descKey: 'settings.notificationsDesc' },
  { key: 'weeklyReport', labelKey: 'settings.weeklyReport', descKey: 'settings.weeklyReportDesc' },
]

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
  const { settings, resolvedTheme, updateSettings, categories, addCategory, removeCategory,
          exportJSON, exportCSV, importJSON, t } = useApp()
  const [newCat, setNewCat] = useState('')
  const toast = useToast()
  const [importStatus, setImportStatus] = useState(null) // null | 'loading' | { ok, msg }
  const importRef = useRef(null)

  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [statementOpen, setStatementOpen] = useState(false)

  // Importar o mesmo arquivo duas vezes duplicava tudo em silêncio. Agora as
  // repetições são detectadas por data+tipo+valor+descrição e o resultado diz
  // quantas entraram e quantas foram puladas.
  const runImport = async (file, importer, extra = {}) => {
    setImportStatus('loading')
    try {
      const stats = await importer(file, { skipDuplicates, ...extra })
      const parts = [t('settings.importedCount', { count: stats.imported })]
      if (stats.skipped) parts.push(t('settings.skippedCount', { count: stats.skipped }))
      if (stats.invalid) parts.push(t('settings.invalidCount', { count: stats.invalid }))
      setImportStatus({ ok: true, msg: `${parts.join(' · ')}.` })
      toast.success(t('settings.importDone'))
    } catch (err) {
      setImportStatus({ ok: false, msg: err.message })
      toast.error(t('settings.importFailed', { error: err.message }))
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await runImport(file, importJSON)
  }

  const handleAddCategory = () => {
    addCategory(newCat)
    setNewCat('')
  }

  // Registra uma credencial WebAuthn neste aparelho. Só liga a preferência
  // depois que o navegador confirma a biometria.
  const handleBiometricToggle = async (enable) => {
    if (!enable) {
      updateSettings({ biometricEnabled: false })
      clearCredentialId()
      return
    }
    try {
      if (!window.PublicKeyCredential) throw new Error(t('settings.biometricUnsupported'))
      const challenge = new Uint8Array(32)
      window.crypto.getRandomValues(challenge)
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Eazy Finance' },
          user: {
            id: new Uint8Array(16),
            name: settings.email || 'user@eazy',
            displayName: settings.name || 'User',
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { userVerification: 'required' },
          timeout: 60000,
        },
      })
      if (cred) {
        saveCredentialId(cred.rawId)
        updateSettings({ biometricEnabled: true })
        toast.success(t('settings.biometricEnabled'))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('settings.biometricFailed', { error: e.message }))
    }
  }

  return (
    <div className="screen">
      <div className="settings-grid">

        {/* Preferences */}
        <Section icon={<i className="fi fi-rr-settings-sliders" />} title={t('settings.preferences')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-currency">{t('settings.currency')}</label>
              <select
                id="settings-currency"
                className="form-select"
                value={settings.currency}
                onChange={e => updateSettings({ currency: e.target.value })}
              >
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-language">{t('settings.language')}</label>
              <select
                id="settings-language"
                className="form-select"
                value={settings.language}
                onChange={e => updateSettings({ language: e.target.value })}
              >
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <div className="form-hint">{t('settings.languageHint')}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {LEGACY_TOGGLES.map(row => (
                <div key={row.key} className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">{t(row.labelKey)}</div>
                    <div className="toggle-desc">{t(row.descKey)}</div>
                  </div>
                  <Toggle
                    on={settings[row.key]}
                    onChange={val => updateSettings({ [row.key]: val })}
                  />
                </div>
              ))}
              <div className="toggle-row">
                <div className="toggle-info">
                  <div className="toggle-label">
                    <i className={`fi ${resolvedTheme === 'dark' ? 'fi-rr-moon' : 'fi-rr-sun'}`} style={{ marginRight: 6 }} />
                    {t('settings.appearance')}
                  </div>
                  <div className="toggle-desc">
                    {settings.theme === 'light' || settings.theme === 'dark'
                      ? t('settings.themeFixed')
                      : t(resolvedTheme === 'dark' ? 'settings.followingDark' : 'settings.followingLight')}
                  </div>
                </div>
                <div className="theme-choice">
                  {THEME_OPTIONS.map(o => {
                    const active = o.value === 'system'
                      ? settings.theme !== 'light' && settings.theme !== 'dark'
                      : settings.theme === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        className={`theme-choice-btn${active ? ' theme-choice-btn--active' : ''}`}
                        onClick={e => switchTheme(
                          o.value === 'system'
                            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                            : o.value,
                          () => updateSettings({ theme: o.value }),
                          e.currentTarget,
                        )}
                      >
                        <i className={`fi ${o.icon}`} />
                        <span>{t(o.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="toggle-row">
                <div className="toggle-info">
                  <div className="toggle-label">
                    <i className="fi fi-rr-fingerprint" style={{ marginRight: 6 }} />
                    {t('settings.biometricLock')}
                  </div>
                  <div className="toggle-desc">{t('settings.biometricDesc')}</div>
                </div>
                <Toggle on={settings.biometricEnabled} onChange={handleBiometricToggle} />
              </div>
            </div>
          </div>
        </Section>

        {/* Categories */}
        <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
          <div className="settings-section-title">
            <span style={{ fontSize: 18 }}><i className="fi fi-rr-tags" /></span>
            {t('settings.categories')}
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
              {t('settings.categoryCount', { count: categories.length })}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder={t('settings.newCategory')}
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              style={{ flex: 1, maxWidth: 320 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleAddCategory}
              disabled={!newCat.trim()}
            >
              <i className="fi fi-rr-plus" /> {t('settings.add')}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {categories.map(cat => (
              <div
                key={cat}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <i className="fi fi-rr-tag" style={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat}
                  </span>
                </div>
                <button
                  onClick={() => removeCategory(cat)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    borderRadius: 4, flexShrink: 0,
                  }}
                  title={t('settings.removeCategory')}
                >
                  <i className="fi fi-rr-trash" style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <Section icon={<i className="fi fi-rr-database" />} title={t('settings.data')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('settings.dataIntro')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={exportJSON}>
                  <i className="fi fi-rr-cloud-download" /> {t('settings.exportJson')}
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => exportCSV()}>
                  <i className="fi fi-rr-file-spreadsheet" /> {t('export.csv')}
                </button>
              </div>
              <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />

              <div className="toggle-row" style={{ padding: '10px 0' }}>
                <div className="toggle-info">
                  <div className="toggle-label">{t('settings.skipDuplicates')}</div>
                  <div className="toggle-desc">{t('settings.skipDuplicatesDesc')}</div>
                </div>
                <Toggle on={skipDuplicates} onChange={setSkipDuplicates} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={importStatus === 'loading'}
                  onClick={() => { setImportStatus(null); importRef.current?.click() }}
                >
                  <i className="fi fi-rr-upload" />
                  {t(importStatus === 'loading' ? 'settings.importing' : 'settings.importJson')}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={importStatus === 'loading'}
                  onClick={() => { setImportStatus(null); setStatementOpen(true) }}
                >
                  <i className="fi fi-rr-file-invoice-dollar" />
                  {t('stmt.title')}
                </button>
              </div>
              {importStatus && importStatus !== 'loading' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: importStatus.ok ? 'rgba(24,160,88,.1)' : 'rgba(232,56,42,.1)',
                  color: importStatus.ok ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${importStatus.ok ? 'rgba(24,160,88,.25)' : 'rgba(232,56,42,.25)'}`,
                }}>
                  <i className={`fi ${importStatus.ok ? 'fi-rr-check' : 'fi-rr-cross-circle'}`} style={{ marginRight: 8 }} />
                  {importStatus.msg}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* About */}
        <Section icon={<i className="fi fi-rr-info" />} title={t('settings.about')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            {[
              { label: t('settings.app'), value: 'EazyFinance' },
              { label: t('settings.version'), value: '1.0.0' },
              { label: 'Framework', value: 'React 19 + Vite 8' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {statementOpen && <StatementImport onClose={() => setStatementOpen(false)} />}
    </div>
  )
}
