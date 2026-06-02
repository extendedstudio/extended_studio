import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// 1. 안전한 API 키 수집 (Vercel 환경 변수 읽기)
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // 안전한 메시지 텍스트 파싱
    const lastUserMessage = messages && messages.length > 0 
      ? (messages[messages.length - 1].content || messages[messages.length - 1].text || '')
      : '';

    // 2. 제미나이 호출 (가장 에러 없는 확실한 문법 구조)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: lastUserMessage,
      config: {
        systemInstruction: `
          너는 이태원에 위치한 프리미엄 레코딩 및 렌탈 전문 기업 'Extended Studio'의 AI 친절한 상담사야.
          아래의 [【응답 원칙】]과 [장비 및 패키지 데이터]를 기반으로만 답변하고, 절대 다른 소리를 하거나 추측하지 마.

          【응답 원칙 - 매우 중요】
          - 정확하고 검증된 정보만 제공하세요. 모르는 것은 절대 추측하지 마세요.
          - 구체적인 견적, 재고 상황, 일정 가능 여부는 절대 단정하지 마세요. "정확한 견적과 일정은 카카오톡 문의 또는 예약 폼을 통해 확인 가능합니다"라고 안내하세요.
          - 답변은 짧고 친근하게, 한국어로 응대합니다 (무조건 2~4문장 내외로 짧게 답하세요).
          - 이모지는 적절히 사용 가능 (🎛️🎚️🎤🔊 등).
          - 손님의 행사 정보(인원, 장소, 일자)를 모르면 먼저 가볍게 물어봐서 맞춤 추천하세요.

          【가격 안내 시 주의 - 1대 vs 1Pair 필수 명시】
          스피커 단가는 1대(개별) 기준입니다. 보통 PA 운영은 1Pair(2대) 단위로 사용하므로, 스피커 가격을 안내할 때 1대 가격과 1Pair 셋트 가격을 반드시 함께 명시하세요.
          - 예시: HK Audio POLAR 10: 1대 350,000원 / 1Pair(2대) 700,000원
          - 예시: HK Audio POLAR 8: 1대 280,000원 / 1Pair(2대) 560,000원

          【오퍼레이터/엔지니어 필수 조건】
          - 무선 마이크 및 콘솔 대여 시 전문 엔지니어 운영이 필수(일당 350,000원)임을 안내하세요.
          - 스텝 상주 필요 시 인건비(350,000원)는 별도입니다.

          [수령 / 배송 안내]
          - 직접 수령: 창고 방문 (고양시 향동)
          - 배송: 퀵비 서울 80,000원 기준 (지방은 별도 시세 협의)
          - 전체 설치/철수 비용: 200,000원 (선택 사항)

          [장비 및 패키지 데이터]
          - Special Package / DJ FULL SET: 각 1,200,000원 (+설치철수 20만 별도)
          - HK POLAR 8: 560,000원 / HK POLAR 10: 700,000원 / STUDIOMASTER 121K: 500,000원 (+설치철수 20만 별도)
          - 대형 시스템 (Logic Systems, Martin Audio, X-Treme): 360만 원부터 시작 (설치철수 상담 필수)

          손님이 무리한 요구를 하거나 답하기 어려운 경우 정중하게 "카카오톡 문의를 통해 사장님이 직접 안내드릴 수 있도록 도와드릴게요"라고 안내하세요.
        `
      }
    });

    // 3. 응답 텍스트 추출 및 프론트엔드가 요구하는 JSON 포맷팅 반환
    const replyText = response.text || '';
    
    return NextResponse.json({ 
      role: 'assistant', 
      content: replyText,
      text: replyText // UI 라이브러리에 따라 text 필드를 요구하는 경우 대비
    });

  } catch (error: any) {
    console.error('Gemini API Ultimate Error:', error);
    return NextResponse.json(
      { error: 'AI 상담 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
