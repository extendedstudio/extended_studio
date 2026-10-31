// 에이전시 공통 설정 — 공개 페이지(App.jsx)와 관리자(AgencyAdmin.jsx)가 함께 사용
export const AGENCY_DIRECTOR = { name: '송설아', title: 'AGENCY DIRECTOR' }
export const AGENCY_ROLES = [
  { key: 'promoter', label: 'Promoter', ko: '프로모터', desc: '팝업스토어 · 브랜드 행사 · 샘플링 · 고객 응대', badge: '주력' },
  { key: 'protocol', label: 'Protocol', ko: '의전', desc: 'VIP·귀빈 영접과 안내 · 시상식·개회식 · 기업·호텔 행사', badge: '강점' },
  { key: 'model', label: 'Model', ko: '모델', desc: '런칭 · 전시 · 브랜드 행사' },
  { key: 'dancer', label: 'Dancer', ko: '댄서', desc: '오프닝 · 퍼포먼스 · 파티' },
  { key: 'staff', label: 'Event Staff', ko: '행사 스태프', desc: '운영 · 안내 · 등록 데스크 · 진행 보조' },
]
export const AGENCY_STATUS = ['문의', '후보 추천', '확정', '행사 완료', '정산 완료', '취소']
export const AGENCY_STATUS_COLOR = { '문의': '#1c1c1c', '후보 추천': '#6f6f6f', '확정': '#22c55e', '행사 완료': '#3b82f6', '정산 완료': '#8b5cf6', '취소': '#ef4444' }
