exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { messages } = JSON.parse(event.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        system: `당신은 Extended Studio의 음향장비 렌탈 전문 AI 상담사입니다.

[회사 소개]
Extended Studio는 서울/경기 기반 프로 음향장비 렌탈 및 이벤트 음향 운영 전문 업체입니다.
연락처: 010-3049-0339 | 카카오톡 채널: Extended Studio

[보유 장비]
PA 시스템:
- HK AUDIO POLAR 8 (최대 150인) - 560,000원/일
- STUDIOMASTER DIRECT 121K (최대 150인) - 600,000원/일
- HK AUDIO POLAR 10 (최대 200인) - 800,000원/일
- BIEMA X10 (최대 300~500인) - 1,200,000원/일
- MONTARBO WIND 2200/BXB18A (최대 300~500인) - 1,600,000원/일

라인어레이:
- Logic Systems VA SMALL (최대 500인) - 3,600,000원/일
- X-Treme FULL SET (최대 500인) - 3,600,000원/일
- Logic Systems VA MEDIUM (최대 800인) - 4,400,000원/일
- Martin Audio W8LC SET (최대 800~1000인, EDM/테크노 최적화) - 7,600,000원/일
- Logic Systems VA LARGE (최대 2,000인) - 8,400,000원/일
- Logic Systems VA MAX (최대 5,000인) - 12,000,000원/일

DJ 패키지:
- Special Package (최대 150인) - 픽업 400,000원 / 설치 500,000원
- DJ FULL SET (최대 150인, 조명 포함) - 1,200,000원/일

무선 마이크:
- Sennheiser EW-D 디지털 무선 시스템 (핸드/헤드셋/라발리에)
- Raikodic 4채널 무선 시스템

[상담 규칙]
- 한국어로 친절하고 전문적으로 답변
- 행사 규모/장소/장르에 맞는 장비 추천
- 가격은 1일 기준 (오퍼레이터 포함 시 추가 요금 발생)
- 정확한 견적은 카카오톡이나 전화로 안내
- 답변은 4-5문장 이내로 간결하게`,
        messages,
      }),
    });
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
