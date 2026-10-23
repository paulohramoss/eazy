import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  getAdditionalUserInfo,
} from 'firebase/auth'
import { apiPost } from '../utils/api'
import { bootLog } from '../utils/bootLog'

const AuthContext = createContext(null)

// Boas-vindas (api/welcome-email). Fire-and-forget: falha no envio não pode
// travar o cadastro, e o servidor garante um envio por conta.
const sendWelcome = (name) =>
  apiPost('/api/welcome-email', { name }).catch(err => console.error('[welcome email]', err))

// E-mails de conta pelo template do app (api/auth-email). Se a função falhar
// por outro motivo que não rate limit, cai no envio padrão do Firebase — feio,
// mas o usuário não fica sem o link.
async function viaServer(body, fallback) {
  try {
    await apiPost('/api/auth-email', body)
  } catch (err) {
    if (err.status === 429) {
      throw Object.assign(new Error(err.message), { code: 'auth/too-many-requests' })
    }
    console.error('[auth email]', err)
    await fallback()
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      bootLog('auth resolved', { user: !!u })
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const signUp = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    // Verificação de e-mail: sem isto não havia como distinguir uma conta com
    // endereço real de uma digitada errado, e a recuperação de senha nunca
    // chegaria ao dono. O e-mail de boas-vindas já leva o botão de confirmar;
    // se ele falhar, sai ao menos a verificação padrão do Firebase. Nada disso
    // pode impedir o cadastro.
    apiPost('/api/welcome-email', { name }).catch(err => {
      console.error('[welcome email]', err)
      sendEmailVerification(cred.user).catch(e => console.error('[verify email]', e))
    })
    // Refresh user so displayName is available
    setUser({ ...cred.user, displayName: name })
    return cred
  }

  // Nome de exibição mora na conta de login (o AppContext deriva nome e
  // iniciais dele). O Perfil gravava o nome nas preferências, que descartam
  // esse campo de propósito — e mostrava "Salvo!" sem salvar nada.
  const updateDisplayName = async (name) => {
    const current = auth.currentUser
    if (!current) return
    await updateProfile(current, { displayName: name })
    setUser({ ...current, displayName: name })
  }

  // Recuperação de senha. Antes, quem esquecia a senha ficava permanentemente
  // sem acesso à conta — não havia caminho nenhum na interface.
  const resetPassword = (email) =>
    viaServer({ type: 'reset', email }, () => sendPasswordResetEmail(auth, email))

  const resendVerification = () => {
    const current = auth.currentUser
    if (!current) throw new Error('Nenhum usuário autenticado')
    return viaServer({ type: 'verify' }, () => sendEmailVerification(current))
  }

  const signInGoogle = async () => {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    if (getAdditionalUserInfo(cred)?.isNewUser) sendWelcome(cred.user.displayName)
    return cred
  }

  const logOut = () => signOut(auth)

  if (loading) return null   // Aguarda resolução do estado de auth

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signInGoogle, logOut, resetPassword, resendVerification, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
