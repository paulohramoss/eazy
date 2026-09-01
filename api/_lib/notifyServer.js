// Entrega server-side das notificações (e-mail + push FCM).
//
// O notify() do cliente só existe enquanto o app está aberto — era por isso que
// lembrete de fatura, relatório semanal/mensal e lembrete de objetivos ficavam
// marcados "em breve" na interface. Aqui os mesmos eventos saem do agendador.
import { adminDb, adminMessaging } from './firebaseAdmin.js'
import { sendNotificationEmail } from './mailer.js'
import { FieldValue } from 'firebase-admin/firestore'

export const fmtMoney = (n, currency = 'BRL') =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency })

// Envia por todos os canais que o usuário habilitou. Nunca lança: uma falha de
// um usuário não pode derrubar o lote inteiro do cron.
export async function deliver({ uid, prefs, type, title, body, data = {}, emailType }) {
  const results = { email: null, push: null }

  if (prefs.emailEnabled && prefs.emailAddress) {
    try {
      await sendNotificationEmail({
        to: prefs.emailAddress,
        type: emailType || type,
        data: { ...data, currency: prefs.currency || 'BRL' },
      })
      results.email = 'sent'
    } catch (err) {
      results.email = `error: ${err.message}`
    }
  }

  if (prefs.pushEnabled && prefs.fcmToken) {
    try {
      await adminMessaging().send({
        token: prefs.fcmToken,
        notification: { title, body },
        webpush: {
          notification: { icon: '/logo.png' },
          // Abre direto na tela relevante — o roteador por hash torna isso
          // possível.
          fcmOptions: data.link ? { link: data.link } : undefined,
        },
      })
      results.push = 'sent'
    } catch (err) {
      results.push = `error: ${err.code || err.message}`
      // Token revogado (app desinstalado, permissão retirada): limpa para não
      // tentar de novo todo dia até o fim dos tempos.
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        await adminDb().collection('users').doc(uid)
          .update({ 'prefs.fcmToken': FieldValue.delete() })
          .catch(() => {})
      }
    }
  }

  return results
}

// Marca o que já foi enviado, para o job ser idempotente: reexecutar o cron (ou
// uma nova tentativa após falha parcial) não deve reenviar o mesmo aviso.
export async function alreadySent(uid, key) {
  const ref = adminDb().collection('users').doc(uid).collection('notificationLog').doc(key)
  const snap = await ref.get()
  return snap.exists
}

export async function markSent(uid, key, meta = {}) {
  await adminDb().collection('users').doc(uid).collection('notificationLog').doc(key)
    .set({ ...meta, sentAt: FieldValue.serverTimestamp() })
}
