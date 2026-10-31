// ─── 어드민: 에이전시 (문의 관리 · 인력 명단 · 스케줄) ─────────────
// Firestore 컬렉션
//   agency_requests : 고객 섭외 문의 (+ assigned 배정 인력, clientFee 청구액, withholding 3.3% 공제 여부)
//   agency_talent   : 인력 명단 (프로필은 비공개 — 관리자 화면에서만 사용)
import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import { AGENCY_ROLES, AGENCY_STATUS, AGENCY_STATUS_COLOR } from './agencyConfig.js'

const WITHHOLDING_RATE = 0.033 // 사업소득 원천징수: 소득세 3% + 지방소득세 0.3%
const won = n => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
const num = v => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0
const roleKo = k => AGENCY_ROLES.find(r => r.key === k)?.ko || k || '-'
const isActive = r => (r.status || '문의') !== '취소'
const todayISO = () => new Date().toISOString().slice(0, 10)

// 행사 일수: 시작일~종료일 포함 (예: 11/1~11/3 → 3일)
const eventDays = r => {
  if (!r.startDate) return 1
  const a = new Date(r.startDate), b = new Date(r.endDate || r.startDate)
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}
// 하루 근무시간: 근무 시작~종료 (자정 넘기면 +24시간)
const workHours = r => {
  if (!r.startTime || !r.endTime) return 0
  const [sh, sm] = r.startTime.split(':').map(Number), [eh, em] = r.endTime.split(':').map(Number)
  let h = (eh * 60 + em - (sh * 60 + sm)) / 60
  if (h <= 0) h += 24
  return Math.round(h * 10) / 10
}
// 기본 지급액 제안: 일당 × 일수, 시급 × 시간 × 일수
const suggestPay = (t, r) => {
  const rate = num(t.rate)
  if (!rate) return 0
  if (t.rateType === '시급') return rate * (workHours(r) || 0) * eventDays(r)
  return rate * eventDays(r)
}
const payFormula = (t, r) => {
  const rate = num(t.rate)
  if (!rate) return '단가 미입력'
  if (t.rateType === '시급') return `시급 ${won(rate)} × ${workHours(r) || 0}시간 × ${eventDays(r)}일`
  return `일당 ${won(rate)} × ${eventDays(r)}일`
}
const overlaps = (a, b) =>
  (a.startDate || '') <= (b.endDate || b.startDate || '') && (b.startDate || '') <= (a.endDate || a.startDate || '')

function downloadCsv(filename, cols, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map(c => esc(c[0])).join(','), ...rows.map(r => cols.map(c => esc(c[1](r))).join(','))].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }) // BOM: 엑셀 한글 깨짐 방지
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
}

