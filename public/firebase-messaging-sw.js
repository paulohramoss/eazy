importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyADEdqlObExEeZH2lGczR0NV9wY6gtQ1MY",
  authDomain: "dashboard-c23c8.firebaseapp.com",
  projectId: "dashboard-c23c8",
  storageBucket: "dashboard-c23c8.firebasestorage.app",
  messagingSenderId: "115815405530",
  appId: "1:115815405530:web:de1a139df2b4ef437752e3",
})

const messaging = firebase.messaging()

// Trata mensagens em background (app fechado/minimizado)
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {}
  self.registration.showNotification(title || 'EAZY Finance', {
    body: body || '',
    icon: icon || '/logo.png',
    badge: '/logo.png',
    data: payload.data,
    requireInteraction: false,
  })
})

// Click na notificação abre o app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus()
      return clients.openWindow('/')
    })
  )
})
