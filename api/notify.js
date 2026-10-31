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

// ─── 텔레그램 알림 ───────────────────────────────────────
// Vercel 환경변수:
//   TELEGRAM_BOT_TOKEN        — @BotFather 에서 만든 봇 토큰 (필수)
//   TELEGRAM_CHAT_ID          — 모든 알림(장비 예약 + 에이전시)을 받을 채팅 ID, 여러 명이면 쉼표로 구분
//   TELEGRAM_AGENCY_CHAT_ID   — 에이전시 문의만 받을 채팅 ID (선택, 쉼표 구분)
const ids = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean)
async function sendTelegram(text, isAgency) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chats = [...new Set([...ids(process.env.TELEGRAM_CHAT_ID), ...(isAgency ? ids(process.env.TELEGRAM_AGENCY_CHAT_ID) : [])])]
  if (!token || !chats.length) return { sent: 0, skipped: '텔레그램 환경변수 없음' }
  let sent = 0
  const errors = []
  await Promise.all(chats.map(async chat_id => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (j.ok) sent++
      else errors.push(j.description || `HTTP ${r.status}`)
    } catch (e) { errors.push(e?.message || String(e)) }
  }))
  return { sent, failed: errors.length, errors: errors.slice(0, 3) }
}

export default async function handler(req, res) {
  // CORS (필요시)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { name = '', phone = '', date = '', dur = '', type = '', gear = [], note = '', kind = '' } = req.body || {}
    const isAgency = kind === 'agency' || String(name).startsWith('[에이전시]')

    // 텔레그램 (웹 푸시와 별개로 항상 시도 — 실패해도 웹 푸시는 계속)
    const siteUrl = `https://${req.headers.host || 'extended-studio.vercel.app'}/?page=admin`
    const tgText = [
      isAgency ? `🤝 새 에이전시 문의: ${String(name).replace(/^\[에이전시\]\s*/, '')}` : `🔔 새 장비 예약: ${name}`,
      phone && `📞 ${phone}`,
      (date || dur) && `📅 ${[date, dur].filter(Boolean).join(' · ')}`,
      type && `행사: ${type}`,
      gear && gear.length ? `${isAgency ? '인력' : '장비'}: ${gear.slice(0, 6).join(', ')}${gear.length > 6 ? ` 외 ${gear.length - 6}` : ''}` : null,
      note && `메모: ${String(note).slice(0, 300)}`,
      '',
      `관리자 화면: ${siteUrl}`,
    ].filter(x => x !== null && x !== undefined && x !== false).join('\n')
    const telegram = await sendTelegram(tgText, isAgency).catch(e => ({ sent: 0, error: e?.message }))

    const app = getAdminApp()
    const db = getFirestore(app)
    const messaging = getMessaging(app)

    // 모든 어드민 토큰 가져오기
    const snap = await db.collection('admin_tokens').get()
    const tokens = snap.docs.map(d => d.data().token).filter(Boolean)

    if (!tokens.length) {
      console.log('No admin tokens registered')
      return res.status(200).json({ sent: 0, message: '등록된 어드민 토큰이 없습니다', telegram })
    }

    // 앱 아이콘 숫자: 아직 처리 안 한 건수 = 장비 예약 '신청' + 에이전시 '문의'
    let badge = 0
    try {
      const [a, b] = await Promise.all([
        db.collection('requests').where('status', '==', '신청').count().get(),
        db.collection('agency_requests').where('status', '==', '문의').count().get(),
      ])
      badge = (a.data().count || 0) + (b.data().count || 0)
    } catch (e) { console.warn('badge count 실패:', e?.message) }

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
        badge: String(badge),
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
      telegram,
    })
  } catch (e) {
    console.error('notify error:', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
