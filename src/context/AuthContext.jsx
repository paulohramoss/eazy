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

const AuthContext = createContext(null)

// Boas-vindas via Resend (api/welcome-email). Fire-and-forget: falha no envio
// não pode travar o cadastro, e o servidor garante um envio por conta.
const sendWelcome = (name) =>
  apiPost('/api/welcome-email', { name }).catch(err => console.error('[welcome email]', err))

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
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
    // chegaria ao dono. Falhar aqui não deve impedir o cadastro.
    sendEmailVerification(cred.user).catch(err => console.error('[verify email]', err))
    sendWelcome(name)
    // Refresh user so displayName is available
    setUser({ ...cred.user, displayName: name })
    return cred
  }

  // Recuperação de senha. Antes, quem esquecia a senha ficava permanentemente
  // sem acesso à conta — não havia caminho nenhum na interface.
  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  const resendVerification = () => {
    if (!auth.currentUser) throw new Error('Nenhum usuário autenticado')
    return sendEmailVerification(auth.currentUser)
  }

  const signInGoogle = async () => {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    if (getAdditionalUserInfo(cred)?.isNewUser) sendWelcome(cred.user.displayName)
    return cred
  }

  const logOut = () => signOut(auth)

  if (loading) return null   // Aguarda resolução do estado de auth

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signInGoogle, logOut, resetPassword, resendVerification }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
