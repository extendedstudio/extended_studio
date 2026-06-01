import { useState, useEffect, useRef } from 'react'
import data from './data.json'
import { db, getFcmMessaging, getToken, onMessage, VAPID_KEY } from './firebase'
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore'
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
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, content: m.content })) })
      })
      const d = await r.json()
      const reply = d?.content?.[0]?.text
      if (reply) {
        setMsgs(prev => [...prev, { role: 'assistant', content: reply }])
      } else {
        console.warn('AI chat unexpected response:', d)
        setMsgs(prev => [...prev, { role: 'assistant', content: '죄송해요, 지금 응답이 어려워요. 카카오톡으로 문의해 주세요 🙏' }])
      }
    } catch (err) {
      console.error('AI chat error:', err)
      setMsgs(prev => [...prev, { role: 'assistant', content: '죄송해요, 지금 응답이 어려워요. 카카오톡으로 문의해 주세요 🙏' }])
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
function Lightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const stageRef = useRef(null)
  const dragRef = useRef({ dragging: false, x: 0, y: 0, tx: 0, ty: 0 })
  const pinchRef = useRef({ pinching: false, dist: 0, scale: 1 })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // wheel은 passive 기본값이라 native로 등록
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.0025
      setScale(prev => {
        const next = Math.min(6, Math.max(1, prev * (1 + delta * 4)))
        if (next <= 1.01) { setTx(0); setTy(0) }
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const reset = () => { setScale(1); setTx(0); setTy(0) }

  const handleMouseDown = (e) => {
    if (scale <= 1) return
    e.preventDefault()
    dragRef.current = { dragging: true, x: e.clientX, y: e.clientY, tx, ty }
  }
  const handleMouseMove = (e) => {
    if (!dragRef.current.dragging) return
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x))
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y))
  }
  const handleMouseUp = () => { dragRef.current.dragging = false }

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { pinching: true, dist: Math.hypot(dx, dy), scale }
    } else if (e.touches.length === 1 && scale > 1) {
      dragRef.current = { dragging: true, x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty }
    }
  }
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current.pinching) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const next = Math.min(6, Math.max(1, pinchRef.current.scale * (dist / pinchRef.current.dist)))
      setScale(next)
      if (next <= 1.01) { setTx(0); setTy(0) }
    } else if (e.touches.length === 1 && dragRef.current.dragging) {
      setTx(dragRef.current.tx + (e.touches[0].clientX - dragRef.current.x))
      setTy(dragRef.current.ty + (e.touches[0].clientY - dragRef.current.y))
    }
  }
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current.pinching = false
    if (e.touches.length === 0) dragRef.current.dragging = false
  }

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    if (scale > 1) reset()
    else setScale(2.5)
  }

  return (
    <div className="lightbox" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={stageRef}
        className="lightbox-stage"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div className="lightbox-img-wrap">
          <img
            src={src}
            alt={alt}
            draggable={false}
            onClick={e => e.stopPropagation()}
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: (dragRef.current.dragging || pinchRef.current.pinching) ? 'none' : 'transform .15s ease-out',
              cursor: scale > 1 ? (dragRef.current.dragging ? 'grabbing' : 'grab') : 'zoom-in'
            }}
          />
          <button className="lightbox-close" onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="닫기">×</button>
          {scale > 1.05 && (
            <button className="lightbox-reset" onClick={(e) => { e.stopPropagation(); reset() }} aria-label="원래대로" title="원래 크기로">⟲</button>
          )}
        </div>
      </div>
      <div className="lightbox-hint">
        휠/핀치 줌 · 드래그 이동 · 더블클릭 토글
      </div>
    </div>
  )
}

function GearCard({ item, onBook, inCart }) {
  const [zoom, setZoom] = useState(false)
  return (
    <div className="gear-card">
      {item.img && (
        <img
          className="gear-img"
          src={item.img}
          alt={item.name}
          loading="lazy"
          style={{ objectFit: 'contain', objectPosition: 'center', background: 'transparent', cursor: 'zoom-in' }}
          onClick={() => setZoom(true)}
        />
      )}
      {zoom && <Lightbox src={item.img} alt={item.name} onClose={() => setZoom(false)} />}
      <div className="gear-body">
        <div className="gear-cat">{item.cat}</div>
        <div className="gear-name">{item.name}</div>
        <div className="gear-sub">{item.sub}</div>
        {item.price > 0 && <div style={{color:'#c8a96e',fontWeight:700,fontSize:17,margin:'10px 0'}}>{item.price.toLocaleString('ko-KR')}원/일</div>}
        {item.spec && <div className="gear-spec">{item.spec}</div>}
        {onBook && (
          <button
            className={inCart ? "btn-gold-outline" : "btn-gold"}
            style={{ width: '100%', marginTop: 14, padding: '10px', fontSize: 12, letterSpacing: '.1em' }}
            onClick={e => { e.stopPropagation(); onBook(item) }}
            disabled={inCart}
          >
            {inCart ? '✓ 장바구니 담김' : '+ 예약하기'}
          </button>
        )}
      </div>
    </div>
  )
}

const PKG_CATS = ['전체', 'DJ PACKAGE', 'PA SYSTEM', 'LINE ARRAY']
const RENTAL_TABS = ['패키지', 'DJ 장비', '스피커', '마이크', '콘솔', '액세서리']

