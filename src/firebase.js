import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyADEdqlObExEeZH2lGczR0NV9wY6gtQ1MY",
  authDomain: "dashboard-c23c8.firebaseapp.com",
  projectId: "dashboard-c23c8",
  storageBucket: "dashboard-c23c8.firebasestorage.app",
  messagingSenderId: "115815405530",
  appId: "1:115815405530:web:de1a139df2b4ef437752e3",
  measurementId: "G-JVGS6QCJSL"
}

const app = initializeApp(firebaseConfig)
export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)

// FCM — VAPID key gerada no Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = 'BEbKBV8HkrJPiL7FAz1aBgHHu3zC0hFWOKmgz7fBnEsQQiulI2VXd_4HS3t8FzYWkx3fqOFv5c9e5o_nPTrmfLs'

let _messaging = null
export function getFirebaseMessaging() {
  if (!_messaging && typeof window !== 'undefined') {
    try { _messaging = getMessaging(app) } catch { _messaging = null }
  }
  return _messaging
}

export { getToken, onMessage }
