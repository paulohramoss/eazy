// Firebase Admin SDK — inicialização preguiçosa e compartilhada.
//
// Cada função serverless roda no seu próprio isolate, mas o isolate é reusado
// entre invocações quentes. initializeApp() estoura se chamado duas vezes, daí
// o guard em getApps().
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

let _app = null

function app() {
  if (_app) return _app
  if (getApps().length) { _app = getApps()[0]; return _app }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada')

  let credentials
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido')
  }

  // A private_key vem do console com \n literais quando colada numa env var de
  // uma linha só. Sem esta troca o SDK rejeita a chave.
  if (typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  _app = initializeApp({ credential: cert(credentials) })
  return _app
}

export const adminAuth = () => getAuth(app())
export const adminDb   = () => getFirestore(app())
export const adminMessaging = () => getMessaging(app())
