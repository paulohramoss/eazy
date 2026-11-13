// Trava biométrica: a preferência fica no aparelho, não no Firestore, porque a
// credencial é registrada por dispositivo. O App lê isto antes de montar o
// AppProvider, para decidir se mostra o cadeado antes de abrir os dados.
const storageKey = (uid) => `bio_${uid}`

export const loadBiometric = (uid) =>
  !!JSON.parse(localStorage.getItem(storageKey(uid)) || 'false')

export const saveBiometric = (uid, enabled) =>
  localStorage.setItem(storageKey(uid), JSON.stringify(!!enabled))

// Id da credencial WebAuthn registrada neste aparelho, em base64. Sem ele o
// navegador ainda consegue pedir a biometria, só não sabe qual chave preferir.
const CREDENTIAL_KEY = 'eazy_biometric_id'

export const saveCredentialId = (rawId) =>
  localStorage.setItem(CREDENTIAL_KEY, btoa(String.fromCharCode.apply(null, new Uint8Array(rawId))))

export const loadCredentialId = () => {
  const stored = localStorage.getItem(CREDENTIAL_KEY)
  return stored ? Uint8Array.from(atob(stored), c => c.charCodeAt(0)) : null
}

export const clearCredentialId = () => localStorage.removeItem(CREDENTIAL_KEY)