function RentalGear({ setPage, addToCart, cartItems, initialTab }) {
  const [catFilter, setCatFilter] = useState('전체')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState(initialTab || '패키지')

  // initialTab이 바뀌면 (홈에서 다른 카테고리 카드 클릭 시) 탭 동기화
  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
      setCatFilter('전체')  // 카테고리 필터도 리셋
      setSelected(null)     // 선택된 패키지도 리셋
    }
  }, [initialTab])
  const [zoomImg, setZoomImg] = useState(null)
  const inCart = (name) => cartItems?.some(c => c.name === name)
  const handleBook = (item) => {
    addToCart(item)
  }

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
                  style={{ objectFit: pkg.cat === 'DJ PACKAGE' ? 'contain' : 'cover', objectPosition: 'center top', cursor: 'zoom-in' }}
                  onClick={e => { e.stopPropagation(); setZoomImg({ src: pkg.img, alt: pkg.name }); }} />
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
                {pkg.blogUrl && (
                  <a href={pkg.blogUrl} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, width: '100%', marginTop: 16, padding: '11px 14px',
                      background: 'transparent', border: '1px solid #2a2a2a',
                      borderRadius: 4, color: '#aaa', fontSize: 12,
                      letterSpacing: '.08em', textDecoration: 'none',
                      transition: 'all .15s ease', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = $.gold; e.currentTarget.style.color = $.gold }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#aaa' }}>
                    📝 설치 사례 / 블로그 보기 →
                  </a>
                )}
                <button
                  className={inCart(pkg.name) ? "btn-gold-outline" : "btn-gold"}
                  style={{ width: '100%', marginTop: pkg.blogUrl ? 8 : 16 }}
                  onClick={e => {
                    e.stopPropagation()
                    handleBook(pkg)
                  }}
                  disabled={inCart(pkg.name)}
                >
                  {inCart(pkg.name) ? '✓ 장바구니 담김' : '이 패키지로 예약하기'}
                </button>
              </div>
            </div>
          ))}
        </div>
        </>}

        {/* DJ 장비 탭 */}
        {tab === 'DJ 장비' && (
          <div className="pkg-grid">
            {data.dj_gear.map(item => <GearCard key={item.id} item={item} onBook={handleBook} inCart={inCart(item.name)} />)}
          </div>
        )}

        {/* 스피커 탭 */}
        {tab === '스피커' && (
          <>
            {['액티브 PA','액티브 PA 서브','라인어레이','라인어레이 서브','모니터'].map(cat => {
              const items = data.speakers.filter(s => s.cat === cat)
              if(!items.length) return null
              return (
                <div key={cat} style={{marginBottom: 40}}>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:'#c8a96e',marginBottom:16}}>{cat.toUpperCase()}</div>
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} onBook={handleBook} inCart={inCart(item.name)} />)}</div>
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
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} onBook={handleBook} inCart={inCart(item.name)} />)}</div>
                </div>
              )
            })}
          </>
        )}

        {/* 콘솔 탭 */}
        {tab === '콘솔' && (
          <>
            {['디지털 콘솔','아날로그 콘솔','스테이지박스'].map(cat => {
              const items = data.consoles.filter(c => c.cat === cat)
              if(!items.length) return null
              return (
                <div key={cat} style={{marginBottom: 40}}>
                  <div style={{fontSize:10,letterSpacing:'.2em',color:'#c8a96e',marginBottom:16}}>{cat.toUpperCase()}</div>
                  <div className="pkg-grid">{items.map(item => <GearCard key={item.id} item={item} onBook={handleBook} inCart={inCart(item.name)} />)}</div>
                </div>
              )
            })}
          </>
        )}

        {/* 액세서리 탭 */}
        {tab === '액세서리' && (
          <div className="pkg-grid">
            {data.accessories.map(item => <GearCard key={item.id} item={item} onBook={handleBook} inCart={inCart(item.name)} />)}
          </div>
        )}

      </div>
      {/* 패키지 이미지 확대 */}
      {zoomImg && <Lightbox src={zoomImg.src} alt={zoomImg.alt} onClose={() => setZoomImg(null)} />}
    </div>
  )
}