const S = {
  pill: on => ({ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontWeight: 600, border: `1px solid ${on ? '#111' : '#e4e4e2'}`, background: on ? '#111' : 'transparent', color: on ? '#fff' : '#555' }),
  btn: { padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #111', background: '#fff', cursor: 'pointer', fontWeight: 600 },
  btnDark: { padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  card: open => ({ border: `1px solid ${open ? '#111' : '#e4e4e2'}`, borderRadius: 12, padding: '16px 20px' }),
  sub: { fontSize: 12, color: '#6f6f6f' },
  section: { borderTop: '1px solid #e4e4e2', marginTop: 14, paddingTop: 14 },
  h: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
}

export default function AgencyAdmin() {
  const [sub, setSub] = useState('requests')
  const [requests, setRequests] = useState([])
  const [talent, setTalent] = useState([])
  const [loading, setLoading] = useState({ r: true, t: true })
  const [error, setError] = useState(null)

  useEffect(() => {
    const onErr = name => err => { console.error(name, err); setError(`${name}: ${err?.message || '불러오기 실패'}`); setLoading({ r: false, t: false }) }
    const u1 = onSnapshot(collection(db, 'agency_requests'), snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setLoading(l => ({ ...l, r: false }))
    }, onErr('agency_requests'))
    const u2 = onSnapshot(collection(db, 'agency_talent'), snap => {
      setTalent(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')))
      setLoading(l => ({ ...l, t: false }))
    }, onErr('agency_talent'))
    return () => { u1(); u2() }
  }, [])

  if (loading.r || loading.t) return <div style={{ color: '#6f6f6f', textAlign: 'center', padding: 60 }}>불러오는 중...</div>
  if (error) return (
    <div style={{ border: '1px solid #ef4444', borderRadius: 8, padding: 24 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ 에이전시 데이터를 불러올 수 없습니다</div>
      <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{error}</div>
      <div style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>Firebase Console → Firestore → 규칙에서 <code>agency_requests</code>, <code>agency_talent</code> 컬렉션 권한을 확인해주세요.</div>
    </div>
  )

  const tabs = [['requests', `📥 문의 관리 ${requests.length}`], ['talent', `👥 인력 명단 ${talent.length}`], ['schedule', '🗓 스케줄']]
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #e4e4e2', paddingBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ ...S.pill(sub === k), padding: '7px 16px', fontSize: 13 }}>{l}</button>)}
      </div>
      {sub === 'requests' && <RequestsPanel requests={requests} talent={talent} />}
      {sub === 'talent' && <TalentPanel talent={talent} requests={requests} />}
      {sub === 'schedule' && <SchedulePanel requests={requests} talent={talent} />}
    </div>
  )
}

// ─── 문의 관리 (+ 인력 배정 · 정산) ───────────────────────
function RequestsPanel({ requests, talent }) {
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('전체')
  const [memoDraft, setMemoDraft] = useState({})

  const update = async (id, patch) => {
    try { await updateDoc(doc(db, 'agency_requests', id), patch) } catch (e) { alert('저장 실패: ' + (e?.message || '')) }
  }
  const remove = async r => {
    if (!confirm(`"${r.company || r.name}" 문의를 삭제할까요?\n\n되돌릴 수 없습니다.`)) return
    try { await deleteDoc(doc(db, 'agency_requests', r.id)) } catch (e) { alert('삭제 실패: ' + (e?.message || '')) }
  }

  const list = filter === '전체' ? requests : requests.filter(r => (r.status || '문의') === filter)

  const exportCsv = () => downloadCsv(`에이전시_문의_${todayISO()}.csv`, [
    ['접수일', r => r.createdAt?.slice(0, 10)], ['상태', r => r.status], ['회사', r => r.company], ['담당자', r => r.name],
    ['연락처', r => r.phone], ['이메일', r => r.email], ['행사명', r => r.eventName], ['행사유형', r => r.eventType],
    ['시작일', r => r.startDate], ['종료일', r => r.endDate], ['근무시간', r => r.startTime && r.endTime ? `${r.startTime}~${r.endTime}` : ''],
    ['장소', r => r.venue], ['요청 인력', r => (r.roleSummary || []).join(' / ')], ['총 요청 인원', r => r.totalHeads],
    ['배정 인력', r => (r.assigned || []).map(a => `${a.name}(${roleKo(a.role)})`).join(' / ')],
    ['청구액', r => num(r.clientFee) || ''], ['인력 지급 합계', r => (r.assigned || []).reduce((s, a) => s + num(a.pay), 0) || ''],
    ['마진', r => num(r.clientFee) ? num(r.clientFee) - (r.assigned || []).reduce((s, a) => s + num(a.pay), 0) : ''],
    ['3.3% 공제', r => r.withholding ? 'O' : ''], ['예산', r => r.budget], ['복장·조건', r => r.dress],
    ['의전 메모', r => r.vipNote], ['요청사항', r => r.note], ['내부 메모', r => r.adminMemo],
  ], list)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {['전체', ...AGENCY_STATUS].map(s => {
          const n = s === '전체' ? requests.length : requests.filter(r => (r.status || '문의') === s).length
          return <button key={s} onClick={() => setFilter(s)} style={S.pill(filter === s)}>{s} {n}</button>
        })}
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} disabled={!list.length} style={S.btn}>⬇ 엑셀(CSV)</button>
      </div>

      {list.length === 0 ? <div style={{ color: '#6f6f6f', textAlign: 'center', padding: 60 }}>에이전시 문의가 없습니다</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(r => {
            const open = openId === r.id
            const st = r.status || '문의'
            const assigned = r.assigned || []
            const row = (k, v) => v ? <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ color: '#6f6f6f', display: 'inline-block', minWidth: 84 }}>{k}</span>{v}</div> : null
            return (
              <div key={r.id} style={S.card(open)}>
                <div onClick={() => setOpenId(open ? null : r.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ background: AGENCY_STATUS_COLOR[st] || '#666', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.company || r.name}{r.eventName && <span style={{ fontWeight: 400, color: '#6f6f6f' }}> · {r.eventName}</span>}</div>
                      <div style={S.sub}>
                        {r.startDate}{r.endDate && r.endDate !== r.startDate && ` ~ ${r.endDate}`}
                        {r.startTime && r.endTime && ` · ${r.startTime}~${r.endTime}`}
                        {` · 배정 ${assigned.length}/${r.totalHeads || 0}명`}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6f6f6f', whiteSpace: 'nowrap' }}>{r.createdAt?.slice(0, 10)}</div>
                </div>

                {open && (
                  <div style={S.section}>
                    {row('담당자', `${r.name || ''}${r.company ? ` (${r.company})` : ''}`)}
                    {row('연락처', r.phone && <a href={`tel:${r.phone.replace(/-/g, '')}`}>{r.phone}</a>)}
                    {row('이메일', r.email && <a href={`mailto:${r.email}`}>{r.email}</a>)}
                    {row('행사 유형', r.eventType)}
                    {row('장소', r.venue)}
                    {row('요청 인력', r.roleSummary?.length ? `${r.roleSummary.join(', ')} (총 ${r.totalHeads}명)` : '')}
                    {row('복장·조건', r.dress)}
                    {row('예산', r.budget)}
                    {row('함께 요청', [r.withRental && '음향·조명 렌탈', r.withDj && 'DJ 섭외'].filter(Boolean).join(', '))}
                    {row('의전 메모', r.vipNote)}
                    {row('요청사항', r.note)}

                    <AssignBox r={r} talent={talent} requests={requests} update={update} />
                    <SettleBox r={r} update={update} />

                    <div style={S.section}>
                      <div style={S.h}>내부 메모 <span style={{ fontWeight: 400, color: '#6f6f6f' }}>· 고객에게 보이지 않음</span></div>
                      <textarea className="field" rows={3} value={memoDraft[r.id] ?? r.adminMemo ?? ''} onChange={e => setMemoDraft(m => ({ ...m, [r.id]: e.target.value }))} />
                      <button onClick={() => update(r.id, { adminMemo: memoDraft[r.id] ?? r.adminMemo ?? '' })} style={{ ...S.btnDark, marginTop: 6 }}>메모 저장</button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
                      {AGENCY_STATUS.map(s => (
                        <button key={s} onClick={() => update(r.id, { status: s })} style={{ border: `1px solid ${st === s ? AGENCY_STATUS_COLOR[s] : '#e4e4e2'}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: st === s ? AGENCY_STATUS_COLOR[s] : 'transparent', color: st === s ? '#fff' : '#9a9a9a' }}>{s}</button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => remove(r)} style={{ border: '1px solid #ef4444', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#ef4444' }}>🗑 삭제</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 인력 배정: 역할별로 명단에서 고르고, 같은 날짜에 다른 행사에 배정된 인력은 경고
function AssignBox({ r, talent, requests, update }) {
  const assigned = r.assigned || []
  const roles = AGENCY_ROLES.filter(role => (r.counts?.[role.key] || 0) > 0 || assigned.some(a => a.role === role.key))
  const conflictsOf = tId => requests.filter(o => o.id !== r.id && isActive(o) && overlaps(o, r) && (o.assigned || []).some(a => a.talentId === tId))

  const add = (roleKey, tId) => {
    const t = talent.find(x => x.id === tId)
    if (!t) return
    const c = conflictsOf(t.id)
    if (c.length && !confirm(`⚠ ${t.name}님은 같은 기간에 이미 배정돼 있습니다.\n\n${c.map(o => `· ${o.company || o.name} ${o.startDate}${o.endDate && o.endDate !== o.startDate ? `~${o.endDate}` : ''}`).join('\n')}\n\n그래도 배정할까요?`)) return
    update(r.id, { assigned: [...assigned, { talentId: t.id, name: t.name, role: roleKey, pay: suggestPay(t, r) }] })
  }
  const removeAt = i => update(r.id, { assigned: assigned.filter((_, j) => j !== i) })
  const setPay = (i, v) => update(r.id, { assigned: assigned.map((a, j) => j === i ? { ...a, pay: num(v) } : a) })

  return (
    <div style={S.section}>
      <div style={S.h}>인력 배정 <span style={{ fontWeight: 400, color: '#6f6f6f' }}>· {assigned.length}/{r.totalHeads || 0}명 · 기간 {eventDays(r)}일{workHours(r) ? ` · 하루 ${workHours(r)}시간` : ''}</span></div>
      {roles.length === 0 && <div style={S.sub}>요청 인력이 없습니다.</div>}
      {roles.map(role => {
        const need = r.counts?.[role.key] || 0
        const mine = assigned.map((a, i) => ({ ...a, i })).filter(a => a.role === role.key)
        const pool = talent.filter(t => t.role === role.key && t.active !== false && !assigned.some(a => a.talentId === t.id))
        return (
          <div key={role.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <b>{role.ko}</b> <span style={{ color: mine.length >= need ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{mine.length}/{need}</span>
            </div>
            {mine.map(a => {
              const t = talent.find(x => x.id === a.talentId) || {}
              const c = conflictsOf(a.talentId)
              return (
                <div key={a.i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', background: '#f7f7f6', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                  <b style={{ minWidth: 64 }}>{a.name}</b>
                  {t.phone && <a href={`tel:${t.phone.replace(/-/g, '')}`} style={{ fontSize: 12 }}>{t.phone}</a>}
                  {c.length > 0 && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⚠ 일정 겹침 {c.length}건</span>}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#6f6f6f' }} title="기본값 계산식">{payFormula(t, r)}</span>
                  <input key={`${a.i}-${a.pay}`} className="field" defaultValue={a.pay || ''} inputMode="numeric" placeholder="지급액"
                    onBlur={e => { if (num(e.target.value) !== num(a.pay)) setPay(a.i, e.target.value) }}
                    style={{ width: 120, padding: '4px 8px', fontSize: 13, textAlign: 'right' }} />
                  <button onClick={() => removeAt(a.i)} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#999', fontSize: 15 }} title="배정 해제">✕</button>
                </div>
              )
            })}
            <select className="field" value="" onChange={e => add(role.key, e.target.value)} style={{ maxWidth: 360, fontSize: 13, padding: '6px 10px' }}>
              <option value="">{pool.length ? `+ ${role.ko} 배정하기` : `명단에 배정 가능한 ${role.ko}가 없습니다`}</option>
              {pool.map(t => {
                const c = conflictsOf(t.id)
                return <option key={t.id} value={t.id}>{t.name}{t.area ? ` · ${t.area}` : ''}{t.rate ? ` · ${t.rateType || '일당'} ${num(t.rate).toLocaleString('ko-KR')}` : ''}{c.length ? ' · ⚠ 일정 겹침' : ''}</option>
              })}
            </select>
          </div>
        )
      })}
    </div>
  )
}

// 정산: 청구액 − 인력 지급 합계 = 마진 / 3.3% 공제 시 실지급액 표시
function SettleBox({ r, update }) {
  const assigned = r.assigned || []
  const paySum = assigned.reduce((s, a) => s + num(a.pay), 0)
  const fee = num(r.clientFee)
  const wh = r.withholding ? Math.round(paySum * WITHHOLDING_RATE) : 0
  const line = (k, v, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '3px 0', fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: strong ? '#111' : '#6f6f6f' }}>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  )
  return (
    <div style={S.section}>
      <div style={S.h}>정산</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}>클라이언트 청구액
          <input key={`fee-${r.clientFee}`} className="field" defaultValue={r.clientFee || ''} inputMode="numeric" placeholder="0"
            onBlur={e => { if (num(e.target.value) !== fee) update(r.id, { clientFee: num(e.target.value) }) }}
            style={{ width: 160, marginLeft: 8, padding: '4px 8px', fontSize: 13, textAlign: 'right', display: 'inline-block' }} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!r.withholding} onChange={e => update(r.id, { withholding: e.target.checked })} /> 인력 지급 시 3.3% 원천징수
        </label>
      </div>
      <div style={{ maxWidth: 460, background: '#f7f7f6', borderRadius: 8, padding: '10px 14px' }}>
        {line('청구액', won(fee))}
        {line(`인력 지급 합계 (${assigned.length}명)`, `− ${won(paySum)}`)}
        {line('마진 = 청구액 − 인력 지급 합계', won(fee - paySum), true)}
        {r.withholding && <>
          <div style={{ borderTop: '1px solid #e4e4e2', margin: '6px 0' }} />
          {line(`원천징수 = ${won(paySum)} × 3.3%`, won(wh))}
          {line('인력 실지급 합계 = 지급 합계 − 원천징수', won(paySum - wh), true)}
        </>}
      </div>
      {fee > 0 && paySum === 0 && <div style={{ ...S.sub, marginTop: 6 }}>배정 인력의 지급액을 입력하면 마진이 계산됩니다.</div>}
    </div>
  )
}

// ─── 인력 명단 ─────────────────────────────────────────
const EMPTY_TALENT = { name: '', role: 'promoter', phone: '', gender: '', height: '', size: '', area: '', career: '', rateType: '일당', rate: '', photoUrl: '', profileUrl: '', memo: '', active: true }

function TalentPanel({ talent, requests }) {
  const [roleFilter, setRoleFilter] = useState('전체')
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | talent id
  const [form, setForm] = useState(EMPTY_TALENT)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const today = todayISO()
  const upcomingOf = tId => requests.filter(r => isActive(r) && (r.endDate || r.startDate || '') >= today && (r.assigned || []).some(a => a.talentId === tId))

  const list = talent.filter(t =>
    (showInactive || t.active !== false) &&
    (roleFilter === '전체' || t.role === roleFilter) &&
    (!q || [t.name, t.area, t.career, t.memo, t.phone].join(' ').toLowerCase().includes(q.toLowerCase())))

  const startNew = () => { setForm(EMPTY_TALENT); setEditing('new') }
  const startEdit = t => { setForm({ ...EMPTY_TALENT, ...t }); setEditing(t.id) }
  const save = async () => {
    if (!form.name.trim()) return alert('이름을 입력해주세요')
    const { id, ...data } = form
    const payload = { ...data, name: data.name.trim(), rate: num(data.rate), updatedAt: new Date().toISOString() }
    try {
      if (editing === 'new') await addDoc(collection(db, 'agency_talent'), { ...payload, createdAt: new Date().toISOString() })
      else await updateDoc(doc(db, 'agency_talent', editing), payload)
      setEditing(null)
    } catch (e) { alert('저장 실패: ' + (e?.message || '')) }
  }
  const remove = async t => {
    const n = upcomingOf(t.id).length
    if (!confirm(`${t.name}님을 명단에서 삭제할까요?${n ? `\n\n⚠ 예정된 행사 ${n}건에 배정돼 있습니다. 삭제 대신 '비활성'을 권장합니다.` : ''}\n\n되돌릴 수 없습니다.`)) return
    try { await deleteDoc(doc(db, 'agency_talent', t.id)); setEditing(null) } catch (e) { alert('삭제 실패: ' + (e?.message || '')) }
  }

  const exportCsv = () => downloadCsv(`에이전시_인력명단_${todayISO()}.csv`, [
    ['이름', t => t.name], ['분야', t => roleKo(t.role)], ['연락처', t => t.phone], ['성별', t => t.gender], ['키', t => t.height],
    ['사이즈', t => t.size], ['활동 지역', t => t.area], ['경력', t => t.career], ['단가 기준', t => t.rateType], ['단가', t => t.rate],
    ['프로필 링크', t => t.profileUrl], ['사진 링크', t => t.photoUrl], ['메모', t => t.memo], ['상태', t => t.active === false ? '비활성' : '활동'],
    ['예정 행사 수', t => upcomingOf(t.id).length],
  ], list)

  const field = (k, l, props = {}) => (
    <div style={{ flex: props.wide ? '1 1 100%' : '1 1 180px' }}>
      <div style={{ fontSize: 12, color: '#6f6f6f', marginBottom: 4 }}>{l}</div>
      {props.textarea
        ? <textarea className="field" rows={2} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={props.placeholder} />
        : <input className="field" value={form[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={props.placeholder} inputMode={props.inputMode} />}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {['전체', ...AGENCY_ROLES.map(r => r.key)].map(k => {
          const n = talent.filter(t => (showInactive || t.active !== false) && (k === '전체' || t.role === k)).length
          return <button key={k} onClick={() => setRoleFilter(k)} style={S.pill(roleFilter === k)}>{k === '전체' ? '전체' : roleKo(k)} {n}</button>
        })}
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} disabled={!list.length} style={S.btn}>⬇ 엑셀(CSV)</button>
        <button onClick={startNew} style={S.btnDark}>+ 인력 등록</button>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="이름 · 지역 · 경력 · 메모 검색" style={{ maxWidth: 320 }} />
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> 비활성 인력 포함
        </label>
      </div>

      <div style={{ fontSize: 11, color: '#6f6f6f', background: '#f7f7f6', borderRadius: 6, padding: '8px 12px', marginBottom: 16, lineHeight: 1.6 }}>
        🔒 이 명단은 관리자 화면에서만 보입니다. 주민등록번호·계좌번호 같은 민감한 정보는 여기에 적지 마세요.
      </div>

      {editing && (
        <div style={{ border: '1px solid #111', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ ...S.h, fontSize: 15 }}>{editing === 'new' ? '인력 등록' : `${form.name} 수정`}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {field('name', '이름 *', { placeholder: '홍길동' })}
            <div style={{ flex: '1 1 180px' }}>
              <div style={{ fontSize: 12, color: '#6f6f6f', marginBottom: 4 }}>분야 *</div>
              <select className="field" value={form.role} onChange={e => set('role', e.target.value)}>
                {AGENCY_ROLES.map(r => <option key={r.key} value={r.key}>{r.ko}</option>)}
              </select>
            </div>
            {field('phone', '연락처', { placeholder: '010-0000-0000', inputMode: 'tel' })}
            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: 12, color: '#6f6f6f', marginBottom: 4 }}>성별</div>
              <select className="field" value={form.gender} onChange={e => set('gender', e.target.value)}>
                {['', '여', '남'].map(g => <option key={g} value={g}>{g || '선택'}</option>)}
              </select>
            </div>
            {field('height', '키 (cm)', { placeholder: '168', inputMode: 'numeric' })}
            {field('size', '사이즈', { placeholder: '상의 S / 신발 240' })}
            {field('area', '활동 지역', { placeholder: '서울 · 경기' })}
            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: 12, color: '#6f6f6f', marginBottom: 4 }}>단가 기준</div>
              <select className="field" value={form.rateType} onChange={e => set('rateType', e.target.value)}>
                {['일당', '시급'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            {field('rate', '단가 (원)', { placeholder: '150000', inputMode: 'numeric' })}
            {field('career', '경력 · 특기', { wide: true, textarea: true, placeholder: '골프 대회 의전 3회, 영어 가능, 팝업 프로모터 경력 등' })}
            {field('profileUrl', '프로필 PDF 링크', { wide: true, placeholder: '구글 드라이브 등 공유 링크 — 고객에게 보낼 PDF' })}
            {field('photoUrl', '사진 링크', { wide: true, placeholder: '사진 공유 링크' })}
            {field('memo', '내부 메모', { wide: true, textarea: true, placeholder: '평가, 주의사항 등' })}
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} /> 활동 중 (해제하면 배정 목록에서 숨김)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} style={S.btnDark}>저장</button>
            <button onClick={() => setEditing(null)} style={S.btn}>취소</button>
            <div style={{ flex: 1 }} />
            {editing !== 'new' && <button onClick={() => remove(form)} style={{ ...S.btn, borderColor: '#ef4444', color: '#ef4444' }}>삭제</button>}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ color: '#6f6f6f', textAlign: 'center', padding: 50 }}>{talent.length ? '조건에 맞는 인력이 없습니다' : '아직 등록된 인력이 없습니다. "+ 인력 등록"으로 시작하세요.'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 10 }}>
          {list.map(t => {
            const up = upcomingOf(t.id)
            return (
              <div key={t.id} onClick={() => startEdit(t)} style={{ border: '1px solid #e4e4e2', borderRadius: 10, padding: 14, cursor: 'pointer', opacity: t.active === false ? .5 : 1, display: 'flex', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f1f1f1', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#999' }}>
                  {t.photoUrl ? <img src={t.photoUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} /> : (t.name || '?').slice(0, 1)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name} <span style={{ fontWeight: 400, fontSize: 12, color: '#6f6f6f' }}>{roleKo(t.role)}{t.active === false ? ' · 비활성' : ''}</span></div>
                  <div style={S.sub}>{[t.gender, t.height && `${t.height}cm`, t.area].filter(Boolean).join(' · ') || '-'}</div>
                  <div style={S.sub}>{t.rate ? `${t.rateType || '일당'} ${won(t.rate)}` : '단가 미입력'}</div>
                  <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {up.length > 0 && <span style={{ color: '#3b82f6', fontWeight: 700 }}>예정 {up.length}건</span>}
                    {t.profileUrl && <a href={t.profileUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>프로필 PDF ↗</a>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 스케줄 ───────────────────────────────────────────
function SchedulePanel({ requests, talent }) {
  const [who, setWho] = useState('')
  const [range, setRange] = useState('upcoming') // upcoming | past
  const today = todayISO()

  const events = useMemo(() => requests
    .filter(r => isActive(r) && r.startDate)
    .filter(r => range === 'upcoming' ? (r.endDate || r.startDate) >= today : (r.endDate || r.startDate) < today)
    .filter(r => !who || (r.assigned || []).some(a => a.talentId === who))
    .sort((a, b) => range === 'upcoming' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)),
  [requests, who, range, today])

  const byMonth = events.reduce((m, r) => { const k = r.startDate.slice(0, 7); (m[k] = m[k] || []).push(r); return m }, {})
  const dow = d => '일월화수목금토'[new Date(d).getDay()]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setRange('upcoming')} style={S.pill(range === 'upcoming')}>예정</button>
        <button onClick={() => setRange('past')} style={S.pill(range === 'past')}>지난 행사</button>
        <div style={{ flex: 1 }} />
        <select className="field" value={who} onChange={e => setWho(e.target.value)} style={{ maxWidth: 240, fontSize: 13, padding: '6px 10px' }}>
          <option value="">전체 인력</option>
          {talent.map(t => <option key={t.id} value={t.id}>{t.name} · {roleKo(t.role)}</option>)}
        </select>
      </div>

      {events.length === 0 ? <div style={{ color: '#6f6f6f', textAlign: 'center', padding: 50 }}>{range === 'upcoming' ? '예정된 행사가 없습니다' : '지난 행사가 없습니다'}</div> : (
        Object.entries(byMonth).map(([month, list]) => (
          <div key={month} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 0', borderBottom: '1px solid #111', marginBottom: 8 }}>{month.replace('-', '년 ')}월 · {list.length}건</div>
            {list.map(r => {
              const assigned = r.assigned || []
              const short = (r.totalHeads || 0) - assigned.length
              const st = r.status || '문의'
              return (
                <div key={r.id} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid #f0f0ef' }}>
                  <div style={{ minWidth: 64, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{Number(r.startDate.slice(8, 10))}</div>
                    <div style={S.sub}>{dow(r.startDate)}{r.endDate && r.endDate !== r.startDate ? ` ~${Number(r.endDate.slice(8, 10))}일` : ''}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: AGENCY_STATUS_COLOR[st], color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{st}</span>
                      <b style={{ fontSize: 14 }}>{r.company || r.name}{r.eventName && ` · ${r.eventName}`}</b>
                      {short > 0 && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>미충원 {short}명</span>}
                    </div>
                    <div style={S.sub}>{[r.startTime && r.endTime && `${r.startTime}~${r.endTime}`, r.venue].filter(Boolean).join(' · ')}</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: '#333' }}>
                      {AGENCY_ROLES.filter(role => (r.counts?.[role.key] || 0) > 0).map(role => {
                        const names = assigned.filter(a => a.role === role.key).map(a => a.name)
                        return <div key={role.key}>{role.ko} {names.length}/{r.counts[role.key]} {names.length > 0 && <span style={{ color: '#6f6f6f' }}>— {names.join(', ')}</span>}</div>
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
