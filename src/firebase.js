import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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
export const auth = getAuth(app)
export const db   = getFirestore(app)
