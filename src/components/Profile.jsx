import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { storage } from '../firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { formatBrazilMobile, getBrazilMobileError, PHONE_MASK_PLACEHOLDER } from '../utils/phone'

function Section({ icon, title, children, style }) {
  return (
    <div className="settings-section" style={style}>
      <div className="settings-section-title">
        <span style={{ fontSize: 18 }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

// Redimensiona e comprime a imagem antes do upload
function resizeImage(file, maxSize = 400) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > height) { if (width > maxSize) { height = (height * maxSize) / width; width = maxSize } }
      else { if (height > maxSize) { width = (width * maxSize) / height; height = maxSize } }
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

export default function Profile() {
  const { settings, updateSettings } = useApp()
  const { user } = useAuth()

  const [profile, setProfile] = useState({
    name:     settings.name     || '',
    email:    settings.email    || '',
    initials: settings.initials || '',
    phone:    formatBrazilMobile(settings.phone || settings.smsPhone || ''),
  })
  const [saved,        setSaved]        = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState(null)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(settings.photoURL || null)

  const fileInputRef = useRef(null)
  const set = (k, v) => setProfile(prev => ({ ...prev, [k]: v }))

  const displayInitials = profile.initials || profile.name?.slice(0, 2).toUpperCase()
  const hasPhoto = !!photoPreview
  const phoneError = getBrazilMobileError(profile.phone)

  // ── Upload de foto ───────────────────────────────────────────────────────────

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Selecione uma imagem válida (JPG, PNG, etc.)'); return }

    setUploadError(null)
    setUploading(true)

    try {
      const blob       = await resizeImage(file)
      const storageRef = ref(storage, `avatars/${user.uid}/profile.jpg`)
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(storageRef)
      setPhotoPreview(url)
      updateSettings({ photoURL: url })
    } catch (err) {
      setUploadError('Erro ao enviar a foto. Tente novamente.')
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    try {
      const storageRef = ref(storage, `avatars/${user.uid}/profile.jpg`)
      await deleteObject(storageRef).catch(() => {})
    } finally {
      setPhotoPreview(null)
      updateSettings({ photoURL: '' })
    }
  }

  // ── Salvar perfil ────────────────────────────────────────────────────────────

  const handlePhoneChange = (e) => {
    set('phone', formatBrazilMobile(e.target.value))
  }

  const saveProfile = () => {
    if (!profile.name.trim()) return

    const phone = formatBrazilMobile(profile.phone)
    const nextPhoneError = getBrazilMobileError(phone)

    if (nextPhoneError) {
      set('phone', phone)
      setPhoneTouched(true)
      return
    }

    updateSettings({ ...profile, phone, smsPhone: phone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="screen">
      <div className="settings-grid">

        {/* ── Prévia do perfil ─────────────────────────────── */}
        <Section icon={<i className="fi fi-rr-id-badge" />} title="Prévia do Perfil" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, flex: 1, justifyContent: 'center', padding: '24px 0' }}>

            {/* Avatar com overlay de edição */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: hasPhoto ? 'transparent' : 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, fontWeight: 700, color: 'white',
                boxShadow: '0 4px 20px rgba(0,83,239,0.25)',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {hasPhoto
                  ? <img src={photoPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : displayInitials
                }
              </div>

              {/* Botão de edição sobre o avatar */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Alterar foto"
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent)', border: '2px solid var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 12, color: 'white',
                  transition: 'background 0.15s',
                }}
              >
                <i className={`fi ${uploading ? 'fi-rr-spinner' : 'fi-rr-camera'}`} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{profile.name || '—'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{profile.email || '—'}</div>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '.5px',
                background: 'rgba(var(--accent-rgb), 0.12)', color: 'var(--accent)',
                padding: '3px 10px', borderRadius: 99,
              }}>
                CONTA PESSOAL
              </span>
            </div>

            <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: 'fi-rr-user',       label: 'Nome',     value: profile.name     || '—' },
                { icon: 'fi-rr-envelope',   label: 'E-mail',   value: profile.email    || '—' },
                { icon: 'fi-rr-smartphone', label: 'Celular',  value: profile.phone    || '—' },
                { icon: 'fi-rr-text',       label: 'Iniciais', value: displayInitials  || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <i className={`fi ${row.icon}`} style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center' }} />
                  <span style={{ color: 'var(--text-muted)', minWidth: 56 }}>{row.label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Formulário de edição ─────────────────────────── */}
        <Section icon={<i className="fi fi-rr-edit" />} title="Editar Informações">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Foto de perfil */}
            <div className="form-group">
              <label className="form-label">Foto de perfil</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                {/* Mini preview */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  background: hasPhoto ? 'transparent' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: 'white',
                  overflow: 'hidden', border: '2px solid var(--border)',
                }}>
                  {hasPhoto
                    ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : displayInitials
                  }
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ justifyContent: 'center', fontSize: 13 }}
                  >
                    <i className={`fi ${uploading ? 'fi-rr-spinner' : 'fi-rr-upload'}`} />
                    {uploading ? 'Enviando...' : hasPhoto ? 'Alterar foto' : 'Enviar foto'}
                  </button>

                  {hasPhoto && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleRemovePhoto}
                      style={{ justifyContent: 'center', fontSize: 13, color: 'var(--accent-red)' }}
                    >
                      <i className="fi fi-rr-trash" /> Remover foto
                    </button>
                  )}
                </div>
              </div>

              {uploadError && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 9, fontSize: 12,
                  background: 'rgba(232,56,42,0.08)', border: '1px solid rgba(232,56,42,0.2)',
                  color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  <i className="fi fi-rr-cross-circle" /> {uploadError}
                </div>
              )}

              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                JPG, PNG ou WEBP · Máx. 10 MB · A imagem será redimensionada automaticamente
              </p>
            </div>

            {/* Nome */}
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="form-input"
                value={profile.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            {/* E-mail */}
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                className="form-input"
                type="email"
                value={profile.email}
                onChange={e => set('email', e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            {/* Celular */}
            <div className="form-group">
              <label className="form-label">Celular</label>
              <div style={{ position: 'relative' }}>
                <i className="fi fi-rr-smartphone" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none',
                }} />
                <input
                  className="form-input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={17}
                  value={profile.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder={PHONE_MASK_PLACEHOLDER}
                  aria-invalid={!!phoneError}
                  style={{ paddingLeft: 38, borderColor: phoneTouched && phoneError ? 'var(--accent-red)' : undefined }}
                />
              </div>
              {phoneTouched && phoneError && (
                <p style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 5 }}>
                  {phoneError}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Usado para notificações por SMS quando ativadas
              </p>
            </div>

            {/* Iniciais */}
            <div className="form-group">
              <label className="form-label">Iniciais (avatar)</label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Exibidas quando não há foto de perfil — até 2 letras.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  className="form-input"
                  maxLength={2}
                  value={profile.initials}
                  onChange={e => set('initials', e.target.value.toUpperCase())}
                  style={{ width: 72 }}
                  placeholder="AB"
                  disabled={hasPhoto}
                />
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: hasPhoto ? 'transparent' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
                  overflow: 'hidden', border: '1px solid var(--border)',
                }}>
                  {hasPhoto
                    ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : displayInitials
                  }
                </div>
              </div>
              {hasPhoto && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  As iniciais ficam ocultas enquanto há uma foto de perfil.
                </p>
              )}
            </div>

            <div style={{ marginTop: 4 }}>
              <button className="btn btn-primary" onClick={saveProfile}>
                {saved
                  ? <><i className="fi fi-rr-check" /> Salvo!</>
                  : <><i className="fi fi-rr-disk" /> Salvar alterações</>
                }
              </button>
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}
