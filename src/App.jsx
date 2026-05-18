import { useState } from 'react'
import data from './data.json'
import './index.css'

const $ = {
  gold: '#c8a96e',
  bg: '#080808',
  text: '#f0ede6',
  muted: '#666',
  border: '#1e1e1e',
}

const CAT_ICON = {
  'DJ PACKAGE': '🎛️', 'LINE ARRAY': '🔊', 'PA SYSTEM': '📢', default: '🎵'
}

// ─── AI 챗봇 ────────────────────────────────────────────
function AiChat() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: '안녕하세요! Extended Studio AI 상담사입니다 🎛️\n행사 규모나 필요한 장비를 말씀해 주시면 맞춤 추천해 드릴게요!' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const newMsgs = [...msgs, { role: 'user', content: text }]
    setMsgs(newMsgs)
    setInput('')
    setLoading(true)
    try {
      const r = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, content: m.content })) })
      })
      const d = await r.json()
      setMsgs(prev => [...prev, { role: 'assistant', content: d?.content?.[0]?.text || '카카오톡으로 문의해 주세요 🙏' }])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: '카카오톡으로 문의해 주세요 🙏' }])
    }
    setLoading(false)
  }

  return (
    <>
      <button className={`ai-btn${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        {open ? '✕ 닫기' : '🎛️ AI 상담하기'}
      </button>
      {open && (
        <div className="ai-box">
          <div className="ai-header">
            <div className="ai-avatar">🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>AI 장비 상담</div>
              <div style={{ color: '#888', fontSize: 11 }}>Extended Studio</div>
            </div>
            <button className="ai-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="ai-msgs">
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                <div className="ai-bubble">{m.content}</div>
              </div>
            ))}
            {loading && <div className="ai-msg bot"><div className="ai-bubble" style={{ color: '#888' }}>답변 작성 중...</div></div>}
          </div>
          <div className="ai-quick">
            {['100명 행사 추천', '야외 행사 장비', '예산 50만원'].map(q => (
              <button key={q} onClick={() => setInput(q)}>{q}</button>
            ))}
          </div>
          <div className="ai-input-row">
            <input className="ai-input" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()} placeholder="장비 문의 입력" />
            <button className="ai-send" onClick={send} disabled={loading}>↑</button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── 포트폴리오 모달 ────────────────────────────────────
function PfModal({ item, onClose }) {
  if (!item) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <img className="modal-img" src={item.img} alt={item.title} />
        <div className="modal-body">
          <div style={{ fontSize: 10, color: $.gold, letterSpacing: '.2em', marginBottom: 8 }}>{item.cat.toUpperCase()}</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: '.06em', marginBottom: 6 }}>{item.title}</h2>
          <p style={{ color: '#888', fontSize: 13 }}>{item.venue}</p>
        </div>
      </div>
    </div>
  )
}

// ─── 포트폴리오 페이지 ──────────────────────────────────
const PF_CATS = ['전체', '브랜드 이벤트', '클럽/파티', '공연', '기업 행사', '야외 이벤트', '야외 페스티벌', '웨딩']

function Portfolio({ setPage }) {
  const [cat, setCat] = useState('전체')
  const [modal, setModal] = useState(null)
  const filtered = cat === '전체' ? data.portfolio : data.portfolio.filter(p => p.cat === cat)

  return (
    <div style={{ background: $.bg, minHeight: '100vh' }}>
      <div className="section">
        <div className="gold-bar" />
        <h1 className="section-title">PORTFOLIO</h1>
        <p className="section-sub">국내 주요 브랜드 및 아티스트와 함께한 현장들</p>
        <div className="pf-tabs">
          {PF_CATS.map(c => <button key={c} className={`tab-btn${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="pf-grid">
          {filtered.map((item, i) => (
            <div key={i} className="pf-card" onClick={() => setModal(item)}>
              <img src={item.img} alt={item.title} loading="lazy" />
              <div className="pf-overlay">
                <div className="pf-cat">{item.cat.toUpperCase()}</div>
                <h3 className="pf-title">{item.title}</h3>
                <p className="pf-venue">{item.venue}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0', borderTop: `1px solid ${$.border}` }}>
          <p style={{ color: '#444', fontSize: 13, marginBottom: 20, letterSpacing: '.06em' }}>YOUR EVENT IS NEXT</p>
          <button className="btn-gold" style={{ fontSize: 16, padding: '14px 48px' }} onClick={() => setPage('booking')}>지금 예약하기</button>
        </div>
      </div>
      {modal && <PfModal item={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// ─── 패키지 페이지 ──────────────────────────────────────
// ─── 장비 카드 컴포넌트 ────────────────────────────────────
function GearCard({ item }) {
  return (
    <div className="gear-card">
      {item.img && <img className="gear-img" src={item.img} alt={item.name} loading="lazy" style={{objectFit:'cover', background:'#111'}} />}
      <div className="gear-body">
        <div className="gear-cat">{item.cat}</div>
        <div className="gear-name">{item.name}</div>
        <div className="gear-sub">{item.sub}</div>
        {item.price > 0 && <div style={{color:'#c8a96e',fontWeight:700,fontSize:14,margin:'8px 0'}}>{item.price.toLocaleString('ko-KR')}원/일</div>}
        {item.spec && <div className="gear-spec">{item.spec}</div>}
        {item.qty && <div className="gear-qty">보유: {item.qty}</div>}
      </div>
    </div>
  )
}

const PKG_CATS = ['전체', 'DJ PACKAGE', 'PA SYSTEM', 'LINE ARRAY']
const RENTAL_TABS = ['패키지', 'DJ 장비', '스피커', '마이크', '콘솔', '액세서리']

function RentalGear({ setPage }) {
  const [catFilter, setCatFilter] = useState('전체')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('패키지')

  const filtered = catFilter === '전체' ? data.packages : data.packages.filter(p => p.cat === catFilter)

  return (
    <div style={{ background: $.bg, minHeight: '100vh' }}>
      <div className="section">
        <div className="gold-bar" />
        <h1 className="section-title">RENTAL GEAR</h1>
        <p className="section-sub">행사 규모에 맞는 최적의 음향 패키지</p>

        {/* 메인 탭 */}
        <div className="section-tabs">
          {RENTAL_TABS.map(t => (
            <button key={t} className={`section-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {/* 패키지 탭 */}
        {tab === '패키지' && <>
        <div className="pf-tabs" style={{ marginBottom: 32 }}>
          {PKG_CATS.map(c => <button key={c} className={`tab-btn${catFilter === c ? ' on' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>)}
        </div>
        <div className="pkg-grid">
          {filtered.map(pkg => (
            <div key={pkg.id} className={`pkg-card${selected === pkg.id ? ' selected' : ''}`}
              onClick={() => setSelected(selected === pkg.id ? null : pkg.id)}>
              {pkg.img ? (
                <img className="pkg-img" src={pkg.img} alt={pkg.name}
                  style={{ objectFit: pkg.cat === 'DJ PACKAGE' ? 'contain' : 'cover', objectPosition: 'center top' }} />
              ) : (
                <div className="pkg-img-placeholder">{CAT_ICON[pkg.cat] || CAT_ICON.default}</div>
              )}
              <div className="pkg-body">
                <div className="pkg-cat">{pkg.cat}</div>
                <div className="pkg-name">{pkg.name}</div>
                <div className="pkg-sub">{pkg.sub}</div>
                <div className="pkg-coverage">{pkg.coverage}</div>
                <ul className="pkg-items">
                  {pkg.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
                <div className="pkg-pricing">
                  {pkg.pricing.map((p, i) => (
                    <div key={i} className="pkg-price-row">
                      <span>{p.l}</span>
                      <span className="price">{p.p}</span>
                    </div>
                  ))}
                </div>
                {pkg.note && <p className="pkg-note">{pkg.note}</p>}
                <button className="btn-gold" style={{ width: '100%', marginTop: 16 }}
                  onClick={e => { e.stopPropagation(); setPage('booking') }}>
                  이 패키지로 예약하기
                </button>
              </div>
            </div>
          ))}
        </div>
        </>}

        {/* DJ 장비 탭 */}
        {tab === 'DJ 장비' && (
          <div className="pkg-grid">
            {data.dj_gear.map(item => <GearCard key={item.id} item={item} />)}
          </div>
        )}

        {/* 스피커 탭 */}
        {tab === '스피커' && (
          <>
            {['라인어레이','라인어레이 서브','액티브 PA','액티브 PA 서브','모니터'].map(cat => {
              const items = data.speakers.filter(s => s.cat === cat)
              if(!items.length) return null
              return (
                <div key={cat} style={{marginBottom: 40}}>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:'#c8a96e',marginBottom:16}}>{cat.toUpperCase()}</div>
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} />)}</div>
                </div>
              )
            })}
          </>
        )}

        {/* 마이크 탭 */}
        {tab === '마이크' && (
          <>
            {['디지털 무선','아날로그 무선','유선 마이크','인이어 모니터'].map(cat => {
              const items = data.mics.filter(m => m.cat === cat)
              if(!items.length) return null
              return (
                <div key={cat} style={{marginBottom: 40}}>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:'#c8a96e',marginBottom:16}}>{cat.toUpperCase()}</div>
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} />)}</div>
                </div>
              )
            })}
          </>
        )}

        {/* 콘솔 탭 */}
        {tab === '콘솔' && (
          <>
            {['아날로그 콘솔','디지털 콘솔','스테이지박스'].map(cat => {
              const items = data.consoles.filter(c => c.cat === cat)
              if(!items.length) return null
              return (
                <div key={cat} style={{marginBottom: 40}}>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:'#c8a96e',marginBottom:16}}>{cat.toUpperCase()}</div>
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} />)}</div>
                </div>
              )
            })}
          </>
        )}

        {/* 액세서리 탭 */}
        {tab === '액세서리' && (
          <div className="pkg-grid">
            {data.accessories.map(item => <GearCard key={item.id} item={item} />)}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── 예약 폼 ────────────────────────────────────────────
const GEAR_GROUPS = [
  { label: 'DJ 패키지', items: [
    { name: 'Special Package', price: 400000 },
    { name: 'DJ FULL SET', price: 1200000 },
  ]},
  { label: 'PA 시스템', items: [
    { name: 'HK AUDIO POLAR 8', price: 560000 },
    { name: 'STUDIOMASTER DIRECT 121K', price: 600000 },
    { name: 'HK AUDIO POLAR 10', price: 800000 },
    { name: 'BIEMA X10', price: 1200000 },
    { name: 'MONTARBO WIND 2200', price: 1600000 },
  ]},
  { label: '라인어레이', items: [
    { name: 'Logic Systems VA SMALL', price: 3600000 },
    { name: 'X-Treme FULL SET', price: 3600000 },
    { name: 'Logic Systems VA MEDIUM', price: 4400000 },
    { name: 'Martin Audio W8LC', price: 7600000 },
    { name: 'Logic Systems VA LARGE', price: 8400000 },
    { name: 'Logic Systems VA MAX', price: 12000000 },
  ]},
  { label: '무선 마이크', items: [
    { name: 'Sennheiser EW-D 핸드마이크', price: 0 },
    { name: 'Sennheiser EW-D 바디팩', price: 0 },
    { name: 'Laycozic 4ch', price: 0 },
  ]},
  { label: '콘솔', items: [
    { name: 'Behringer WING Rack', price: 0 },
    { name: 'Midas M32R', price: 0 },
    { name: 'Allen & Heath QU-32', price: 0 },
    { name: 'Yamaha', price: 0 },
  ]},
]

const won = n => n.toLocaleString('ko-KR') + '원'
const getPrice = name => GEAR_GROUPS.flatMap(g => g.items).find(i => i.name === name)?.price || 0

function Booking({ setPage }) {
  const [form, setForm] = useState({ name: '', phone: '', date: '', dur: '1일', type: '', gear: [], note: '' })
  const [done, setDone] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleGear = g => setForm(f => ({ ...f, gear: f.gear.includes(g) ? f.gear.filter(x => x !== g) : [...f.gear, g] }))
  const totalPrice = form.gear.reduce((sum, g) => sum + getPrice(g), 0)

  const submit = async () => {
    if (!form.name || !form.phone) return alert('이름과 연락처를 입력해주세요')
    // Firebase 저장 (추후 연결)
    setDone(true)
  }

  if (done) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: $.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, color: $.gold, marginBottom: 20 }}>✓</div>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, letterSpacing: '.1em', marginBottom: 14 }}>예약 문의 완료</h2>
        <p style={{ color: '#666', marginBottom: 36, fontSize: 14 }}>빠른 시간 내에 카카오톡 또는 전화로 연락드리겠습니다.</p>
        <button className="btn-ghost" onClick={() => setPage('landing')}>홈으로</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: $.bg, minHeight: '100vh' }}>
      <div className="booking-wrap">
        <div style={{ marginBottom: 44 }}>
          <div className="gold-bar" />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 50, letterSpacing: '.08em', marginBottom: 6 }}>RESERVATION</h1>
          <p style={{ color: '#555', fontSize: 13 }}>장비 예약 문의 — 확인 후 상세 견적을 안내드립니다</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* 이름/연락처 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%),1fr))', gap: 14 }}>
            {[['name','이름 *','홍길동','text'],['phone','연락처 *','010-0000-0000','tel']].map(([k,l,p,t]) => (
              <div key={k}>
                <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>{l}</label>
                <input type={t} className="field" placeholder={p} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {/* 날짜/기간/행사유형 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>행사 날짜 *</label>
              <input type="date" className="field" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>대여 기간</label>
              <select className="field" value={form.dur} onChange={e => set('dur', e.target.value)}>
                {['당일','1일','2일','3일','1주일','1개월 이상'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>행사 유형</label>
              <select className="field" value={form.type} onChange={e => set('type', e.target.value)}>
                {['','브랜드 이벤트','기업 행사','공연/콘서트','클럽/파티','야외 페스티벌','웨딩','기타'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 장비 선택 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 14 }}>관심 장비 선택</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {GEAR_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: 10, letterSpacing: '.15em', color: $.gold, marginBottom: 8 }}>{group.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 6 }}>
                    {group.items.map(({name, price}) => (
                      <div key={name} className={`gear-tag${form.gear.includes(name) ? ' on' : ''}`} onClick={() => toggleGear(name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9 }}>{form.gear.includes(name) ? '◉' : '○'}</span>
                          <span>{name}</span>
                        </div>
                        {price > 0 && <span style={{ fontSize: 10, color: form.gear.includes(name) ? '#000' : '#c8a96e', fontWeight: 700 }}>{won(price)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 요청사항 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>추가 요청사항</label>
            <textarea className="field" rows={4} placeholder="행사 장소, 규모, 특이사항 등을 알려주세요"
              value={form.note} onChange={e => set('note', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {totalPrice > 0 && (
            <div style={{ background: '#111', border: '1px solid #c8a96e', borderRadius: 8, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>선택 장비 예상 금액</div>
                <div style={{ fontSize: 11, color: '#555' }}>* 실제 견적은 담당자 확인 후 안내</div>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#c8a96e', letterSpacing: '.04em' }}>{won(totalPrice)}</div>
            </div>
          )}
          <button className="btn-gold" style={{ width: '100%', padding: '14px', fontSize: 14, letterSpacing: '.1em' }} onClick={submit}>
            예약 문의 보내기
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 랜딩 ───────────────────────────────────────────────
function Landing({ setPage }) {
  return (
    <div style={{ background: $.bg }}>
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <p className="hero-eyebrow">Extended Rental</p>
          <h1 className="hero-title">
            PROFESSIONAL<br />
            <span className="gold">DJ & PA SYSTEM</span><br />
            RENTAL
          </h1>
          <p className="hero-sub">"Better Experience, Extended Life."</p>
          <div className="hero-btns">
            <button className="btn-gold" style={{ fontSize: 14, padding: '13px 36px' }} onClick={() => setPage('rental')}>장비 패키지 보기</button>
            <button className="btn-ghost" style={{ fontSize: 14, padding: '13px 36px' }} onClick={() => setPage('booking')}>예약 문의</button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── 어드민 ─────────────────────────────────────────────
function Admin() {
  return (
    <div style={{ background: $.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: $.muted }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <p>어드민 페이지 준비중</p>
      </div>
    </div>
  )
}

// ─── 네비게이션 ─────────────────────────────────────────
function Nav({ page, setPage }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="logo" onClick={() => setPage('landing')}>
          <span>EXTENDED <span>STUDIO</span></span>
        </div>
        <div className="nav-links">
          <span className={`nav-link${page === 'rental' ? ' active' : ''}`} onClick={() => setPage('rental')}>RENTAL GEAR</span>
          <span className={`nav-link${page === 'portfolio' ? ' active' : ''}`} onClick={() => setPage('portfolio')}>PORTFOLIO</span>
          <button className="btn-booking" onClick={() => setPage('booking')}>장비 예약</button>
          <a className="btn-kakao" href="http://pf.kakao.com/_mANXG/chat" target="_blank" rel="noreferrer">카카오톡</a>
          <span className="nav-link admin" style={{ fontSize: 10, opacity: .4 }} onClick={() => setPage('admin')}>ADMIN</span>
        </div>
      </div>
    </nav>
  )
}

// ─── 앱 루트 ────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('landing')

  // 스와이프 뒤로가기
  const handleTouchStart = e => { window._swipeX = e.touches[0].clientX }
  const handleTouchEnd = e => {
    if (e.changedTouches[0].clientX - window._swipeX > 80) {
      if (page === 'booking') setPage('rental')
      else if (page !== 'landing') setPage('landing')
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Nav page={page} setPage={setPage} />
      {page === 'landing' && <Landing setPage={setPage} />}
      {page === 'rental' && <RentalGear setPage={setPage} />}
      {page === 'portfolio' && <Portfolio setPage={setPage} />}
      {page === 'booking' && <Booking setPage={setPage} />}
      {page === 'admin' && <Admin />}
      <AiChat />
    </div>
  )
}
