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

// Click na notificação abre o app na tela relevante.
//
// Antes isto só focava a primeira janela aberta, ignorando o destino: clicar em
// "fatura vence hoje" caía na Visão Geral. Com o roteador por hash, o job manda
// o destino em fcmOptions.link e aqui ele é aplicado.
self.addEventListener('notificationclick', event => {
  event.notification.close()

  const data = event.notification.data || {}
  const target = data.link || (data.FCM_MSG && data.FCM_MSG.notification && data.FCM_MSG.notification.click_action) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          // navigate() falha em alguns navegadores quando o client está num
          // escopo diferente; focar mesmo assim é melhor que não abrir nada.
          if ('navigate' in client && target !== '/') {
            return client.navigate(target).then(c => (c || client).focus()).catch(() => client.focus())
          }
          return client.focus()
        }
      }
      return clients.openWindow(target)
    })
  )
})