// ─── 예약 폼 ────────────────────────────────────────────
// data.json 기반으로 GEAR_GROUPS 자동 생성 (RentalGear와 자동 동기화)
function parsePricingPrice(pricingArr) {
  if (!Array.isArray(pricingArr) || !pricingArr.length) return 0
  const str = pricingArr[0]?.p || ''
  const digits = String(str).replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

function buildGearGroups(d) {
  const groups = []

  // 1) 패키지 (cat별로 그룹화: DJ PACKAGE / PA SYSTEM / LINE ARRAY 등)
  const PKG_LABEL = { 'DJ PACKAGE': 'DJ 패키지', 'PA SYSTEM': 'PA 시스템', 'LINE ARRAY': '라인어레이' }
  const PKG_ORDER = ['DJ 패키지', 'PA 시스템', '라인어레이']
  const pkgGroupMap = {}
  ;(d.packages || []).forEach(p => {
    const label = PKG_LABEL[p.cat] || p.cat || '패키지'
    if (!pkgGroupMap[label]) pkgGroupMap[label] = []
    pkgGroupMap[label].push({ name: p.name, price: parsePricingPrice(p.pricing), img: p.img })
  })
  // 정해진 순서대로 패키지 그룹 추가 (정해진 것 먼저, 나머지는 뒤에)
  PKG_ORDER.forEach(lab => { if (pkgGroupMap[lab]) groups.push({ label: lab, items: pkgGroupMap[lab] }) })
  Object.entries(pkgGroupMap).forEach(([lab, items]) => { if (!PKG_ORDER.includes(lab)) groups.push({ label: lab, items }) })

  // 2) DJ 장비
  const djItems = (d.dj_gear || []).map(g => ({ name: g.name, price: g.price || 0, img: g.img }))
  if (djItems.length) groups.push({ label: 'DJ 장비', items: djItems })

  // 3) 스피커 — 소제목별로 분리 (액티브 PA 먼저)
  const SP_ORDER = ['액티브 PA', '액티브 PA 서브', '라인어레이', '라인어레이 서브', '모니터']
  const SP_LABEL = {
    '액티브 PA': '스피커 · 액티브 PA',
    '액티브 PA 서브': '스피커 · 액티브 PA 서브',
    '라인어레이': '스피커 · 라인어레이',
    '라인어레이 서브': '스피커 · 라인어레이 서브',
    '모니터': '스피커 · 모니터',
  }
  SP_ORDER.forEach(sub => {
    const items = (d.speakers || []).filter(s => s.cat === sub).map(g => ({ name: g.name, price: g.price || 0, img: g.img }))
    if (items.length) groups.push({ label: SP_LABEL[sub] || `스피커 · ${sub}`, items })
  })

  // 4) 나머지 카테고리
  const SECTIONS = [
    { key: 'mics',        label: '마이크' },
    { key: 'consoles',    label: '콘솔' },
    { key: 'accessories', label: '액세서리' },
  ]
  SECTIONS.forEach(({ key, label }) => {
    const items = (d[key] || []).map(g => ({ name: g.name, price: g.price || 0, img: g.img }))
    if (items.length) groups.push({ label, items })
  })

  return groups
}

const GEAR_GROUPS = buildGearGroups(data)

const won = n => n.toLocaleString('ko-KR') + '원'
const getPrice = name => GEAR_GROUPS.flatMap(g => g.items).find(i => i.name === name)?.price || 0
const getGearMeta = name => GEAR_GROUPS.flatMap(g => g.items).find(i => i.name === name) || null

// 시작일~종료일 → 총 일수 (당일 = 1일, 1박2일 = 2일)
function calcDays(startStr, endStr) {
  if (!startStr || !endStr) return 1
  const s = new Date(startStr)
  const e = new Date(endStr)
  if (isNaN(s) || isNaN(e)) return 1
  const diff = Math.round((e - s) / 86400000) + 1
  return diff > 0 ? diff : 1
}

// 일수 → 할인율 (장기 렌탈 할인표)
function calcDiscount(days) {
  if (days >= 60) return { rate: 0.80, label: '2개월 이상 80% 할인' }
  if (days >= 30) return { rate: 0.70, label: '1개월 이상 70% 할인' }
  if (days >= 21) return { rate: 0.60, label: '20박 21일 이상 60% 할인' }
  if (days >= 11) return { rate: 0.50, label: '10박 11일 이상 50% 할인' }
  if (days >= 7)  return { rate: 0.30, label: '6박 7일 이상 30% 할인' }
  if (days >= 4)  return { rate: 0.20, label: '3박 4일 이상 20% 할인' }
  return { rate: 0, label: '' }
}

// 일수 → 표기 문자열 (e.g. "3박 4일", "1일")
function formatDuration(days) {
  if (days <= 1) return '1일'
  return `${days - 1}박 ${days}일`
}

// 오퍼레이터 필수 장비 판별 (무선 마이크 / 디지털·아날로그 콘솔 / 믹서)
// 스테이지박스는 I/O 확장이라 제외
function requiresOperator(item) {
  if (!item) return false
  const sub = (item.sub || '').toLowerCase()
  const name = (item.name || '').toLowerCase()
  if (sub.includes('스테이지박스')) return false
  if (sub.includes('무선')) return true
  if (sub.includes('콘솔') || sub.includes('믹서')) return true
  // 이름으로 fallback (data.json sub가 비어있는 경우)
  if (/(ew-?d|slx|blx|qlx|ulx|wireless)/i.test(name)) return true
  return false
}

const OPERATOR_FEE_REQUIRED = 350000  // 무선/콘솔용 필수 오퍼레이터 일당
const OPERATOR_FEE_OPTIONAL = 400000  // 일반 요청 오퍼레이터 일당
const INSTALL_FEE = 200000  // 전체 설치/철수 비용 (선택)

function Booking({ setPage, cartItems, removeFromCart, clearCart }) {
  const [form, setForm] = useState({ name: '', phone: '', startDate: '', endDate: '', type: '', gear: [], qty: {}, operator: 'no', install: false, note: '' })
  const [done, setDone] = useState(false)

  // 장바구니 → form.gear 동기화
  useEffect(() => {
    if (!cartItems?.length) return
    setForm(f => {
      const names = cartItems.map(c => c.name)
      const missing = names.filter(n => !f.gear.includes(n))
      if (!missing.length) return f
      const newQty = { ...f.qty }
      missing.forEach(n => { if (!newQty[n]) newQty[n] = 1 })
      return { ...f, gear: [...f.gear, ...missing], qty: newQty }
    })
  }, [cartItems])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleGear = g => setForm(f => {
    const has = f.gear.includes(g)
    if (has) {
      const q = { ...f.qty }; delete q[g]
      return { ...f, gear: f.gear.filter(x => x !== g), qty: q }
    }
    return { ...f, gear: [...f.gear, g], qty: { ...f.qty, [g]: 1 } }
  })
  const setQty = (name, n) => setForm(f => ({ ...f, qty: { ...f.qty, [name]: Math.max(1, Math.min(99, n)) } }))

  // 선택한 장비 명세 (form.gear + 카트의 커스텀 아이템 + 수량)
  const selectedItems = (() => {
    const items = []
    form.gear.forEach(name => {
      const meta = getGearMeta(name)
      const qty = form.qty[name] || 1
      if (meta) items.push({ name, price: meta.price || 0, img: meta.img, qty })
      else {
        const c = cartItems.find(c => c.name === name)
        if (c) items.push({ name, price: c.price || 0, img: c.img, qty })
      }
    })
    cartItems.forEach(c => {
      if (!items.some(i => i.name === c.name)) {
        items.push({ name: c.name, price: c.price || 0, img: c.img, qty: form.qty[c.name] || 1 })
      }
    })
    return items
  })()

  const subtotal = selectedItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0)
  const days = calcDays(form.startDate, form.endDate)
  const discount = calcDiscount(days)
  const grossTotal = subtotal * days
  const discountAmount = Math.round(grossTotal * discount.rate)

  // 무선 마이크 / 콘솔 자동 감지 → 필수 오퍼레이터 (락됨)
  const requiredOperatorItems = selectedItems.filter(it => {
    const meta = getGearMeta(it.name)
    return requiresOperator(meta)
  })
  const operatorRequired = requiredOperatorItems.length > 0
  // 효과적 오퍼레이터 상태: 필수면 무조건 'yes', 아니면 사용자 선택
  const effectiveOperator = operatorRequired ? 'yes' : form.operator
  const operatorFeePerDay = operatorRequired ? OPERATOR_FEE_REQUIRED : OPERATOR_FEE_OPTIONAL
  const operatorFee = effectiveOperator === 'yes' ? operatorFeePerDay * days : 0
  const installFee = form.install ? INSTALL_FEE : 0
  const finalPrice = grossTotal - discountAmount + operatorFee + installFee

  const removeCartItem = (name) => {
    removeFromCart(name)
    setForm(f => ({ ...f, gear: f.gear.filter(g => g !== name) }))
  }

  const submit = async () => {
    if (!form.name || !form.phone) return alert('이름과 연락처를 입력해주세요')
    if (!form.startDate) return alert('대여 시작일을 선택해주세요')
    if (!form.endDate) return alert('반납일을 선택해주세요')
    try {
      await addDoc(collection(db, 'requests'), {
        name: form.name,
        phone: form.phone,
        date: form.startDate,       // 호환성 (기존 admin 표시)
        startDate: form.startDate,
        endDate: form.endDate,
        dur: formatDuration(days),  // 호환성
        days,
        type: form.type,
        gear: form.gear,
        qty: form.qty,
        operator: effectiveOperator,
        operatorRequired,
        operatorFee,
        install: form.install,
        installFee,
        note: form.note,
        subtotal,
        discountRate: discount.rate,
        discountLabel: discount.label,
        discountAmount,
        finalPrice,
        status: '신청',
        createdAt: new Date().toISOString(),
        serverTime: serverTimestamp(),
      })
      // 어드민에게 푸시 알림 발송 (실패해도 예약은 정상 처리)
      try {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            date: form.startDate,
            dur: formatDuration(days),
            type: form.type,
            gear: form.gear,
            qty: form.qty,
            operator: form.operator,
            note: form.note,
            finalPrice,
          }),
        }).catch(err => console.warn('알림 발송 실패 (무시됨):', err))
      } catch (_) {}
      clearCart && clearCart()
      setDone(true)
    } catch (e) {
      console.error('예약 저장 실패:', e)
      alert('예약 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.\n\n' + (e?.message || ''))
    }
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
          {/* 장바구니 (선택한 장비 리스트) */}
          {cartItems && cartItems.length > 0 && (
            <div style={{
              background: '#1a1a1a', border: `1px solid ${$.gold}`,
              borderRadius: 10, padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: '.2em', color: $.gold }}>🛒 선택한 장비 · {cartItems.length}개</div>
                <button onClick={() => { clearCart(); setForm(f => ({...f, gear: f.gear.filter(g => !cartItems.some(c => c.name === g))})) }}
                  style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 11, cursor: 'pointer' }}>
                  전체 비우기
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cartItems.map(item => (
                  <div key={item.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    background: '#0e0e0e', borderRadius: 8, padding: '10px 14px'
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '.04em', marginBottom: 2 }}>{item.name}</div>
                      {item.sub && <div style={{ fontSize: 11, color: '#666' }}>{item.sub}</div>}
                    </div>
                    <button onClick={() => removeCartItem(item.name)} style={{
                      background: 'transparent', border: '1px solid #333', color: '#aaa',
                      width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 14, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이름/연락처 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%),1fr))', gap: 14 }}>
            {[['name','이름 *','홍길동','text'],['phone','연락처 *','010-0000-0000','tel']].map(([k,l,p,t]) => (
              <div key={k}>
                <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>{l}</label>
                <input type={t} className="field" placeholder={p} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {/* 날짜 (시작일 ~ 반납일) / 행사유형 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>대여 시작일 *</label>
              <input type="date" className="field" value={form.startDate}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({
                    ...f,
                    startDate: v,
                    // 종료일이 없거나 시작일보다 빠르면 시작일로 자동 보정
                    endDate: (!f.endDate || f.endDate < v) ? v : f.endDate
                  }))
                }} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>반납일 *</label>
              <input type="date" className="field" value={form.endDate}
                min={form.startDate || undefined}
                onChange={e => set('endDate', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>행사 유형</label>
              <select className="field" value={form.type} onChange={e => set('type', e.target.value)}>
                {['','브랜드 이벤트','기업 행사','공연/콘서트','클럽/파티','야외 페스티벌','웨딩','기타'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 기간 자동 표시 */}
          {form.startDate && form.endDate && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: '#0e0e0e', border: '1px solid #222',
              borderRadius: 8, marginTop: -8
            }}>
              <span style={{ fontSize: 11, color: '#888' }}>대여 기간</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '.04em', color: '#fff' }}>
                {formatDuration(days)}
              </span>
              {discount.rate > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, letterSpacing: '.15em',
                  padding: '4px 10px', borderRadius: 4,
                  background: $.gold, color: '#000', fontWeight: 700
                }}>
                  {Math.round(discount.rate * 100)}% OFF
                </span>
              )}
            </div>
          )}

          {/* ─── 견적 요약 (sticky) ─── */}
          {selectedItems.length > 0 && (
            <div style={{
              position: 'sticky', top: 16, zIndex: 20,
              background: 'linear-gradient(180deg, #1c1c1c 0%, #0e0e0e 100%)',
              border: `1px solid ${$.gold}`, borderRadius: 12, padding: '18px 20px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.7)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: '.2em', color: $.gold, fontWeight: 700 }}>
                  견적 요약 · {selectedItems.length}개 장비
                </div>
                {form.startDate && form.endDate && (
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {formatDuration(days)}
                  </div>
                )}
              </div>

              {/* 장비 명세 */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                marginBottom: 14, maxHeight: 200, overflowY: 'auto',
                paddingRight: 4
              }}>
                {selectedItems.map(item => (
                  <div key={item.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    fontSize: 12, color: '#ccc'
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {item.name}
                      {item.qty > 1 && <span style={{ color: $.gold, marginLeft: 6, fontWeight: 700 }}>× {item.qty}</span>}
                    </span>
                    <span style={{ color: '#888', flexShrink: 0 }}>
                      {item.price > 0 ? won(item.price * (item.qty || 1)) : '견적'}
                    </span>
                  </div>
                ))}
              </div>

              {/* 계산 라인 */}
              {subtotal > 0 && (
                <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                    <span>1일 단가 합계</span>
                    <span>{won(subtotal)}</span>
                  </div>
                  {days > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                      <span>× {days}일</span>
                      <span>{won(grossTotal)}</span>
                    </div>
                  )}
                  {discount.rate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: $.gold }}>
                      <span>{discount.label}</span>
                      <span>− {won(discountAmount)}</span>
                    </div>
                  )}
                  {operatorFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: operatorRequired ? $.gold : '#888' }}>
                      <span>오퍼레이터 {operatorRequired ? '(무선/콘솔 필수)' : '(요청)'} × {days}일</span>
                      <span>+ {won(operatorFee)}</span>
                    </div>
                  )}
                  {installFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                      <span>설치 / 철수</span>
                      <span>+ {won(installFee)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, paddingTop: 12, borderTop: '1px solid #2a2a2a'
                  }}>
                    <span style={{ fontSize: 12, color: '#aaa', letterSpacing: '.1em' }}>합계 (VAT 별도)</span>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 28,
                      color: $.gold, letterSpacing: '.04em'
                    }}>{won(finalPrice)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#777', lineHeight: 1.5, marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid #1f1f1f' }}>
                    * 익스텐디드 스텝의 현장 상주 / 오퍼레이팅 비용은 별도입니다. 장비 왕복 배송료와 세팅/철수만 포함됩니다.
                  </div>
                  {/* 예약 문의 버튼 (견적 박스 안) */}
                  <button className="btn-gold"
                    style={{ width: '100%', padding: '14px', fontSize: 14, letterSpacing: '.1em', marginTop: 14 }}
                    onClick={submit}>
                    예약 문의 보내기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 장비 선택 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 14 }}>관심 장비 선택 <span style={{ color: '#444', fontSize: 10 }}>· 클릭해서 추가, 수량 조절 가능</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {GEAR_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: 11, letterSpacing: '.2em', color: $.gold, marginBottom: 12, fontWeight: 700 }}>{group.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 }}>
                    {group.items.map(({name, price, img}) => {
                      const on = form.gear.includes(name)
                      const qty = form.qty[name] || 1
                      const meta = getGearMeta(name)
                      const needsOp = requiresOperator(meta)
                      return (
                        <div key={name}
                          style={{
                            background: on ? 'rgba(200,169,110,0.08)' : '#0e0e0e',
                            border: `1px solid ${on ? $.gold : '#222'}`,
                            borderRadius: 10,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all .15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                          onClick={() => toggleGear(name)}
                        >
                          {/* 이미지 영역 */}
                          <div style={{
                            position: 'relative', width: '100%', aspectRatio: '1.3 / 1',
                            background: '#080808',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {img ? (
                              <img src={img} alt={name} loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
                            ) : (
                              <div style={{ fontSize: 32, color: '#333' }}>♪</div>
                            )}
                            {/* 오퍼레이터 필수 배지 */}
                            {needsOp && (
                              <div style={{
                                position: 'absolute', top: 8, left: 8,
                                background: 'rgba(200,169,110,0.95)', color: '#000',
                                fontSize: 9, letterSpacing: '.1em', fontWeight: 700,
                                padding: '3px 7px', borderRadius: 3
                              }}>OPERATOR 필수</div>
                            )}
                            {/* 선택 뱃지 */}
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              width: 24, height: 24, borderRadius: '50%',
                              background: on ? $.gold : 'rgba(0,0,0,0.6)',
                              border: `2px solid ${on ? $.gold : '#444'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, color: on ? '#000' : '#666', fontWeight: 700,
                            }}>{on ? '✓' : ''}</div>
                          </div>

                          {/* 본문 */}
                          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{
                              fontSize: 13, color: '#eee', fontWeight: 600,
                              lineHeight: 1.3, minHeight: 34,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>{name}</div>
                            {price > 0 && (
                              <div style={{ fontSize: 13, color: $.gold, fontWeight: 700 }}>{won(price)} <span style={{ fontSize: 10, color: '#666', fontWeight: 400 }}>/일</span></div>
                            )}

                            {/* 수량 컨트롤 (선택된 경우만) */}
                            {on && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  marginTop: 6, padding: '6px 4px',
                                  borderTop: '1px solid #2a2a2a'
                                }}>
                                <span style={{ fontSize: 10, color: '#666', letterSpacing: '.1em' }}>수량</span>
                                <button type="button"
                                  onClick={() => setQty(name, qty - 1)}
                                  disabled={qty <= 1}
                                  style={{
                                    width: 28, height: 28, borderRadius: 4,
                                    background: qty <= 1 ? '#1a1a1a' : '#222',
                                    border: '1px solid #333', color: qty <= 1 ? '#444' : '#fff',
                                    cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                                    fontSize: 16, lineHeight: 1, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>−</button>
                                <span style={{
                                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                                  color: '#fff', minWidth: 28, textAlign: 'center'
                                }}>{qty}</span>
                                <button type="button"
                                  onClick={() => setQty(name, qty + 1)}
                                  style={{
                                    width: 28, height: 28, borderRadius: 4,
                                    background: '#222', border: '1px solid #333', color: '#fff',
                                    cursor: 'pointer', fontSize: 16, lineHeight: 1, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>+</button>
                                {price > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 11, color: $.gold, fontWeight: 700 }}>
                                    = {won(price * qty)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 오퍼레이터 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 10 }}>
              오퍼레이터 / 엔지니어
              {operatorRequired && (
                <span style={{ marginLeft: 8, color: $.gold, fontSize: 10, letterSpacing: '.05em' }}>
                  · 무선 마이크/콘솔 선택으로 자동 적용됨
                </span>
              )}
            </label>
            {operatorRequired ? (
              <div style={{
                background: 'rgba(200,169,110,0.08)',
                border: `1px solid ${$.gold}`,
                borderRadius: 8, padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 13, color: $.gold, fontWeight: 700, marginBottom: 4 }}>
                    🎚 오퍼레이터 필수 적용
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    선택하신 {requiredOperatorItems.map(it => it.name).slice(0, 2).join(', ')}
                    {requiredOperatorItems.length > 2 && ` 외 ${requiredOperatorItems.length - 2}개`}
                    {' '}운영을 위해 전문 엔지니어가 동행합니다
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: $.gold, letterSpacing: '.04em' }}>
                    {won(OPERATOR_FEE_REQUIRED)}
                  </div>
                  <div style={{ fontSize: 10, color: '#666' }}>/ 일</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
                {[
                  { v: 'no', label: '필요 없음', sub: '셀프 운영' },
                  { v: 'yes', label: '필요함', sub: `+ 일당 ${won(OPERATOR_FEE_OPTIONAL)} (참고)` },
                  { v: 'consult', label: '협의', sub: '카톡 상의' },
                ].map(opt => {
                  const on = form.operator === opt.v
                  return (
                    <div key={opt.v} onClick={() => set('operator', opt.v)}
                      style={{
                        background: on ? 'rgba(200,169,110,0.08)' : '#0e0e0e',
                        border: `1px solid ${on ? $.gold : '#222'}`,
                        borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                        transition: 'all .15s ease'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: on ? $.gold : '#888' }}>{on ? '◉' : '○'}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginLeft: 24 }}>{opt.sub}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 설치 / 철수 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 10 }}>
              설치 / 철수
              <span style={{ marginLeft: 8, color: '#666', fontSize: 10 }}>· 선택 사항</span>
            </label>
            <div onClick={() => set('install', !form.install)}
              style={{
                background: form.install ? 'rgba(200,169,110,0.08)' : '#0e0e0e',
                border: `1px solid ${form.install ? $.gold : '#222'}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                transition: 'all .15s ease',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: form.install ? $.gold : '#888' }}>{form.install ? '☑' : '☐'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>전체 설치 / 철수 요청</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>장비 운반 + 현장 설치 + 철수</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: form.install ? $.gold : '#888', letterSpacing: '.04em' }}>
                  + {won(INSTALL_FEE)}
                </div>
              </div>
            </div>
          </div>

          {/* 서비스 안내 문구 */}
          <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7, padding: '14px 16px', background: 'rgba(200,169,110,0.04)', borderLeft: `2px solid ${$.gold}`, borderRadius: 4 }}>
            <strong style={{ color: $.gold, letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>📋 서비스 안내</strong>
            익스텐디드 스텝이 현장에서 상주 및 오퍼레이팅하는 비용은 포함되어있지 않습니다. 장비의 왕복 배송료와 세팅 / 철수만 포함되어있는 서비스입니다. 스텝 상주시, 인건비는 별도입니다.
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(200,169,110,0.15)' }}>
              <strong style={{ color: $.gold, fontSize: 10, letterSpacing: '.05em' }}>📦 수령 / 배송</strong><br />
              · <strong style={{ color: '#ccc' }}>직접 수령</strong>: 창고 방문 (고양시 향동)<br />
              · <strong style={{ color: '#ccc' }}>배송</strong>: 퀵비 서울 80,000원 기준 / 그외 지방 별도 시세 협의
            </div>
          </div>

          {/* 요청사항 */}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '.12em', color: '#555', display: 'block', marginBottom: 7 }}>추가 요청사항</label>
            <textarea className="field" rows={4} placeholder="행사 장소, 규모, 특이사항 등을 알려주세요"
              value={form.note} onChange={e => set('note', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {/* 견적 요약이 안 보일 때(장비 미선택)도 예약 보낼 수 있게 폴백 */}
          {selectedItems.length === 0 && (
            <button className="btn-gold" style={{ width: '100%', padding: '14px', fontSize: 14, letterSpacing: '.1em' }} onClick={submit}>
              예약 문의 보내기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 랜딩 ───────────────────────────────────────────────
function Landing({ setPage, goToRental }) {
  // 포트폴리오 미리보기 3개 (data.json에서)
  const portfolioPreview = (data.portfolio || []).slice(0, 6)
  // 카테고리 카드 (tab: 클릭 시 이동할 RentalGear 탭)
  const categories = [
    { label: 'DJ 장비', desc: 'CDJ-3000, DJM-A9, XDJ-XZ', count: data.dj_gear?.length || 0, tab: 'DJ 장비' },
    { label: '라인어레이', desc: 'Martin Audio, Logic Systems', count: 5, tab: '스피커' },
    { label: 'PA 시스템', desc: 'HK Audio, Studiomaster', count: 8, tab: '스피커' },
    { label: '마이크', desc: 'Sennheiser, Shure, Kanals', count: data.mics?.length || 0, tab: '마이크' },
    { label: '믹싱 콘솔', desc: 'Behringer WING, Midas M32', count: data.consoles?.length || 0, tab: '콘솔' },
    { label: '액세서리', desc: 'DJ테이블, 스탠드, 보면대', count: data.accessories?.length || 0, tab: '액세서리' },
  ]

  return (
    <div style={{ background: $.bg }}>
      {/* Hero */}
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

      {/* About 한 줄 */}
      <section className="about-strip">
        <div className="about-inner">
          <div className="about-item">
            <div className="about-num">45+</div>
            <div className="about-label">PROFESSIONAL<br />EQUIPMENT</div>
          </div>
          <div className="about-divider" />
          <div className="about-item">
            <div className="about-num">100%</div>
            <div className="about-label">CUSTOM<br />QUOTE</div>
          </div>
          <div className="about-divider" />
          <div className="about-item">
            <div className="about-num">BY</div>
            <div className="about-label">APPOINTMENT<br />BASED</div>
          </div>
        </div>
      </section>

      {/* 장비 카테고리 */}
      <section className="section-block">
        <div className="section-head">
          <div className="section-bar" />
          <h2 className="section-title">EQUIPMENT</h2>
          <p className="section-sub">최고급 장비로 완벽한 사운드를 제공합니다</p>
        </div>
        <div className="cat-grid">
          {categories.map(c => (
            <div className="cat-card" key={c.label} onClick={() => goToRental(c.tab)}>
              <div className="cat-count">{String(c.count).padStart(2, '0')}</div>
              <div className="cat-label">{c.label}</div>
              <div className="cat-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 포트폴리오 프리뷰 */}
      {portfolioPreview.length > 0 && (
        <section className="section-block">
          <div className="section-head">
            <div className="section-bar" />
            <h2 className="section-title">PORTFOLIO</h2>
            <p className="section-sub">Extended Studio가 함께한 현장</p>
          </div>
          <div className="pf-preview-grid">
            {portfolioPreview.map((p, i) => (
              <div className="pf-preview-card" key={i} onClick={() => setPage('portfolio')}>
                {p.img && <img src={p.img} alt={p.title || ''} loading="lazy" />}
                <div className="pf-preview-overlay">
                  <div className="pf-preview-title">{p.title || p.name || 'Event'}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button className="btn-ghost" onClick={() => setPage('portfolio')} style={{ fontSize: 13, padding: '12px 32px' }}>
              전체 포트폴리오 보기 →
            </button>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-grid" />
        <div className="cta-content">
          <p className="cta-eyebrow">READY FOR YOUR EVENT?</p>
          <h2 className="cta-title">최고의 사운드,<br />지금 예약하세요</h2>
          <p className="cta-sub">행사 규모와 컨셉에 맞춘 맞춤형 견적을 제공합니다</p>
          <div className="cta-btns">
            <button className="btn-gold" style={{ fontSize: 14, padding: '15px 44px' }} onClick={() => setPage('booking')}>장비 예약 문의</button>
            <a className="btn-ghost" style={{ fontSize: 14, padding: '15px 44px', textDecoration: 'none', display: 'inline-block' }}
              href="http://pf.kakao.com/_mANXG/chat" target="_blank" rel="noreferrer">
              카카오톡 상담
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">EXTENDED STUDIO</div>
          <div className="footer-info">
            <div>서울 이태원</div>
            <a href="https://instagram.com/extended_studio" target="_blank" rel="noopener noreferrer" className="footer-ig">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              @extended_studio
            </a>
          </div>
          <div className="footer-copy">© 2026 Extended Studio. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}

// ─── 어드민 ─────────────────────────────────────────────
const ADMIN_PIN = '0903'

function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [requests, setRequests] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 알림 상태: 'unsupported' | 'denied' | 'granted-active' | 'granted-inactive' | 'default'
  const [notifStatus, setNotifStatus] = useState('default')
  const [notifMsg, setNotifMsg] = useState('')
  const [adminTab, setAdminTab] = useState('requests')
  const [chatLogs, setChatLogs] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [adminTab, setAdminTab] = useState('requests')
  const [chatLogs, setChatLogs] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const STATUS = ['신청', '확인중', '확정', '취소']
  const STATUS_COLOR = { '신청': '#f59e0b', '확인중': '#3b82f6', '확정': '#22c55e', '취소': '#ef4444' }

  // 알림 권한 상태 체크
  useEffect(() => {
    if (!authed) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setNotifStatus('denied')
      return
    }
    if (Notification.permission === 'granted') {
      // 토큰이 Firestore에 저장되어 있는지 확인할 수도 있지만, 일단 활성으로 표시
      setNotifStatus('granted-active')
    } else {
      setNotifStatus('default')
    }
  }, [authed])

  // 채팅 로그 실시간 조회
  useEffect(() => {
    if (!authed || adminTab !== 'chat_logs') return
    setChatLoading(true)
    const q = query(collection(db, 'chat_logs'), orderBy('createdAt', 'desc'), limit(200))
    const unsub = onSnapshot(q, snap => {
      setChatLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setChatLoading(false)
    }, err => {
      console.error('채팅 로그 조회 실패:', err)
      setChatLoading(false)
    })
    return () => unsub()
  }, [authed, adminTab])

  // 채팅 로그 실시간 조회
  useEffect(() => {
    if (!authed || adminTab !== 'chat_logs') return
    setChatLoading(true)
    const q = query(collection(db, 'chat_logs'), orderBy('createdAt', 'desc'), limit(200))
    const unsub = onSnapshot(q, snap => {
      setChatLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setChatLoading(false)
    }, err => {
      console.error('채팅 로그 조회 실패:', err)
      setChatLoading(false)
    })
    return () => unsub()
  }, [authed, adminTab])

  // 알림 활성화 + 토큰 발급 + Firestore 저장
  const enableNotifications = async () => {
    try {
      setNotifMsg('권한 요청 중...')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus('denied')
        setNotifMsg('알림이 차단되었습니다. 브라우저 설정에서 허용해주세요.')
        return
      }

      // Service Worker 등록
      setNotifMsg('Service Worker 등록 중...')
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

      // FCM 토큰 받기
      setNotifMsg('FCM 토큰 발급 중...')
      const messaging = await getFcmMessaging()
      if (!messaging) {
        setNotifStatus('unsupported')
        setNotifMsg('이 브라우저는 푸시 알림을 지원하지 않습니다.')
        return
      }
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
      if (!token) {
        setNotifMsg('토큰 발급 실패. 다시 시도해주세요.')
        return
      }

      // Firestore에 토큰 저장 (admin_tokens 컬렉션, 토큰 자체를 ID로 사용해 중복 방지)
      setNotifMsg('토큰 등록 중...')
      await setDoc(doc(db, 'admin_tokens', token), {
        token,
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
      })

      // 포그라운드 메시지 핸들러 (탭이 열려있을 때)
      onMessage(messaging, (payload) => {
        console.log('[FG] Message:', payload)
        new Notification(payload.notification?.title || '새 예약', {
          body: payload.notification?.body || '',
          icon: '/pwa-192.png',
        })
      })

      setNotifStatus('granted-active')
      setNotifMsg('알림이 활성화되었습니다 ✓')
      setTimeout(() => setNotifMsg(''), 3000)
    } catch (e) {
      console.error('enableNotifications error:', e)
      setNotifMsg('오류: ' + (e?.message || e))
    }
  }

  const submitPin = e => {
    e?.preventDefault?.()
    if (pinInput === ADMIN_PIN) {
      sessionStorage.setItem('admin_authed', '1')
      setAuthed(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  const logout = () => {
    sessionStorage.removeItem('admin_authed')
    setAuthed(false)
    setPinInput('')
  }

  useEffect(() => {
    if (!authed) return
    const unsub = onSnapshot(
      collection(db, 'requests'),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setRequests(list)
        setLoading(false)
        setError(null)
      },
      err => {
        console.error('Firestore onSnapshot error:', err)
        setError(err?.message || '데이터를 불러올 수 없습니다 (Firestore 권한/네트워크 확인 필요)')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [authed])

  const updateStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'requests', id), { status })
    } catch (e) {
      console.error('updateStatus error:', e)
      alert('상태 업데이트 실패: ' + (e?.message || ''))
    }
  }

  const deleteRequest = async (id, name) => {
    if (!confirm(`"${name}" 님의 예약을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return
    try {
      await deleteDoc(doc(db, 'requests', id))
      if (selected?.id === id) setSelected(null)
    } catch (e) {
      console.error('deleteRequest error:', e)
      alert('삭제 실패: ' + (e?.message || ''))
    }
  }

  // PIN 입력 화면
  if (!authed) {
    return (
      <section style={{ maxWidth: 420, margin: '0 auto', padding: '120px 24px 80px', minHeight: '70vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: '.1em', marginBottom: 8 }}>ADMIN</h2>
          <p style={{ color: $.muted, fontSize: 13 }}>비밀번호를 입력하세요</p>
        </div>
        <form onSubmit={submitPin}>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pinInput}
            onChange={e => { setPinInput(e.target.value); setPinError(false) }}
            placeholder="••••"
            style={{
              width: '100%', background: '#0f0f0f', border: `1px solid ${pinError ? '#ef4444' : '#2a2a2a'}`,
              borderRadius: 10, padding: '18px 20px', color: '#fff', fontSize: 24, letterSpacing: '.4em',
              textAlign: 'center', outline: 'none', marginBottom: 16, fontFamily: 'inherit'
            }}
          />
          {pinError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>비밀번호가 일치하지 않습니다</div>}
          <button type="submit" className="btn-gold" style={{ width: '100%', padding: '14px' }}>
            확인
          </button>
        </form>
      </section>
    )
  }

  return (
    <div style={{ background: $.bg, minHeight: '100vh', padding: 'clamp(16px,4vw,40px)', fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ width: 40, height: 2, background: $.gold, marginBottom: 16 }} />
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '.08em', marginBottom: 4 }}>ADMIN</h1>
            <p style={{ color: $.muted, fontSize: 13 }}>
            {adminTab === 'requests' ? `예약 신청 관리 · 총 ${requests.length}건` : `AI 상담 로그 · 총 ${chatLogs.length}건`}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setAdminTab('requests')} style={{
              padding: '8px 16px', fontSize: 12, letterSpacing: '.08em',
              background: adminTab === 'requests' ? $.gold : 'transparent',
              color: adminTab === 'requests' ? '#000' : '#888',
              border: `1px solid ${adminTab === 'requests' ? $.gold : '#2a2a2a'}`,
              borderRadius: 4, cursor: 'pointer', fontWeight: 600
            }}>📋 예약 신청</button>
            <button onClick={() => setAdminTab('chat_logs')} style={{
              padding: '8px 16px', fontSize: 12, letterSpacing: '.08em',
              background: adminTab === 'chat_logs' ? $.gold : 'transparent',
              color: adminTab === 'chat_logs' ? '#000' : '#888',
              border: `1px solid ${adminTab === 'chat_logs' ? $.gold : '#2a2a2a'}`,
              borderRadius: 4, cursor: 'pointer', fontWeight: 600
            }}>💬 AI 상담 로그</button>
          </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 알림 활성화 버튼 */}
            {notifStatus === 'unsupported' ? (
              <span style={{ fontSize: 11, color: '#666' }}>📵 알림 미지원</span>
            ) : notifStatus === 'granted-active' ? (
              <span style={{ fontSize: 11, color: '#22c55e', padding: '6px 12px', border: '1px solid #22c55e33', borderRadius: 6 }}>🔔 알림 ON</span>
            ) : notifStatus === 'denied' ? (
              <span style={{ fontSize: 11, color: '#ef4444', padding: '6px 12px', border: '1px solid #ef444433', borderRadius: 6 }}>🔕 알림 차단됨</span>
            ) : (
              <button onClick={enableNotifications} style={{
                background: 'transparent', border: '1px solid #c8a96e', color: '#c8a96e',
                padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                fontFamily: 'inherit', whiteSpace: 'nowrap'
              }}>
                🔔 알림 활성화
              </button>
            )}
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid #333', color: '#aaa',
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              fontFamily: 'inherit', whiteSpace: 'nowrap'
            }}>
              로그아웃
            </button>
          </div>
        </div>
        {notifMsg && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12, color: '#aaa' }}>
            {notifMsg}
          </div>
        )}

        {adminTab === 'requests' && (
        loading ? (
          <div style={{ color: $.muted, textAlign: 'center', padding: 60 }}>불러오는 중...</div>
        ) : error ? (
          <div style={{ background: '#1a0e0e', border: '1px solid #ef4444', borderRadius: 8, padding: 24, color: '#fca5a5' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ 데이터를 불러올 수 없습니다</div>
            <div style={{ fontSize: 13, color: '#aaa', wordBreak: 'break-word' }}>{error}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 12, lineHeight: 1.6 }}>
              해결: Firebase Console → Firestore Database → 규칙(Rules) 탭에서<br />
              <code style={{ background: '#000', padding: '2px 6px', borderRadius: 4, color: '#c8a96e' }}>allow read, write: if true;</code> 로 설정 (테스트용)
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ color: $.muted, textAlign: 'center', padding: 60 }}>신청 내역이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => (
              <div key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)}
                style={{ background: '#111', border: `1px solid ${selected?.id === r.id ? $.gold : '#1e1e1e'}`, borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'border-color .2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selected?.id === r.id ? 16 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: STATUS_COLOR[r.status] || '#666', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#000' }}>{r.status || '신청'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: $.muted }}>
                        {r.phone} · {r.startDate || r.date}
                        {r.endDate && r.endDate !== r.startDate && ` ~ ${r.endDate}`}
                        {' · '}{r.dur || (r.days ? `${r.days}일` : '')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {r.finalPrice > 0 && (
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: $.gold, letterSpacing: '.04em' }}>
                        {won(r.finalPrice)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: $.muted }}>{r.createdAt?.slice(0,10)}</div>
                  </div>
                </div>

                {selected?.id === r.id && (
                  <div>
                    <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 16, marginBottom: 16 }}>
                      {r.type && <div style={{ fontSize: 13, marginBottom: 8 }}>행사유형: <span style={{ color: $.gold }}>{r.type}</span></div>}
                      {r.gear?.length > 0 && (
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          관심 장비: <span style={{ color: '#aaa' }}>{r.gear.join(', ')}</span>
                        </div>
                      )}
                      {r.subtotal > 0 && (
                        <div style={{ fontSize: 13, marginBottom: 8, color: '#aaa' }}>
                          1일 단가 합계: <span style={{ color: '#ddd' }}>{won(r.subtotal)}</span>
                          {r.days > 1 && <> · × {r.days}일 = <span style={{ color: '#ddd' }}>{won(r.subtotal * r.days)}</span></>}
                          {r.discountRate > 0 && (
                            <> · <span style={{ color: $.gold }}>{r.discountLabel}</span> (−{won(r.discountAmount)})</>
                          )}
                        </div>
                      )}
                      {r.note && <div style={{ fontSize: 13, color: '#aaa' }}>메모: {r.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {STATUS.map(st => (
                        <button key={st} onClick={e => { e.stopPropagation(); updateStatus(r.id, st) }}
                          style={{ border: `1px solid ${r.status === st ? STATUS_COLOR[st] : '#333'}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: r.status === st ? STATUS_COLOR[st] : 'transparent', color: r.status === st ? '#000' : '#aaa' }}>
                          {st}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button onClick={e => { e.stopPropagation(); deleteRequest(r.id, r.name) }}
                        style={{ border: '1px solid #ef4444', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="예약 삭제">
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
        )}

        {adminTab === 'chat_logs' && (
          <div style={{ marginTop: 24 }}>
            {chatLoading && <p style={{ color: '#888', fontSize: 13 }}>로그 불러오는 중...</p>}
            {!chatLoading && chatLogs.length === 0 && (
              <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                아직 AI 상담 기록이 없습니다.
              </p>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              {chatLogs.map(log => {
                const date = log.createdAt?.toDate ? log.createdAt.toDate() : null
                const dateStr = date ? `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}` : '...'
                return (
                  <div key={log.id} style={{ background: '#0e0e0e', border: '1px solid #1f1f1f', borderRadius: 6, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: '#666', letterSpacing: '.05em' }}>
                        {dateStr} · 대화 {log.conversationLength || 1}턴
                        {log.outputTokens && ` · 토큰 ${log.inputTokens||0}+${log.outputTokens}`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#ddd', marginBottom: 10, padding: '8px 10px', background: 'rgba(200,169,110,0.06)', borderRadius: 4, borderLeft: `2px solid ${$.gold}` }}>
                      <strong style={{ color: $.gold, fontSize: 10 }}>Q.</strong> {log.question}
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                      <strong style={{ color: '#888', fontSize: 10 }}>A.</strong> {log.answer}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 네비게이션 ─────────────────────────────────────────
function Nav({ page, setPage }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const go = p => { setPage(p); setMenuOpen(false) }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="logo" onClick={() => go('landing')}>
          <span>EXTENDED <span>STUDIO</span></span>
        </div>

        {/* 데스크탑 메뉴 */}
        <div className="nav-links desktop-only">
          <span className={`nav-link${page === 'rental' ? ' active' : ''}`} onClick={() => setPage('rental')}>RENTAL GEAR</span>
          <span className={`nav-link${page === 'portfolio' ? ' active' : ''}`} onClick={() => setPage('portfolio')}>PORTFOLIO</span>
          <button className="btn-booking" onClick={() => setPage('booking')}>장비 예약</button>
          <a className="btn-kakao" href="http://pf.kakao.com/_mANXG/chat" target="_blank" rel="noreferrer">카카오톡</a>
          <span className="nav-link admin" style={{ fontSize: 10, opacity: .4 }} onClick={() => setPage('admin')}>ADMIN</span>
        </div>

        {/* 모바일 햄버거 버튼 */}
        <button className="hamburger mobile-only" onClick={() => setMenuOpen(!menuOpen)} aria-label="menu">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="mobile-menu mobile-only">
          <div className={`mobile-menu-item${page === 'rental' ? ' active' : ''}`} onClick={() => go('rental')}>RENTAL GEAR</div>
          <div className={`mobile-menu-item${page === 'portfolio' ? ' active' : ''}`} onClick={() => go('portfolio')}>PORTFOLIO</div>
          <div className={`mobile-menu-item${page === 'booking' ? ' active' : ''}`} onClick={() => go('booking')}>장비 예약</div>
          <a className="mobile-menu-item kakao" href="http://pf.kakao.com/_mANXG/chat" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>카카오톡 문의</a>
          <div className="mobile-menu-item admin" onClick={() => go('admin')}>ADMIN</div>
        </div>
      )}
    </nav>
  )
}

// ─── 앱 루트 ────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('landing')
  const [rentalTab, setRentalTab] = useState('패키지')
  const [cartItems, setCartItems] = useState([])

  // 카테고리 카드 → rental 페이지로 이동 + 탭 선택
  const goToRental = (tab) => {
    if (tab) setRentalTab(tab)
    setPage('rental')
  }

  const addToCart = (item) => setCartItems(prev =>
    prev.some(p => p.name === item.name) ? prev : [...prev, item]
  )
  const removeFromCart = (name) => setCartItems(prev => prev.filter(p => p.name !== name))
  const clearCart = () => setCartItems([])

  // 뒤로가기 로직
  const goBack = () => {
    if (page === 'booking') setPage('rental')
    else if (page !== 'landing') setPage('landing')
  }

  // 스와이프 뒤로가기 (모바일)
  const handleTouchStart = e => { window._swipeX = e.touches[0].clientX }
  const handleTouchEnd = e => {
    if (e.changedTouches[0].clientX - window._swipeX > 80) goBack()
  }

  // 키보드 단축키: ESC 또는 Backspace (input 안에 있을 때는 제외)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && page !== 'landing') {
        const tag = (e.target.tagName || '').toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Nav page={page} setPage={setPage} />
      {/* 데스크탑 뒤로가기 버튼 (landing 제외) */}
      {page !== 'landing' && (
        <button className="back-btn" onClick={goBack} aria-label="뒤로가기" title="뒤로가기 (ESC)">
          ←
        </button>
      )}
      {page === 'landing' && <Landing setPage={setPage} goToRental={goToRental} />}
      {page === 'rental' && <RentalGear setPage={setPage} addToCart={addToCart} cartItems={cartItems} initialTab={rentalTab} />}
      {page === 'portfolio' && <Portfolio setPage={setPage} />}
      {page === 'booking' && <Booking setPage={setPage} cartItems={cartItems} removeFromCart={removeFromCart} clearCart={clearCart} />}
      {page === 'admin' && <Admin />}
      {/* Floating cart button (rental 페이지에서만 보임, 1개 이상일 때) */}
      {page === 'rental' && cartItems.length > 0 && (
        <button onClick={() => setPage('booking')} className="floating-cart">
          🛒 장바구니 <span className="cart-badge">{cartItems.length}</span>
        </button>
      )}
      <AiChat />
    </div>
  )
}
