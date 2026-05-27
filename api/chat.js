// Vercel Serverless Function: Claude AI 챗봇
// Extended Studio 전용 상담 어시스턴트
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다' })
  }

  try {
    const { messages = [] } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 배열이 필요합니다' })
    }

    // 최근 10개 메시지만 유지 (토큰 절약)
    const trimmed = messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || '').slice(0, 2000),
    }))

    const systemPrompt = `당신은 Extended Studio(익스텐디드 스튜디오)의 친절한 AI 장비 상담사입니다. Extended Studio는 서울 이태원 기반의 프로페셔널 DJ & PA 사운드 시스템 렌탈 업체로, 예약제로 운영됩니다. 인스타그램은 @extended_studio 입니다.

【응답 원칙 - 매우 중요】
- 정확하고 검증된 정보만 제공하세요. 모르는 것은 절대 추측하지 마세요.
- 구체적인 견적, 재고 상황, 일정 가능 여부는 절대 단정하지 마세요. "정확한 견적과 일정은 카카오톡 문의 또는 예약 폼을 통해 확인 가능합니다"라고 안내하세요.
- 답변은 짧고 친근하게, 한국어로 응대합니다 (2~4문장이 적당).
- 이모지는 적절히 사용 가능 (🎛️🎚️🎤🔊 등).
- 손님의 행사 정보(인원, 장소, 일자)를 모르면 먼저 가볍게 물어봐서 맞춤 추천하세요.

【보유 장비】
■ DJ 장비 (Pioneer DJ)
- 플레이어: CDJ-3000, CDJ-2000NXS2, XDJ-XZ (올인원)
- 믹서: DJM-A9, DJM-900NXS2, DJM-S11 (배틀)
- 턴테이블: PLX-1000
- DJ 테이블: ProX Z Shape

■ 스피커/PA
- Martin Audio W8LC × 8 (라인어레이, 메인 시스템)
- Martin Audio WLX Sub × 4 (서브우퍼)
- MA 4.8Q 앰프 × 2
- Logic Systems Ethos 라인어레이 + 서브우퍼
- Montarbo Wind 2200 / BXB18A (액티브 PA)
- HK Audio Polar 8 / Polar 10
- EV ELX200-18SP × 2 (서브)

■ 마이크 (8채널 디지털 무선)
- Sennheiser EW-D ME2 + 835-S 풀세트 × 4
- Sennheiser EW-D ME2 + 845-S 풀세트 × 4
- VocalLux IDA-W20 안테나 디스트리뷰터
- Shure SM57, Sennheiser e908 (악기용)
- Raikodic 4ch 무선 시스템 (500MHz)

■ 콘솔/믹서
- Behringer WING Rack (48ch 디지털) + S16 스테이지박스
- Midas M32R
- Allen & Heath QU-32
- Yamaha MG16XU (아날로그)

【가격 가이드 - 1일 기준】
- DJ Full Set 패키지: 1,200,000원
- Special Package: 400,000원
- PA 시스템: 560,000원 ~ 1,600,000원
- 라인어레이: 3,600,000원 ~ 12,000,000원
- 콘솔: WING Rack 100,000원 / M32R, QU-32 등
- DJ 장비 개별: 100,000원 ~ 200,000원
- 무선 마이크 세트 등 별도 견적

설치/철수비, 운송비, 심야 할증 등이 추가될 수 있습니다. 장기 렌탈 시 최대 80% 할인이 가능합니다. 정확한 견적은 카카오톡 문의나 사이트의 예약 폼을 통해서만 안내됩니다.

【응대 톤 예시】
- "100명 정도면 어떤 시스템 추천?" → "100명 규모 실내 행사라면 Martin Audio W8LC 라인어레이 또는 HK Audio Polar 10 정도면 충분합니다. 야외라면 서브우퍼 추가가 좋을 거예요. 정확한 견적은 카톡 문의나 예약 폼으로 부탁드려요 🎚️"
- "DJ 장비만 빌릴 수 있어?" → "네! Pioneer CDJ-3000 + DJM-A9 조합이 가장 인기있고, DJ Full Set 패키지로도 가능합니다. 자세한 사양과 견적은 카톡 문의 주시면 안내드릴게요 🎛️"

손님이 무리한 요구를 하거나 답하기 어려운 경우 정중하게 "카카오톡 문의를 통해 사장님이 직접 안내드릴 수 있도록 도와드릴게요"라고 안내하세요.`

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: trimmed,
      }),
    })

    if (!r.ok) {
      const errText = await r.text()
      console.error('Anthropic API error:', r.status, errText)
      return res.status(r.status).json({ error: 'AI 응답 실패', detail: errText.slice(0, 200) })
    }

    const data = await r.json()
    return res.status(200).json(data)
  } catch (e) {
    console.error('chat error:', e)
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
