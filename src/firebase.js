import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

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

// Cache persistente: sem ele o app é instalável como PWA mas fica inútil offline,
// porque toda leitura vai à rede. Com o multi-tab manager várias abas dividem o
// mesmo cache em vez de a segunda aba falhar ao adquirir o lock.
// initializeFirestore (em vez de getFirestore) porque a config de cache precisa
// ser passada antes de qualquer uso da instância.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Emuladores locais (Auth, Firestore, Storage) para testar o app logado sem
// tocar em produção. Só liga com VITE_USE_EMULATORS=1, que vem do
// .env.emulators: "npm run emulators" num terminal e "npm run dev:emulators"
// em outro (o Firestore precisa de Java). O projeto demo- garante que o SDK
// nunca tenta falar com o Firebase real.
export const usingEmulators = env.VITE_USE_EMULATORS === '1'
if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

// FCM — VAPID key gerada no Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY
  || 'BEbKBV8HkrJPiL7FAz1aBgHHu3zC0hFWOKmgz7fBnEsQQiulI2VXd_4HS3t8FzYWkx3fqOFv5c9e5o_nPTrmfLs'

// ─── Carregados sob demanda ───────────────────────────────────────────────────
// Storage (comprovantes, foto de perfil) e Messaging (push) somam ~220 KB de
// SDK que a abertura do app não usa. Importados aqui dentro, eles saem do chunk
// inicial e só baixam na primeira vez que alguém anexa um arquivo ou liga o push.

let _storage = null
export async function loadStorage() {
  const mod = await import('firebase/storage')
  if (!_storage) {
    _storage = mod.getStorage(app)
    if (usingEmulators) mod.connectStorageEmulator(_storage, '127.0.0.1', 9199)
  }
  return { ...mod, storage: _storage }
}

let _messaging
export async function loadMessaging() {
  if (typeof window === 'undefined') return null
  const mod = await import('firebase/messaging')
  if (_messaging === undefined) {
    // Navegador sem suporte (Safari antigo, aba anônima) lança aqui.
    try { _messaging = mod.getMessaging(app) } catch { _messaging = null }
  }
  return _messaging ? { messaging: _messaging, getToken: mod.getToken, onMessage: mod.onMessage } : null
}
