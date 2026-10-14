// Vercel Serverless Function: 어드민 "방문자" 탭용 Web Analytics 데이터 조회
// 필요한 환경변수 (Vercel 프로젝트 설정 → Environment Variables):
//   VERCEL_TOKEN   — Vercel 계정에서 발급한 액세스 토큰 (필수)
//   VERCEL_TEAM_ID — 팀 소유 프로젝트일 때만 (선택, 없으면 자동으로 찾음)
// VERCEL_PROJECT_ID 는 Vercel이 자동으로 넣어주는 시스템 환경변수를 사용합니다.

const API = 'https://api.vercel.com/v1/query/web-analytics/visits'
const ADMIN_PIN = process.env.ADMIN_PIN || '0903'

// 한 번 찾은 팀 ID는 함수 인스턴스가 살아있는 동안 재사용
let cachedTeam // undefined = 아직 모름, null = 개인 계정(팀 없음), 'team_xxx' = 팀

async function call(path, params, token, teamId) {
  const qs = new URLSearchParams(params)
  if (teamId) qs.set('teamId', teamId)
  const r = await fetch(`${API}/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, body }
}

// 팀 ID 자동 탐색: 팀 없이 먼저 시도 → 실패하면 계정의 팀 목록으로 하나씩 시도
async function resolveTeam(token, projectId, probeParams) {
  if (cachedTeam !== undefined) return cachedTeam
  if (process.env.VERCEL_TEAM_ID) return (cachedTeam = process.env.VERCEL_TEAM_ID)

  const first = await call('count', probeParams, token, null)
  if (first.ok) return (cachedTeam = null)

  const tr = await fetch('https://api.vercel.com/v2/teams', { headers: { Authorization: `Bearer ${token}` } })
  const teams = (await tr.json().catch(() => ({}))).teams || []
  for (const t of teams) {
    const r = await call('count', probeParams, token, t.id)
    if (r.ok) return (cachedTeam = t.id)
  }
  const err = new Error(first.body?.error?.message || `Vercel API 오류 (${first.status})`)
  err.status = first.status
  throw err
}

// 한국 시간 기준 오늘 0시 (UTC 타임스탬프, ms)
function kstMidnight(now) {
  const KST = 9 * 3600 * 1000
  const d = new Date(now + KST)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime() - KST
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })
  if (req.headers['x-admin-pin'] !== ADMIN_PIN) return res.status(401).json({ error: '권한 없음' })

  // 대문자/소문자 이름 모두 허용 (Secret 변수는 이름 변경이 안 되기 때문)
  const token = process.env.VERCEL_TOKEN || process.env.vercel_token
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token) return res.status(500).json({ error: 'VERCEL_TOKEN 환경변수가 설정되지 않았습니다.', code: 'NO_TOKEN' })
  if (!projectId) return res.status(500).json({ error: 'VERCEL_PROJECT_ID 를 찾을 수 없습니다. 프로젝트 설정에서 "Enable access to System Environment Variables" 를 켜주세요.', code: 'NO_PROJECT' })

  const now = Date.now()
  const DAY = 24 * 3600 * 1000
  const until = new Date(now).toISOString()
  const today = new Date(kstMidnight(now)).toISOString()
  const d7 = new Date(kstMidnight(now) - 6 * DAY).toISOString()
  const d30 = new Date(kstMidnight(now) - 29 * DAY).toISOString()
  const base = { projectId }

  try {
    const teamId = await resolveTeam(token, projectId, { ...base, since: d30, until })

    const q = (path, p) => call(path, { ...base, ...p }, token, teamId)
    const [cToday, c7, c30, daily, refs, devices, countries] = await Promise.all([
      q('count', { since: today, until }),
      q('count', { since: d7, until }),
      q('count', { since: d30, until }),
      q('aggregate', { since: d30, until, by: 'day', limit: '100' }),
      q('aggregate', { since: d30, until, by: 'referrerHostname', limit: '8' }),
      q('aggregate', { since: d30, until, by: 'deviceType', limit: '5' }),
      q('aggregate', { since: d30, until, by: 'country', limit: '6' }),
    ])

    const failed = [cToday, c7, c30, daily, refs, devices, countries].find(r => !r.ok)
    if (failed) {
      return res.status(failed.status).json({
        error: failed.body?.error?.message || `Vercel API 오류 (${failed.status})`,
        code: `HTTP_${failed.status}`,
      })
    }

    const total = r => ({ pageviews: r.body.data?.pageviews ?? 0, visitors: r.body.data?.visitors ?? 0 })
    const rows = (r, key) => (r.body.data || []).map(x => ({ label: x[key] || '(직접 접속)', pageviews: x.pageviews ?? 0, visitors: x.visitors ?? 0 }))

    return res.status(200).json({
      updatedAt: until,
      totals: { today: total(cToday), last7: total(c7), last30: total(c30) },
      daily: (daily.body.data || []).map(x => ({ date: x.timestamp, pageviews: x.pageviews ?? 0, visitors: x.visitors ?? 0 })),
      referrers: rows(refs, 'referrerHostname'),
      devices: rows(devices, 'deviceType'),
      countries: rows(countries, 'country'),
    })
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || '알 수 없는 오류', code: e.status ? `HTTP_${e.status}` : 'UNKNOWN' })
  }
}
