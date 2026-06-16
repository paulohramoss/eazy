import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'

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
  const { settings, updateSettings, toggleTheme, categories, addCategory, removeCategory,
          exportJSON, exportCSV, importJSON } = useApp()
  const [newCat, setNewCat] = useState('')
  const [importStatus, setImportStatus] = useState(null) // null | 'loading' | { ok, msg }
  const importRef = useRef(null)

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('loading')
    try {
      const count = await importJSON(file)
      setImportStatus({ ok: true, msg: `${count} transações importadas com sucesso.` })
    } catch (err) {
      setImportStatus({ ok: false, msg: err.message })
    }
    e.target.value = ''
  }

  const handleAddCategory = () => {
    addCategory(newCat)
    setNewCat('')
  }

  const CURRENCIES = [
    { value: 'BRL', label: 'Real Brasileiro (R$)' },
    { value: 'USD', label: 'Dólar Americano ($)' },
    { value: 'EUR', label: 'Euro (€)' },
  ]

  const LANGUAGES = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'es', label: 'Español' },
  ]

  return (
    <div className="screen">
      <div className="settings-grid">

        {/* Preferences */}
        <Section icon={<i className="fi fi-rr-settings-sliders" />} title="Preferências">
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
                { key: 'weeklyReport', label: 'Relatório semanal', desc: 'Resumo financeiro toda segunda-feira' },
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
              <div className="toggle-row">
                <div className="toggle-info">
                  <div className="toggle-label">
                    <i className={`fi ${settings.theme === 'dark' ? 'fi-rr-moon' : 'fi-rr-sun'}`} style={{ marginRight: 6 }} />
                    {settings.theme === 'dark' ? 'Tema Escuro' : 'Tema Claro'}
                  </div>
                  <div className="toggle-desc">Alternar entre modo claro e escuro</div>
                </div>
                <Toggle on={settings.theme === 'dark'} onChange={toggleTheme} />
              </div>
              <div className="toggle-row">
                <div className="toggle-info">
                  <div className="toggle-label">
                    <i className="fi fi-rr-fingerprint" style={{ marginRight: 6 }} />
                    Trava por Biometria
                  </div>
                  <div className="toggle-desc">Exigir Face ID/Touch ID para abrir o app</div>
                </div>
                <Toggle
                  on={settings.biometricEnabled}
                  onChange={async (val) => {
                    if (val) {
                      try {
                        if (!window.PublicKeyCredential) throw new Error('Biometria não suportada neste dispositivo.');
                        const challenge = new Uint8Array(32);
                        window.crypto.getRandomValues(challenge);
                        const cred = await navigator.credentials.create({
                          publicKey: {
                            challenge,
                            rp: { name: "Eazy Finance" },
                            user: {
                              id: new Uint8Array(16),
                              name: settings.email || "user@eazy",
                              displayName: settings.name || "User"
                            },
                            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                            authenticatorSelection: { userVerification: "required" },
                            timeout: 60000,
                          }
                        });
                        if (cred) {
                          localStorage.setItem('eazy_biometric_id', btoa(String.fromCharCode.apply(null, new Uint8Array(cred.rawId))));
                          updateSettings({ biometricEnabled: true });
                          alert('Biometria habilitada com sucesso!');
                        }
                      } catch (e) {
                        console.error(e);
                        alert('Não foi possível ativar a biometria: ' + e.message);
                      }
                    } else {
                      updateSettings({ biometricEnabled: false });
                      localStorage.removeItem('eazy_biometric_id');
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Categories */}
        <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
          <div className="settings-section-title">
            <span style={{ fontSize: 18 }}><i className="fi fi-rr-tags" /></span>
            Categorias Disponíveis
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
              {categories.length} categoria{categories.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder="Nome da nova categoria..."
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
              <i className="fi fi-rr-plus" /> Adicionar
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
                  title="Remover categoria"
                >
                  <i className="fi fi-rr-trash" style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <Section icon={<i className="fi fi-rr-database" />} title="Dados">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Dados sincronizados na nuvem via Firestore. Exporte como JSON (backup completo) ou CSV (só transações, abre no Excel).
              Importe um JSON gerado por este app para restaurar ou mesclar dados.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={exportJSON}>
                  <i className="fi fi-rr-cloud-download" /> Exportar JSON
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={exportCSV}>
                  <i className="fi fi-rr-file-spreadsheet" /> Exportar CSV
                </button>
              </div>
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                disabled={importStatus === 'loading'}
                onClick={() => { setImportStatus(null); importRef.current?.click() }}
              >
                <i className="fi fi-rr-upload" />
                {importStatus === 'loading' ? 'Importando...' : 'Importar JSON'}
              </button>
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
        <Section icon={<i className="fi fi-rr-info" />} title="Sobre">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            {[
              { label: 'Aplicação', value: 'EazyFinance' },
              { label: 'Versão', value: '1.0.0' },
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
    </div>
  )
}
