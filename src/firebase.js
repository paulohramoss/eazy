import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

// Config via env para separar dev/staging/prod sem editar código. Estes valores
// não são segredo — o Firebase os expõe no bundle por design, e quem protege os
// dados são as regras do Firestore/Storage. Os fallbacks mantêm o projeto atual
// funcionando para quem ainda não criou o .env.
const env = import.meta.env

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY             || "AIzaSyADEdqlObExEeZH2lGczR0NV9wY6gtQ1MY",
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN         || "dashboard-c23c8.firebaseapp.com",
  projectId:         env.VITE_FIREBASE_PROJECT_ID          || "dashboard-c23c8",
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET      || "dashboard-c23c8.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "115815405530",
  appId:             env.VITE_FIREBASE_APP_ID              || "1:115815405530:web:de1a139df2b4ef437752e3",
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID      || "G-JVGS6QCJSL",
}

const app = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const storage = getStorage(app)

// Cache persistente: sem ele o app é instalável como PWA mas fica inútil offline,
// porque toda leitura vai à rede. Com o multi-tab manager várias abas dividem o
// mesmo cache em vez de a segunda aba falhar ao adquirir o lock.
// initializeFirestore (em vez de getFirestore) porque a config de cache precisa
// ser passada antes de qualquer uso da instância.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// FCM — VAPID key gerada no Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY
  || 'BEbKBV8HkrJPiL7FAz1aBgHHu3zC0hFWOKmgz7fBnEsQQiulI2VXd_4HS3t8FzYWkx3fqOFv5c9e5o_nPTrmfLs'

let _messaging = null
export function getFirebaseMessaging() {
  if (!_messaging && typeof window !== 'undefined') {
    try { _messaging = getMessaging(app) } catch { _messaging = null }
  }
  return _messaging
}

export { getToken, onMessage }
