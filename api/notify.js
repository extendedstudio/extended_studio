// Vercel Serverless Function: 새 예약 알림을 모든 어드민 토큰에 전송
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase Admin 초기화 (한 번만)
function getAdminApp() {
  if (getApps().length) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Vercel 환경변수에 \n 이 문자열로 들어오므로 실제 줄바꿈으로 변환
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin 환경변수가 설정되지 않았습니다 (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)')
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export default async function handler(req, res) {
  // CORS (필요시)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { name = '', phone = '', date = '', dur = '', type = '', gear = [], note = '' } = req.body || {}

    const app = getAdminApp()
    const db = getFirestore(app)
    const messaging = getMessaging(app)

    // 모든 어드민 토큰 가져오기
    const snap = await db.collection('admin_tokens').get()
    const tokens = snap.docs.map(d => d.data().token).filter(Boolean)

    if (!tokens.length) {
      console.log('No admin tokens registered')
      return res.status(200).json({ sent: 0, message: '등록된 어드민 토큰이 없습니다' })
    }

    // 메시지 내용 구성
    const title = `🔔 새 예약: ${name}`
    const bodyLines = [
      `${phone}${date ? ` · ${date}` : ''}${dur ? ` · ${dur}` : ''}`,
      type ? `행사: ${type}` : null,
      gear && gear.length ? `장비: ${gear.slice(0, 3).join(', ')}${gear.length > 3 ? ` 외 ${gear.length - 3}` : ''}` : null,
    ].filter(Boolean).join('\n')

    const message = {
      notification: { title, body: bodyLines },
      data: {
        title,
        body: bodyLines,
        url: '/?page=admin',
        tag: `req-${Date.now()}`,
      },
      webpush: {
        notification: {
          icon: '/pwa-192.png',
          badge: '/pwa-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200],
        },
        fcmOptions: { link: '/?page=admin' },
      },
    }

    // sendEachForMulticast: 각 토큰에 개별 전송 (실패 토큰 식별 가능)
    const response = await messaging.sendEachForMulticast({ tokens, ...message })

    // 실패한 토큰 정리 (등록 만료 등)
    const invalidTokens = []
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || ''
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[i])
        }
      }
    })
    if (invalidTokens.length) {
      await Promise.all(invalidTokens.map(t => db.collection('admin_tokens').doc(t).delete().catch(() => null)))
    }

    return res.status(200).json({
      sent: response.successCount,
      failed: response.failureCount,
      cleaned: invalidTokens.length,
    })
  } catch (e) {
    console.error('notify error:', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
