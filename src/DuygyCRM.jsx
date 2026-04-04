import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  gmailSearchMessages,
  gmailGetMessage,
  gmailListLabels,
  gmailModifyThread,
  gmailGetProfile,
  ensureCrmLabels,
} from './useGmail'

// ── SABİTLER ──────────────────────────────────────────────────
const MY_EMAIL   = 'duygu@cambly.com'
const CACHE_KEY  = 'duygu_crm_v5_data'
const CACHE_VER  = 5

const ALL_STAGES = [
  'reached_out','follow_up_1','follow_up_2','needs_reply',
  'interested','referral_received',
  'processing_meeting','meeting_scheduled','meeting_held','reschedule',
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor','spam',
]

const STAGE_META = {
  reached_out:        { label: 'Reached Out',         color: '#6B7280' },
  follow_up_1:        { label: '1. Follow Up',         color: '#8B5CF6' },
  follow_up_2:        { label: '2. Follow Up',         color: '#7C3AED' },
  needs_reply:        { label: 'Needs Reply',          color: '#F59E0B' },
  interested:         { label: 'Interested',           color: '#0EA5E9' },
  referral_received:  { label: 'Referral Received',    color: '#14B8A6' },
  processing_meeting: { label: 'Processing - Meeting', color: '#3B82F6' },
  meeting_scheduled:  { label: 'Meeting Scheduled',    color: '#10B981' },
  meeting_held:       { label: 'Meeting Held',         color: '#059669' },
  reschedule:         { label: 'Reschedule',           color: '#F97316' },
  no_answer:          { label: 'No Answer',            color: '#9CA3AF' },
  not_interested:     { label: 'Not Interested',       color: '#EF4444' },
  bounce:             { label: 'Bounce',               color: '#DC2626' },
  wrong_person:       { label: 'Wrong Person',         color: '#991B1B' },
  out_of_office:      { label: 'Out Of Office',        color: '#6366F1' },
  competitor:         { label: 'Competitor',           color: '#DB2777' },
  spam:               { label: 'Spam / Reklam',       color: '#78716C' },
}

// Excel stage → sistem stage eşleştirmesi
const EXCEL_STAGE_MAP = {
  'no answer':                       'no_answer',
  'meeting held':                    'meeting_held',
  'meeting scheduled':               'meeting_scheduled',
  'competitor':                      'competitor',
  'ooo':                             'out_of_office',
  'interested':                      'interested',
  'referral received':               'referral_received',
  'not interested':                  'not_interested',
  'not interested (existing vendor)':'not_interested',
  'not interested (not on agenda)':  'not_interested',
  'not interested (wants f2f)':      'not_interested',
  'not interested (not in yearly plan)': 'not_interested',
}

const PIPELINE_STAGES = ALL_STAGES
const KPI = { meetings: 156, pipeline: 3100000 }
const TABS = ['Dashboard', 'Pipeline', 'Daily', 'Companies', 'Performans']

// ── FİLTRELENECEK DOMAİNLER (sistem/araç mailleri) ──────────
const IGNORED_DOMAINS = [
  'cambly.com',
  // Google sistem
  'google.com', 'googlemail.com', 'gmail.com',
  // Araçlar & platformlar
  'mixmax.com', 'vercel.com', 'github.com', 'linkedin.com',
  'hubspot.com', 'salesforce.com', 'slack.com',
  'notion.so', 'figma.com', 'zoom.us',
  'theofficialboard.com',
  // SaaS / newsletter / bildirim
  'superhuman.com', 'instapage.com', 'intercom.io', 'intercom-mail.com',
  'mailchimp.com', 'sendgrid.net', 'amazonses.com',
  'smartlead.ai', 'instantly.ai', 'apollo.io', 'outreach.io',
  'calendly.com', 'loom.com', 'grammarly.com', 'canva.com',
  'claude.ai', 'anthropic.com',
]

// noreply/no-reply/notification/info/welcome gibi sistem adresleri
const IGNORED_PREFIXES = [
  'noreply', 'no-reply', 'no_reply',
  'notifications', 'notification',
  'mailer-daemon', 'postmaster',
  'info@', 'welcome@', 'hello@',
  'support@', 'team@', 'news@', 'newsletter@',
  'onboarding@', 'updates@', 'alert@', 'alerts@',
  'ship@', 'calendar-notification@', 'meetings-noreply@',
]

const isIgnoredEmail = (email) => {
  if (!email) return true
  const domain = getDomain(email)
  const local = email.split('@')[0]
  // Domain eşleşmesi (alt domain dahil)
  if (IGNORED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return true
  // Prefix eşleşmesi (noreply, notifications, vb.)
  if (IGNORED_PREFIXES.some(p => p.includes('@') ? email.startsWith(p) : local.includes(p))) return true
  return false
}

// ── V5 RENK SABİTLERİ ───────────────────────────────────────
const C = {
  bg: '#FAF4EB', bg2: '#F5EFE6', white: '#FFFFFF',
  border: '#E4DBD3', text: '#050500', muted: '#888',
}

// ── YARDIMCILAR ───────────────────────────────────────────────
const hdr = (headers, name) => {
  const h = headers?.find(h => h.name === name)
  return h ? h.value : ''
}

const getDomain = email => {
  const m = email?.match(/@([\w.-]+)/)
  return m ? m[1].toLowerCase() : ''
}

const companyName = domain =>
  domain ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1) : ''

const daysSince = d => {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

const fmtDate = d => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'2-digit' })
}

const initials = name =>
  (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

const stageFromLabels = (labelIds, labelToStage) => {
  if (!labelIds || !labelToStage) return null
  for (const id of labelIds) {
    if (labelToStage[id]) return labelToStage[id]
  }
  return null
}

const classifyContact = (c) => {
  const s = (c.snippet || '').toLowerCase()
  const sub = (c.subject || '').toLowerCase()
  const hasSent = c.sentCount > 0
  const hasReply = c.receivedCount > 0
  const daysSinceSent = businessDaysSince(c.lastSent)
  const daysSinceReply = businessDaysSince(c.lastReceived)

  if (s.includes('mailer-daemon') || s.includes('postmaster') ||
      sub.includes('delivery status') || sub.includes('undeliverable') ||
      sub.includes('mail delivery failed') || sub.includes('returned mail'))
    return 'bounce'

  if (sub.includes('out of office') || sub.includes('otomatik yanıt') ||
      sub.includes('automatic reply') || sub.includes('dışarıda') ||
      sub.includes('izinde') || s.includes('out of office') ||
      s.includes('otomatik yanıt'))
    return 'out_of_office'

  if (hasReply && (s.includes('yanlış kişi') || s.includes('ben değilim') ||
      s.includes('sorumlu değil') || s.includes('başka birine yönlendiriyorum')))
    return 'wrong_person'

  if (hasReply && (s.includes('ilgilenmiyoruz') || s.includes('ilgilenmiyorum') ||
      s.includes('ihtiyacımız yok') || s.includes('gündemimizde değil') ||
      s.includes('şu an için değil') || s.includes('not interested')))
    return 'not_interested'

  if (hasReply && (s.includes('babbel') || s.includes('duolingo') || s.includes('rosetta') ||
      s.includes('başka bir platform') || s.includes('farklı bir çözüm')))
    return 'competitor'

  if (hasReply && (s.includes('reschedule') || s.includes('ertelemek') ||
      s.includes('ertelememiz') || s.includes('başka bir güne')))
    return 'reschedule'

  if (s.includes('toplantı oluşturdum') || s.includes('davetiye gönderdim') ||
      s.includes('davetiyesini paylaştı') || s.includes('için toplantı oluşturd') ||
      (s.includes('saat') && s.includes('için') && s.includes('oluşturdum')))
    return 'meeting_scheduled'

  if (hasReply && (s.includes('müsaitlik') || s.includes('müsait misiniz') ||
      s.includes('hangi gün') || s.includes('uygun olur mu') ||
      s.includes('ne zaman uygun') || s.includes('saat kaçta') ||
      s.includes('takvim')))
    return 'processing_meeting'

  if (hasReply && hasSent && new Date(c.lastReceived) > new Date(c.lastSent))
    return 'needs_reply'

  if (c.sentCount >= 3 || s.includes('birkaç kez ulaşmaya çalıştım') ||
      s.includes('doğrudan konuya gelmek') || s.includes('son bir not'))
    return 'follow_up_2'

  if (c.sentCount === 2 || s.includes('farklı bir açıdan tekrar') ||
      s.includes('tekrar ulaşmak istedim'))
    return 'follow_up_1'

  if (hasSent && !hasReply) {
    if (daysSinceSent >= 5) return 'no_answer'
    return 'reached_out'
  }

  return 'reached_out'
}

// ── DB API helpers ───────────────────────────────────────────
const dbSaveContacts = async (contacts) => {
  try {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts }),
    })
  } catch (e) { console.warn('DB contacts save hatası:', e) }
}

const dbLoadContacts = async () => {
  try {
    const res = await fetch('/api/contacts')
    if (!res.ok) return null
    const rows = await res.json()
    return rows.map(r => ({
      email: r.email, domain: r.domain, company: r.company, name: r.name,
      stage: r.stage, sentCount: r.sent_count, receivedCount: r.received_count,
      lastSent: r.last_sent, lastReceived: r.last_received,
      firstContact: r.first_contact, lastContact: r.last_contact,
      subject: r.subject, snippet: r.snippet,
      threadId: r.thread_id, messageCount: r.message_count,
    }))
  } catch (e) { console.warn('DB contacts load hatası:', e); return null }
}

const dbSaveNotes = async (domain, notes) => {
  try {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, notes }),
    })
  } catch (e) { console.warn('DB notes save hatası:', e) }
}

const dbLoadNotes = async () => {
  try {
    const res = await fetch('/api/notes')
    if (!res.ok) return {}
    return await res.json()
  } catch (e) { return {} }
}

const dbSaveLabelMap = async (labelMap) => {
  try {
    await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelMap }),
    })
  } catch (e) { console.warn('DB labels save hatası:', e) }
}

const dbLoadLabelMap = async () => {
  try {
    const res = await fetch('/api/labels')
    if (!res.ok) return null
    const map = await res.json()
    return Object.keys(map).length ? map : null
  } catch (e) { return null }
}

// ── CACHE (localStorage fallback) ────────────────────────────
const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d.version !== CACHE_VER) return null
    return d
  } catch { return null }
}

const saveCache = data =>
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, version: CACHE_VER, savedAt: Date.now() }))

// ── İŞ GÜNÜ HESAPLAMA ────────────────────────────────────────
function businessDaysSince(dateStr) {
  if (!dateStr) return 999
  const start = new Date(dateStr)
  const now = new Date()
  if (start > now) return 0
  let count = 0
  const d = new Date(start)
  d.setHours(0,0,0,0)
  const today = new Date(now)
  today.setHours(0,0,0,0)
  while (d < today) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++ // Pzt-Cuma
  }
  return count
}

// ── TARİH FİLTRE YARDIMCISI ──────────────────────────────────
function getDateRange(period, startDate, endDate) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (period === 'Tümü') return { from: null, to: null }

  if (period === 'Bugün') return { from: todayStart, to: now }

  if (period === 'Bu Hafta') {
    const dow = todayStart.getDay()
    const monday = new Date(todayStart)
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1))
    return { from: monday, to: now }
  }

  if (period === 'Bu Ay') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: monthStart, to: now }
  }

  if (period === 'Özel Aralık' && startDate && endDate) {
    const endOfDay = new Date(endDate + 'T23:59:59')
    return { from: new Date(startDate), to: endOfDay }
  }

  return { from: null, to: null }
}

function filterByDate(items, period, startDate, endDate, dateField = 'lastContact') {
  const { from, to } = getDateRange(period, startDate, endDate)
  if (!from && !to) return items
  return items.filter(item => {
    const d = item[dateField] ? new Date(item[dateField]) : null
    if (!d) return false
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

// ═══════════════ V5 SHARED COMPONENTS ═══════════════

function Dropdown({ title, info, btn, onBtnClick, onClose }) {
  return (
    <div style={{ position: 'absolute', top: 40, right: 0, width: 240, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.07)', zIndex: 200 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>{info}</div>
      <button onClick={onBtnClick} style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: 'none', background: C.text, color: C.white, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{btn}</button>
    </div>
  )
}

function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, ...style }}>{children}</div>
}

function CardHeader({ title, right }) {
  return (
    <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
      {right}
    </div>
  )
}

function Badge({ children, color }) {
  const colors = {
    blue: { bg: '#E6F1FB', text: '#185FA5' }, green: { bg: '#E1F5EE', text: '#0F6E56' },
    amber: { bg: '#FAEEDA', text: '#854F0B' }, red: { bg: '#FCEBEB', text: '#A32D2D' },
    gray: { bg: C.bg2, text: C.muted }, purple: { bg: '#EEEDFE', text: '#534AB7' },
  }
  const c = colors[color] || colors.gray
  return <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>{children}</span>
}

function FilterBar({ filters, active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {filters.map(f => (
        <button key={f} onClick={() => onSelect(f)} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${active === f ? C.text : C.border}`, background: active === f ? C.text : C.white, color: active === f ? C.white : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{f}</button>
      ))}
    </div>
  )
}

function DateFilter({ period, onPeriodChange, startDate, endDate, onStartChange, onEndChange }) {
  const presets = ['Bugün', 'Bu Hafta', 'Bu Ay', 'Tümü', 'Özel Aralık']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
      {presets.map(p => (
        <button key={p} onClick={() => onPeriodChange(p)} style={{
          padding: '5px 14px', borderRadius: 6,
          border: `1px solid ${period === p ? C.text : C.border}`,
          background: period === p ? C.text : C.white,
          color: period === p ? C.white : C.muted,
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
        }}>{p}</button>
      ))}
      {period === 'Özel Aralık' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }} />
          <span style={{ fontSize: 11, color: C.muted }}>—</span>
          <input type="date" value={endDate} onChange={e => onEndChange(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }} />
        </div>
      )}
    </div>
  )
}

function FUCard({ title, subtitle, items, total, color, urgent }) {
  return (
    <Card>
      <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</span>
          {subtitle && <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{subtitle}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {urgent && <Badge color="red">Acil</Badge>}
          <Badge color={color}>{total}</Badge>
        </div>
      </div>
      <div style={{ padding: '6px 0' }}>
        {items.slice(0, 5).map((item, i) => (
          <div key={i} style={{ padding: '7px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{item.company}</span>
              <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 6 }}>{item.count} Kişi</span>
            </div>
            <span style={{ fontSize: 10.5, color: C.muted }}>{item.date}</span>
          </div>
        ))}
        {total > items.length && (
          <div style={{ padding: '6px 16px', fontSize: 10.5, color: C.muted }}>+{total - items.length} şirket daha...</div>
        )}
      </div>
    </Card>
  )
}

function StagePill({ stage, small }) {
  const meta = STAGE_META[stage] || { label: stage, color: '#9CA3AF' }
  return (
    <span style={{
      fontSize: small ? 10 : 11, padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 20, background: meta.color + '20', color: meta.color,
      fontWeight: 500, whiteSpace: 'nowrap',
    }}>{meta.label}</span>
  )
}

// ═══════════════ SORTABLE TABLE ═══════════════

function useSortable(defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)
  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sortFn = (data, getters) => {
    if (!sortKey || !getters[sortKey]) return data
    const getter = getters[sortKey]
    return [...data].sort((a, b) => {
      let va = getter(a), vb = getter(b)
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      if (va instanceof Date && vb instanceof Date) return sortDir === 'asc' ? va - vb : vb - va
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }
  return { sortKey, sortDir, toggle, sortFn }
}

function SortTh({ label, sortKey, currentKey, currentDir, onToggle }) {
  const active = currentKey === sortKey
  return (
    <th
      style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.muted, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => onToggle(sortKey)}
    >
      {label} <span style={{ fontSize: 10, color: active ? C.text : '#ccc', marginLeft: 2 }}>
        {active ? (currentDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}

// ═══════════════ ANA UYGULAMA ═══════════════

export default function DuygyCRM({ token, onLogout }) {
  const [tab, setTab]               = useState('Dashboard')
  const [contacts, setContacts]     = useState([])
  const [companies, setCompanies]   = useState({})
  const [loading, setLoading]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [statusMsg, setStatusMsg]   = useState('')
  const [lastSync, setLastSync]     = useState(null)
  const [searchQ, setSearchQ]       = useState('')
  const [selCompanies, setSelCompanies] = useState(new Set())
  const [notes, setNotes]           = useState({})
  const [labelMap, setLabelMap]     = useState(null)
  const [gmailDd, setGmailDd]      = useState(false)
  const [linkedinDd, setLinkedinDd] = useState(false)

  // İlk yükleme — önce DB, yoksa localStorage fallback
  useEffect(() => {
    const groupByCompany = (ctcts) => {
      const m = {}
      ctcts.forEach(c => {
        const key = (c.company || c.domain).toLowerCase()
        if (!m[key]) {
          m[key] = { domain: c.domain, name: c.company || c.domain, contacts: [], stage: c.stage, lastContact: c.lastContact, domains: new Set() }
        }
        m[key].contacts.push(c)
        m[key].domains.add(c.domain)
        if (new Date(c.lastContact) > new Date(m[key].lastContact)) {
          m[key].lastContact = c.lastContact
          m[key].stage = c.stage
        }
      })
      Object.values(m).forEach(co => { co.domain = [...co.domains].join(', '); delete co.domains })
      return m
    }

    ;(async () => {
      setStatusMsg('Veriler yükleniyor...')

      const [dbContacts, dbNotes, dbLabels] = await Promise.all([
        dbLoadContacts(),
        dbLoadNotes(),
        dbLoadLabelMap(),
      ])

      if (dbContacts && dbContacts.length > 0) {
        // Sistem/araç maillerini filtrele
        const cleanContacts = dbContacts.filter(c => !isIgnoredEmail(c.email))
        if (cleanContacts.length < dbContacts.length) {
          console.log(`Filtrelendi: ${dbContacts.length - cleanContacts.length} sistem maili silindi`)
        }
        const dbC = cleanContacts
        // contacts_info + companies_info'dan domain→company haritası oluştur
        try {
          const [infoRows, compInfoRows] = await Promise.all([
            fetch('/api/contacts-info').then(r => r.json()).catch(() => []),
            fetch('/api/companies-info').then(r => r.json()).catch(() => []),
          ])
          const domainToCompany = {}
          infoRows.forEach(r => {
            if (r.email && r.company) {
              const d = getDomain(r.email)
              if (d) domainToCompany[d] = r.company
            }
          })
          compInfoRows.forEach(r => {
            if (r.name && r.website) {
              const m = r.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
              if (m) domainToCompany[m.toLowerCase()] = r.name
            }
          })
          // DB'den gelen kişilerin şirket adlarını düzelt
          const infoMap = {}
          infoRows.forEach(r => { if (r.email) infoMap[r.email.toLowerCase()] = r })
          let fixed = 0
          dbC.forEach(c => {
            const info = infoMap[c.email]
            if (info) {
              if (info.company && c.company !== info.company) {
                c.company = info.company
                fixed++
              }
              if (info.name) c.name = info.name
              // Excel pipeline_stage → sistem stage eşleştirmesi
              if (info.pipeline_stage) {
                const mapped = EXCEL_STAGE_MAP[info.pipeline_stage.toLowerCase()]
                if (mapped && c.stage !== mapped) { c.stage = mapped; fixed++ }
              }
            } else if (domainToCompany[c.domain] && c.company !== domainToCompany[c.domain]) {
              c.company = domainToCompany[c.domain]
              fixed++
            }
          })
          if (fixed > 0) {
            dbSaveContacts(dbC)
          }
        } catch (e) { /* eşleşme hatası — devam */ }

        const comps = groupByCompany(dbC)
        setContacts(dbC)
        setCompanies(comps)
        setNotes(dbNotes || {})
        if (dbLabels) setLabelMap(dbLabels)
        setLastSync(Date.now())
        setStatusMsg(`DB: ${dbC.length} kişi`)
        saveCache({ contacts: dbC, companies: comps, notes: dbNotes || {}, labelMap: dbLabels })
        return
      }

      const cache = loadCache()
      if (cache?.contacts?.length) {
        setContacts(cache.contacts)
        setCompanies(cache.companies || {})
        setNotes(cache.notes || {})
        if (cache.labelMap) setLabelMap(cache.labelMap)
        setLastSync(cache.savedAt)
        setStatusMsg(`Cache: ${cache.contacts.length} kişi`)
      } else {
        setStatusMsg('Tam Tarama yap →')
      }
    })()
  }, [])

  const buildData = useCallback((messages, labelWriteQueue = [], stageToLabelId = {}, labelIdToStage = {}) => {
    const contactMap = {}

    messages.forEach(msg => {
      const headers = msg.payload?.headers || []
      const from    = hdr(headers, 'From').toLowerCase()
      const to      = hdr(headers, 'To').toLowerCase()
      const subject = hdr(headers, 'Subject')
      const date    = hdr(headers, 'Date')
      const snippet = msg.snippet || ''
      const labels  = msg.labelIds || []
      const cc      = hdr(headers, 'Cc').toLowerCase()
      const isSent  = from.includes(MY_EMAIL.toLowerCase())

      let contactEmails = []
      if (isSent) {
        contactEmails = to.split(/[,;]/)
          .map(e => e.trim().replace(/.*<(.+)>.*/, '$1').trim().toLowerCase())
          .filter(e => e && !isIgnoredEmail(e))
      } else {
        const fromEmail = from.replace(/.*<(.+)>.*/, '$1').trim().toLowerCase()
        if (fromEmail && !isIgnoredEmail(fromEmail)) {
          contactEmails = [fromEmail]
        }
      }

      if (!contactEmails.length) return

      contactEmails.forEach(email => {
        const key = email.toLowerCase()
        const domain = getDomain(key)
        if (!domain) return

        if (!contactMap[key]) {
          contactMap[key] = {
            email: key, domain,
            company: companyName(domain),
            name: extractName(snippet, isSent ? to : from),
            sentCount: 0, receivedCount: 0,
            lastSent: null, lastReceived: null,
            firstContact: date, lastContact: date,
            subject, snippet: snippet.slice(0, 150),
            threadId: msg.threadId, messageCount: 0,
            labels: [],
          }
        }

        const c = contactMap[key]
        c.messageCount++
        c.labels.push(...labels)

        if (isSent) {
          c.sentCount++
          if (!c.lastSent || new Date(date) > new Date(c.lastSent)) c.lastSent = date
        } else {
          c.receivedCount++
          if (!c.lastReceived || new Date(date) > new Date(c.lastReceived)) c.lastReceived = date
        }

        if (new Date(date) > new Date(c.lastContact)) {
          c.lastContact = date
          c.subject = subject
          c.snippet = snippet.slice(0, 150)
        }
        if (new Date(date) < new Date(c.firstContact)) {
          c.firstContact = date
        }
      })
    })

    return Object.values(contactMap).map(c => {
      const uniqueLabels = [...new Set(c.labels)]
      const fromLabel = stageFromLabels(uniqueLabels, labelIdToStage)

      let stage
      if (fromLabel) {
        stage = fromLabel
      } else {
        stage = classifyContact(c)
      }

      if (!fromLabel && c.threadId && stageToLabelId[stage]) {
        labelWriteQueue.push({ threadId: c.threadId, labelId: stageToLabelId[stage] })
      }

      delete c.labels
      return { ...c, stage }
    })
  }, [])

  const buildCompanies = useCallback((ctcts) => {
    const m = {}
    ctcts.forEach(c => {
      const key = (c.company || c.domain).toLowerCase()
      if (!m[key]) {
        m[key] = { domain: c.domain, name: c.company || c.domain, contacts: [], stage: c.stage, lastContact: c.lastContact, domains: new Set() }
      }
      m[key].contacts.push(c)
      m[key].domains.add(c.domain)
      if (new Date(c.lastContact) > new Date(m[key].lastContact)) {
        m[key].lastContact = c.lastContact
        m[key].stage = c.stage
      }
    })
    Object.values(m).forEach(co => {
      co.domain = [...co.domains].join(', ')
      delete co.domains
    })
    return m
  }, [])

  const fetchMessagesBatched = useCallback(async (token, ids, onProgress) => {
    const BATCH_SIZE = 20
    const DELAY_MS = 200
    const results = []
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE)
      const batch = await Promise.all(
        chunk.map(m => gmailGetMessage(token, m.id).catch(() => null))
      )
      results.push(...batch.filter(Boolean))
      if (onProgress) onProgress(results.length)
      if (i + BATCH_SIZE < ids.length) {
        await new Promise(r => setTimeout(r, DELAY_MS))
      }
    }
    return results
  }, [])

  // TAM TARAMA
  const fullScan = useCallback(async () => {
    setLoading(true)
    setProgress(5)
    setStatusMsg('Gmail etiketleri hazırlanıyor...')
    try {
      const stageToLabelId = await ensureCrmLabels(token, ALL_STAGES)
      const labelIdToStage = Object.fromEntries(
        Object.entries(stageToLabelId).map(([stage, id]) => [id, stage])
      )
      setLabelMap(stageToLabelId)
      setProgress(10)

      const sentIds = []
      const receivedIds = []
      let pageToken = null

      setStatusMsg('Gönderilen mailler listeleniyor...')
      do {
        const res = await gmailSearchMessages(token, `from:${MY_EMAIL}`, 500, pageToken)
        sentIds.push(...(res.messages || []))
        pageToken = res.nextPageToken
      } while (pageToken)
      setProgress(15)
      setStatusMsg(`${sentIds.length} gönderilen mesaj bulundu...`)

      setStatusMsg('Gelen yanıtlar listeleniyor...')
      pageToken = null
      do {
        const res = await gmailSearchMessages(token, `to:${MY_EMAIL} -from:${MY_EMAIL} -from:*@cambly.com`, 500, pageToken)
        receivedIds.push(...(res.messages || []))
        pageToken = res.nextPageToken
      } while (pageToken)
      setProgress(20)

      const totalIds = sentIds.length + receivedIds.length
      setStatusMsg(`${totalIds} mesaj bulundu, detaylar çekiliyor...`)

      const allMsgs = []
      const sentMsgs = await fetchMessagesBatched(token, sentIds, (count) => {
        setProgress(20 + Math.floor((count / totalIds) * 50))
        setStatusMsg(`${count}/${totalIds} mesaj işlendi...`)
      })
      allMsgs.push(...sentMsgs)

      const receivedMsgs = await fetchMessagesBatched(token, receivedIds, (count) => {
        setProgress(20 + Math.floor(((sentMsgs.length + count) / totalIds) * 50))
        setStatusMsg(`${sentMsgs.length + count}/${totalIds} mesaj işlendi...`)
      })
      allMsgs.push(...receivedMsgs)

      setProgress(80)
      setStatusMsg('Veriler işleniyor...')

      const labelWriteQueue = []
      const ctcts = buildData(allMsgs, labelWriteQueue, stageToLabelId, labelIdToStage)

      try {
        // 1) contacts_info'dan email → kişi bilgisi haritası
        const infoRows = await fetch('/api/contacts-info').then(r => r.json())
        const infoMap = {}
        const domainToCompany = {} // domain → şirket adı haritası
        infoRows.forEach(r => {
          if (r.email) {
            infoMap[r.email.toLowerCase()] = r
            // Domain → company haritası oluştur (contacts_info'daki şirket adlarından)
            if (r.company) {
              const d = getDomain(r.email)
              if (d) domainToCompany[d] = r.company
            }
          }
        })

        // 2) companies_info'dan da domain → şirket adı haritası (website alanından)
        try {
          const compInfoRows = await fetch('/api/companies-info').then(r => r.json())
          compInfoRows.forEach(r => {
            if (r.name && r.website) {
              // Website URL'den domain çıkar
              const m = r.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
              if (m) domainToCompany[m.toLowerCase()] = r.name
            }
          })
        } catch (e) { /* companies_info yoksa devam */ }

        // 3) Her Gmail kişisini eşleştir
        ctcts.forEach(c => {
          const info = infoMap[c.email]
          if (info) {
            // Tam email eşleşmesi — en güvenilir
            if (info.name) c.name = info.name
            if (info.company) c.company = info.company
            // Excel'deki pipeline_stage varsa ve eşleşiyorsa kullan
            if (info.pipeline_stage) {
              const mapped = EXCEL_STAGE_MAP[info.pipeline_stage.toLowerCase()]
              if (mapped) c.stage = mapped
            }
          } else if (domainToCompany[c.domain]) {
            // Email eşleşmesi yok ama domain eşleşmesi var
            c.company = domainToCompany[c.domain]
          }
        })
      } catch (e) { /* contacts_info yoksa devam */ }

      const comps = buildCompanies(ctcts)

      setContacts(ctcts)
      setCompanies(comps)
      setLastSync(Date.now())

      saveCache({ contacts: ctcts, companies: comps, notes, labelMap: stageToLabelId })
      dbSaveContacts(ctcts)
      dbSaveLabelMap(stageToLabelId)
      setProgress(90)

      if (labelWriteQueue.length > 0) {
        const allCrmLabelIds = Object.values(stageToLabelId)
        let written = 0
        const uniqueQueue = labelWriteQueue.filter((item, idx, arr) =>
          arr.findIndex(x => x.threadId === item.threadId) === idx
        )
        setStatusMsg(`Gmail'e ${uniqueQueue.length} etiket yazılıyor...`)
        for (let i = 0; i < uniqueQueue.length; i++) {
          const { threadId, labelId } = uniqueQueue[i]
          try {
            await gmailModifyThread(token, threadId, [labelId], allCrmLabelIds.filter(id => id !== labelId))
            written++
          } catch (e) { /* sessizce devam */ }
          if (i % 10 === 9) {
            await new Promise(r => setTimeout(r, 300))
            setStatusMsg(`${written}/${uniqueQueue.length} etiket yazıldı...`)
          }
        }
        setStatusMsg(`✓ ${ctcts.length} kişi — ${written} etiket yazıldı`)
      } else {
        setStatusMsg(`✓ ${ctcts.length} kişi, ${Object.keys(comps).length} şirket`)
      }
      setProgress(100)
    } catch (err) {
      if (err.message === 'TOKEN_EXPIRED') onLogout()
      else setStatusMsg('Hata: ' + err.message)
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }, [token, buildData, buildCompanies, fetchMessagesBatched, notes, onLogout])

  // DELTA SYNC
  const deltaSync = useCallback(async () => {
    setLoading(true)
    setStatusMsg('Sync ediliyor...')
    try {
      const after = Math.floor((Date.now() - 48 * 3600000) / 1000)
      const res   = await gmailSearchMessages(token, `from:${MY_EMAIL} after:${after}`, 100)
      const ids   = res.messages || []
      if (!ids.length) { setStatusMsg('✓ Yeni mesaj yok'); return }

      const msgs  = await Promise.all(ids.map(m => gmailGetMessage(token, m.id).catch(() => null)))
      const newC  = buildData(msgs.filter(Boolean))

      setContacts(prev => {
        const map = {}
        prev.forEach(c => { map[c.email] = c })
        newC.forEach(c => { map[c.email] = c })
        const updated = Object.values(map)
        const comps   = buildCompanies(updated)
        setCompanies(comps)
        saveCache({ contacts: updated, companies: comps, notes })
        dbSaveContacts(newC)
        return updated
      })
      setLastSync(Date.now())
      setStatusMsg(`✓ ${ids.length} mesaj senkronize edildi`)
    } catch (err) {
      if (err.message === 'TOKEN_EXPIRED') onLogout()
      else setStatusMsg('Hata: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [token, buildData, buildCompanies, notes, onLogout])

  const changeStage = useCallback(async (email, newStage) => {
    const contact = contacts.find(c => c.email === email)
    if (!contact) return

    setContacts(prev => {
      const updated = prev.map(c => c.email === email ? { ...c, stage: newStage } : c)
      const comps   = buildCompanies(updated)
      setCompanies(comps)
      saveCache({ contacts: updated, companies: comps, notes })
      const updatedContact = updated.find(c => c.email === email)
      if (updatedContact) dbSaveContacts([updatedContact])
      return updated
    })

    if (contact.threadId && labelMap) {
      const newLabelId = labelMap[newStage]
      const allCrmLabelIds = Object.values(labelMap)
      try {
        await gmailModifyThread(
          token, contact.threadId,
          newLabelId ? [newLabelId] : [],
          allCrmLabelIds.filter(id => id !== newLabelId)
        )
      } catch (e) { console.warn('Gmail güncelleme hatası:', e.message) }
    }
  }, [contacts, token, buildCompanies, notes, labelMap])

  const updateContactInfo = useCallback((email, updates) => {
    setContacts(prev => {
      const updated = prev.map(c => c.email === email ? { ...c, ...updates } : c)
      const comps = buildCompanies(updated)
      setCompanies(comps)
      saveCache({ contacts: updated, companies: comps, notes })
      return updated
    })
  }, [buildCompanies, notes])

  // Stats
  const stats = {
    total:     contacts.length,
    meetings:  contacts.filter(c => c.stage === 'meeting_held').length,
    scheduled: contacts.filter(c => c.stage === 'meeting_scheduled').length,
    active:    contacts.filter(c => ['reached_out','follow_up_1','follow_up_2','processing_meeting'].includes(c.stage)).length,
    reply:     contacts.filter(c => c.stage === 'needs_reply').length,
  }

  const weeklyC  = contacts.filter(c => businessDaysSince(c.lastContact) <= 5)
  const overdue  = contacts.filter(c => ['follow_up_1','follow_up_2'].includes(c.stage) && businessDaysSince(c.lastContact) >= 2)
  const filtered = contacts.filter(c => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.email.includes(q) || c.company?.toLowerCase().includes(q)
  })

  const syncInfo = lastSync
    ? `Son Tarama: ${new Date(lastSync).toLocaleDateString('tr-TR')} · ${contacts.length} Kişi`
    : (statusMsg || 'Henüz tarama yapılmadı')

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 54, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>Duygu CRM</span>
          <nav style={{ display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: tab === t ? C.bg2 : 'transparent', color: tab === t ? C.text : C.muted, fontWeight: tab === t ? 500 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
          {statusMsg && <span style={{ fontSize: 11, color: C.muted, padding: '3px 8px', background: C.bg2, borderRadius: 20, marginRight: 4 }}>{statusMsg}</span>}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setGmailDd(!gmailDd); setLinkedinDd(false) }} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✉</button>
            {gmailDd && <Dropdown title="Gmail Tarama" info={syncInfo} btn={loading ? 'Taranıyor...' : 'Tam Tarama Başlat'} onBtnClick={() => { fullScan(); setGmailDd(false) }} onClose={() => setGmailDd(false)} />}
          </div>
          <button onClick={deltaSync} disabled={loading} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Hızlı Sync">↻</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setLinkedinDd(!linkedinDd); setGmailDd(false) }} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>in</button>
            {linkedinDd && <Dropdown title="LinkedIn Extension" info="Manuel Import · 4 Adımlı Workflow" btn="LinkedIn Aktar" onBtnClick={() => setLinkedinDd(false)} onClose={() => setLinkedinDd(false)} />}
          </div>
          <button onClick={onLogout} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Çıkış">⏻</button>
        </div>
      </header>

      {(gmailDd || linkedinDd) && <div onClick={() => { setGmailDd(false); setLinkedinDd(false) }} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}

      {/* PROGRESS */}
      {progress > 0 && (
        <div style={{ height: 3, background: C.border }}>
          <div style={{ height: '100%', background: C.text, width: progress + '%', transition: 'width 0.3s' }} />
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>
        {tab === 'Dashboard'  && <DashboardPage contacts={contacts} stats={stats} weeklyC={weeklyC} overdue={overdue} updateContactInfo={updateContactInfo} changeStage={changeStage} onNavigate={setTab} />}
        {tab === 'Pipeline'   && <PipelinePage contacts={filtered} searchQ={searchQ} setSearchQ={setSearchQ} changeStage={changeStage} updateContactInfo={updateContactInfo} />}
        {tab === 'Daily'      && <DailyPage contacts={contacts} overdue={overdue} />}
        {tab === 'Companies'  && <CompaniesPage companies={companies} selCompanies={selCompanies} setSelCompanies={setSelCompanies} notes={notes} setNotes={setNotes} changeStage={changeStage} updateContactInfo={updateContactInfo} />}
        {tab === 'Performans' && <PerformansPage contacts={contacts} stats={stats} />}
      </main>
    </div>
  )
}

// ═══════════════ DASHBOARD ═══════════════

function DashboardPage({ contacts, stats, weeklyC, overdue: rawOverdue, updateContactInfo, changeStage, onNavigate }) {
  const [tasks, setTasks] = useState([
    { id: 1, t: 'Gmail tara & etiketle', d: false },
    { id: 2, t: 'Personalized Outbound', d: false },
    { id: 3, t: 'Smartlead Kampanyasını Gözlemle', d: false },
    { id: 4, t: "LinkedIn'de 25 Bağlantı İsteği Gönder", d: false },
    { id: 5, t: 'LinkedIn Mesajları', d: false },
    { id: 6, t: 'KPI Tracker Güncelle', d: false },
  ])
  const [copied, setCopied] = useState(false)
  const [period, setPeriod] = useState('Bu Hafta')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const [detailEmail, setDetailEmail] = useState(null)
  const [detailCompany, setDetailCompany] = useState(null)
  const { sortKey, sortDir, toggle, sortFn } = useSortable('days', 'desc')

  const fc = useMemo(() => filterByDate(contacts, period, startDate, endDate), [contacts, period, startDate, endDate])
  const filteredOverdue = useMemo(() => filterByDate(rawOverdue, period, startDate, endDate), [rawOverdue, period, startDate, endDate])

  const overdueGetters = {
    name: c => c.name, company: c => c.company, stage: c => c.stage,
    date: c => new Date(c.lastContact), days: c => businessDaysSince(c.lastContact),
  }
  const overdue = sortFn(filteredOverdue, overdueGetters)

  const done = tasks.filter(t => t.d).length

  const filteredStats = {
    total: fc.length,
    meetings: fc.filter(c => c.stage === 'meeting_held').length,
    scheduled: fc.filter(c => c.stage === 'meeting_scheduled').length,
    active: fc.filter(c => ['reached_out','follow_up_1','follow_up_2','processing_meeting'].includes(c.stage)).length,
    reply: fc.filter(c => c.stage === 'needs_reply').length,
  }
  const filteredWeekly = fc.filter(c => businessDaysSince(c.lastContact) <= 5)

  const statItems = [
    { l: 'Toplam Kişi', v: filteredStats.total },
    { l: 'Bu Hafta Aktif', v: filteredWeekly.length },
    { l: 'Meeting Held', v: filteredStats.meetings },
    { l: 'Scheduled', v: filteredStats.scheduled },
    { l: 'Yanıt Bekliyor', v: filteredStats.reply },
  ]

  const hubspot = ['Dönüş Alan Mail:', 'Yan Hak Paketleri:', 'Geçmiş Şirketler (Partner Kontrolü):', 'Title & LinkedIn:', 'Sustainable Reports:', 'Org Chart (HR Yapısı):']

  const dow = new Date().getDay()

  return (
    <>
      <DateFilter period={period} onPeriodChange={setPeriod} startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />

      {/* Haftalık Skor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: C.border, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {statItems.map((s, i) => (
          <div key={i} style={{ background: C.white, padding: '18px 16px 14px' }}>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* 3 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Checklist */}
        <Card>
          <CardHeader title="Günlük Görevler" right={<Badge color="gray">{done}/{tasks.length}</Badge>} />
          <div style={{ padding: '4px 0' }}>
            {tasks.map(t => (
              <div key={t.id} onClick={() => setTasks(p => p.map(x => x.id === t.id ? { ...x, d: !x.d } : x))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer' }}>
                <div style={{ width: 15, height: 15, borderRadius: 4, border: t.d ? 'none' : `1.5px solid ${C.border}`, background: t.d ? C.text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.d && <span style={{ color: C.white, fontSize: 9, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: t.d ? C.muted : C.text, textDecoration: t.d ? 'line-through' : 'none' }}>{t.t}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* HubSpot */}
        <Card>
          <CardHeader title="HubSpot Toplantı Notu" right={
            <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }} style={{ fontSize: 10.5, color: copied ? '#0F6E56' : C.muted, background: copied ? '#E1F5EE' : C.bg2, padding: '2px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
              {copied ? 'Kopyalandı ✓' : 'Kopyala'}
            </button>
          } />
          <div style={{ padding: '8px 16px 12px' }}>
            {hubspot.map((f, i) => (
              <div key={i} style={{ fontSize: 11.5, padding: '5px 0', borderBottom: i < hubspot.length - 1 ? `1px solid ${C.bg2}` : 'none' }}>{f}</div>
            ))}
          </div>
        </Card>

        {/* Unutma */}
        <Card>
          <CardHeader title="Unutma" />
          <div style={{ padding: '8px 16px 10px' }}>
            {[
              { day: 'PAZARTESİ', task: 'Weekly TR-SDR Sync', sub: "KPI Tracker'ı Doldurmayı Unutma" },
              { day: 'ÇARŞAMBA', task: 'Mid-Week Check-in', sub: 'Kampanyalar Nasıl Gidiyor' },
            ].map((r, i) => (
              <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${C.bg2}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.muted, background: C.bg2, padding: '1px 6px', borderRadius: 3, letterSpacing: '0.5px' }}>{r.day}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{r.task}</span>
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{r.sub}</div>
              </div>
            ))}
            {['HubSpot\'a Meeting Notlarını Gir', 'Partner Listesini Kontrol Et', 'Smartlead Sonuçlarını Takip Et'].map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: C.muted, padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 7, color: C.border }}>●</span>{r}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Gecikmiş Follow-Up */}
      {overdue.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Gecikmiş Follow-Up" right={<Badge color="red">Acil — {overdue.length}</Badge>} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[['name','Kişi'],['company','Şirket'],['stage','Stage'],['date','Son İletişim'],['days','Gün']].map(([k,l]) =>
                  <SortTh key={k} label={l} sortKey={k} currentKey={sortKey} currentDir={sortDir} onToggle={toggle} />
                )}
              </tr>
            </thead>
            <tbody>
              {overdue.slice(0, 8).map(c => (
                <tr key={c.email} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                  <td style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => setDetailEmail(c.email)}>
                    <div style={{ fontWeight: 500, fontSize: 12.5, color: '#3B82F6' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#3B82F6', cursor: 'pointer' }} onClick={() => setDetailCompany(c.company)}>{c.company}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <select style={{ fontSize: 11, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }} value={c.stage} onChange={e => changeStage(c.email, e.target.value)}>
                      {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.muted }}>{fmtDate(c.lastContact)}</td>
                  <td style={{ padding: '10px 14px', color: '#EF4444', fontWeight: 500, fontSize: 12 }}>{businessDaysSince(c.lastContact)} iş g.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Performans Özet */}
      <Card style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>Performans Özet</span>
          <span style={{ fontSize: 11.5, color: C.muted }}>{period}: {filteredStats.total} Kişi · {filteredStats.meetings} Meeting · {filteredStats.reply} Yanıt Bekliyor</span>
        </div>
        <span onClick={() => onNavigate('Performans')} style={{ fontSize: 11, color: C.muted, textDecoration: 'underline', cursor: 'pointer' }}>Detay →</span>
      </Card>

      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
      {detailCompany && <CompanyDetailModal companyName={detailCompany} onClose={() => setDetailCompany(null)} />}
    </>
  )
}

// ═══════════════ PIPELINE ═══════════════

function PipelinePage({ contacts, searchQ, setSearchQ, changeStage, updateContactInfo }) {
  const [channel, setChannel] = useState('Email')
  const [period, setPeriod] = useState('Tümü')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const [selectedStage, setSelectedStage] = useState(null)
  const [detailEmail, setDetailEmail] = useState(null)
  const [showLimit, setShowLimit] = useState(20)

  // Tarih filtresi
  const fc = useMemo(() => filterByDate(contacts, period, startDate, endDate), [contacts, period, startDate, endDate])

  // Stage'leri grupla — şirket bazlı sayım
  const stageGroups = PIPELINE_STAGES.map(stage => {
    const sc = fc.filter(c => c.stage === stage)
    const meta = STAGE_META[stage]
    // Şirket bazlı unique sayım
    const companySet = new Set(sc.map(c => (c.company || c.domain).toLowerCase()))
    return { key: stage, name: meta.label, count: sc.length, companyCount: companySet.size, contacts: sc, color: meta.color }
  })

  const activeStage = selectedStage !== null ? stageGroups.find(s => s.key === selectedStage) : null

  return (
    <>
      <DateFilter period={period} onPeriodChange={(p) => { setPeriod(p); setSelectedStage(null); setShowLimit(20) }} startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />

      {/* Kanal Filtresi + Arama */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <FilterBar filters={['Email', 'LinkedIn', 'Smartlead']} active={channel} onSelect={(v) => { setChannel(v); setSelectedStage(null) }} />
        <input style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', background: C.white, outline: 'none', color: C.text, width: 220 }} placeholder="Kişi, şirket ara..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
      </div>

      {/* Stage Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {stageGroups.map((s) => {
          const isSelected = selectedStage === s.key
          return (
            <div key={s.key} onClick={() => { setSelectedStage(isSelected ? null : s.key); setShowLimit(20) }} style={{
              background: C.white, borderRadius: 10,
              border: `1.5px solid ${isSelected ? C.text : C.border}`,
              cursor: 'pointer', padding: '16px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'border-color 0.12s'
            }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = C.muted }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: s.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: s.companyCount > 0 ? C.text : C.muted }}>{s.companyCount}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{s.count} kişi</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Seçilen Stage'in Kişileri */}
      {activeStage && activeStage.contacts.length > 0 && (
        <Card>
          <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{activeStage.name}</span>
              <Badge color="gray">{activeStage.companyCount} Şirket · {activeStage.count} Kişi</Badge>
            </div>
            <button onClick={() => setSelectedStage(null)} style={{ background: 'none', border: 'none', fontSize: 16, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Ad Soyad', 'Şirket', 'E-Posta', 'Son İletişim', 'Stage'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeStage.contacts.slice(0, showLimit).map((c) => (
                <tr key={c.email} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                  <td style={{ padding: '10px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', color: '#3B82F6' }} onClick={() => setDetailEmail(c.email)}>{c.name}</td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: C.muted }}>{c.company}</td>
                  <td style={{ padding: '10px 18px', fontSize: 11.5, color: C.muted }}>{c.email}</td>
                  <td style={{ padding: '10px 18px', fontSize: 11.5, color: C.muted }}>{fmtDate(c.lastContact)}</td>
                  <td style={{ padding: '10px 18px' }} onClick={e => e.stopPropagation()}>
                    <select style={{ fontSize: 11, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }} value={c.stage} onChange={e => changeStage(c.email, e.target.value)}>
                      {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeStage.count > showLimit && (
            <div onClick={() => setShowLimit(prev => prev + 30)} style={{ padding: '10px 18px', fontSize: 11.5, color: '#3B82F6', borderTop: `1px solid ${C.bg2}`, cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}>
              +{activeStage.count - showLimit} Kişi Daha Yükle
            </div>
          )}
        </Card>
      )}

      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
    </>
  )
}

// ═══════════════ DAILY ═══════════════

function DailyPage({ contacts, overdue }) {
  const [period, setPeriod] = useState('Tümü')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')

  // Aktif outbound kişileri (yanıt almamış, meeting/not interested/bounce/spam olmayan)
  const excludedStages = ['meeting_held', 'meeting_scheduled', 'not_interested', 'bounce', 'wrong_person', 'competitor', 'spam', 'out_of_office']

  // Şirket bazlı gruplama — iş günü hesaplı
  const dailyData = useMemo(() => {
    const activeContacts = contacts.filter(c =>
      c.sentCount > 0 && !c.receivedCount && !excludedStages.includes(c.stage)
    )

    // Şirket bazlı grupla
    const companyMap = {}
    activeContacts.forEach(c => {
      const key = (c.company || c.domain).toLowerCase()
      if (!companyMap[key]) {
        companyMap[key] = { company: c.company || c.domain, contacts: [], firstSent: c.lastSent, lastSent: c.lastSent }
      }
      companyMap[key].contacts.push(c)
      // Şirketteki en erken ve en geç gönderim tarihini bul
      if (c.lastSent && new Date(c.lastSent) < new Date(companyMap[key].firstSent)) companyMap[key].firstSent = c.lastSent
      if (c.lastSent && new Date(c.lastSent) > new Date(companyMap[key].lastSent)) companyMap[key].lastSent = c.lastSent
    })

    const fu1 = [] // 2+ iş günü geçti, henüz 1 mail gönderilmiş
    const fu2 = [] // 1.FU gönderilmiş, 2+ iş günü geçti
    const overdue = [] // 4+ iş günü geçti ilk mailden

    Object.values(companyMap).forEach(co => {
      const maxSent = Math.max(...co.contacts.map(c => c.sentCount || 0))
      const bdSinceFirst = businessDaysSince(co.firstSent)
      const bdSinceLast = businessDaysSince(co.lastSent)

      const item = {
        company: co.company,
        count: co.contacts.length,
        date: fmtDate(co.lastSent),
        bdSinceFirst,
        bdSinceLast,
      }

      // 4+ iş günü ilk mailden → Gecikmiş
      if (bdSinceFirst >= 4) {
        overdue.push(item)
      }
      // 2+ iş günü son gönderimden, 2+ mail gönderilmiş → 2. FU Gerekli
      else if (maxSent >= 2 && bdSinceLast >= 2) {
        fu2.push(item)
      }
      // 2+ iş günü son gönderimden, 1 mail gönderilmiş → 1. FU Gerekli
      else if (maxSent === 1 && bdSinceLast >= 2) {
        fu1.push(item)
      }
    })

    // En eski en üstte
    fu1.sort((a, b) => b.bdSinceLast - a.bdSinceLast)
    fu2.sort((a, b) => b.bdSinceLast - a.bdSinceLast)
    overdue.sort((a, b) => b.bdSinceFirst - a.bdSinceFirst)

    return { fu1, fu2, overdue }
  }, [contacts])

  // Needs Reply ve Processing ayrı
  const needsReply = contacts.filter(c => c.stage === 'needs_reply')
  const processing = contacts.filter(c => c.stage === 'processing_meeting')
  const interested = contacts.filter(c => c.stage === 'interested')

  const groupByCompanySimple = (ctcts) => {
    const map = {}
    ctcts.forEach(c => {
      const key = c.company || c.domain
      if (!map[key]) map[key] = { company: key, contacts: [], lastContact: c.lastContact }
      map[key].contacts.push(c)
      if (new Date(c.lastContact) > new Date(map[key].lastContact)) map[key].lastContact = c.lastContact
    })
    return Object.values(map).map(g => ({
      company: g.company, count: g.contacts.length, date: fmtDate(g.lastContact)
    }))
  }

  return (
    <>
      {/* Unutma */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Unutma</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { day: 'PAZARTESİ', task: 'Weekly TR-SDR Sync', sub: 'KPI Tracker Doldur' },
              { day: 'ÇARŞAMBA', task: 'Mid-Week Check-in', sub: 'Kampanya Kontrolü' },
            ].map((r, i) => (
              <div key={i} style={{ flex: 1, background: C.bg2, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: C.muted, letterSpacing: '0.5px' }}>{r.day}</span>
                <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2 }}>{r.task}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Needs Reply */}
      {needsReply.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <FUCard title="Yanıt Bekliyor" items={groupByCompanySimple(needsReply)} total={needsReply.length} color="amber" urgent />
        </div>
      )}

      {/* Interested */}
      {interested.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <FUCard title="Interested — Takip Et" items={groupByCompanySimple(interested)} total={interested.length} color="blue" />
        </div>
      )}

      {/* Follow Up Cards — iş günü bazlı */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <FUCard title="1. Follow Up Gerekli" items={dailyData.fu1} total={dailyData.fu1.length} color="blue" subtitle="2+ iş günü geçmiş" />
        <FUCard title="2. Follow Up Gerekli" items={dailyData.fu2} total={dailyData.fu2.length} color="amber" subtitle="1.FU sonrası 2+ iş günü" />
        <FUCard title="Gecikmiş Follow Up" items={dailyData.overdue} total={dailyData.overdue.length} color="red" urgent subtitle="4+ iş günü geçmiş" />
      </div>

      {/* Processing - Meeting */}
      {processing.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <FUCard title="Processing - Meeting" items={groupByCompanySimple(processing)} total={processing.length} color="green" />
        </div>
      )}
    </>
  )
}

// ═══════════════ COMPANIES ═══════════════

function CompaniesPage({ companies, selCompanies, setSelCompanies, notes, setNotes, changeStage, updateContactInfo }) {
  const [search, setSearch] = useState('')
  const [detailCompany, setDetailCompany] = useState(null)
  const [detailEmail, setDetailEmail] = useState(null)
  const [period, setPeriod] = useState('Tümü')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const { sortKey, sortDir, toggle, sortFn } = useSortable('date', 'desc')

  const compGetters = {
    company: c => c.name, domain: c => c.domain, stage: c => c.stage,
    count: c => c.contacts.length, date: c => new Date(c.lastContact),
  }

  const dateFiltered = useMemo(() => {
    const all = Object.values(companies)
    return filterByDate(all, period, startDate, endDate, 'lastContact')
  }, [companies, period, startDate, endDate])

  const filtered = dateFiltered.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.domain.includes(search.toLowerCase())
  )
  const list = sortFn(filtered, compGetters)

  const toggleSelect = (key) => {
    setSelCompanies(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => {
    if (selCompanies.size === list.length) setSelCompanies(new Set())
    else setSelCompanies(new Set(list.map(c => c.name.toLowerCase())))
  }

  const bulkChangeStage = (newStage) => {
    selCompanies.forEach(key => {
      const co = companies[key]
      if (co) co.contacts.forEach(ct => changeStage(ct.email, newStage))
    })
  }

  // Tek şirket seçiliyse detay paneli göster
  const singleSel = selCompanies.size === 1 ? companies[[...selCompanies][0]] : null

  return (
    <>
      <DateFilter period={period} onPeriodChange={setPeriod} startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />

      {/* Toplu İşlem Bar */}
      {selCompanies.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 16px', background: C.white, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <Badge color="blue">{selCompanies.size} şirket seçili</Badge>
          <span style={{ fontSize: 12, color: C.muted }}>Toplu Stage:</span>
          <select style={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }} defaultValue="" onChange={e => { if (e.target.value) { bulkChangeStage(e.target.value); e.target.value = '' } }}>
            <option value="" disabled>Stage Seç...</option>
            {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </select>
          <button onClick={() => setSelCompanies(new Set())} style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, background: C.bg2, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Seçimi Temizle</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
        {/* Sol: Tablo */}
        <div style={{ flex: singleSel ? '0 0 55%' : 1 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Şirket Ara..." style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', background: C.white, outline: 'none', color: C.text }} />
          </div>

          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '10px 10px 10px 14px', width: 30 }}>
                    <input type="checkbox" checked={list.length > 0 && selCompanies.size === list.length} onChange={selectAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {[['company','Şirket Adı'],['domain','Domain'],['stage','Statü'],['count','Kişi'],['date','Son İletişim']].map(([k,l]) =>
                    <SortTh key={k} label={l} sortKey={k} currentKey={sortKey} currentDir={sortDir} onToggle={toggle} />
                  )}
                </tr>
              </thead>
              <tbody>
                {list.map(c => {
                  const key = c.name.toLowerCase()
                  const isSelected = selCompanies.has(key)
                  return (
                    <tr key={c.name} onClick={() => toggleSelect(key)} style={{ borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', background: isSelected ? C.bg2 : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.bg }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '10px 10px 10px 14px', width: 30 }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(key)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, cursor: 'pointer', color: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); setDetailCompany(c.name) }}>{c.name}</td>
                      <td style={{ padding: '10px 14px', color: C.muted, fontSize: 11.5 }}>{c.domain}</td>
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        <select style={{ fontSize: 11, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }} value={c.stage} onChange={e => {
                          const newStage = e.target.value
                          c.contacts.forEach(ct => changeStage(ct.email, newStage))
                        }}>
                          {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{c.contacts.length}</td>
                      <td style={{ padding: '10px 14px', color: C.muted }}>{fmtDate(c.lastContact)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Sağ: Detay Paneli (tek seçimde) */}
        {singleSel && (
          <div style={{ flex: '0 0 43%', position: 'sticky', top: 70, alignSelf: 'flex-start' }}>
            <Card>
              <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{singleSel.name}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{singleSel.domain}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <StagePill stage={singleSel.stage} />
                  <button onClick={() => setSelCompanies(new Set())} style={{ background: 'none', border: 'none', fontSize: 16, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>Kişiler ({singleSel.contacts.length})</span>
                </div>
                {singleSel.contacts.map((c, i) => (
                  <div key={c.email} style={{ padding: '8px 0', borderBottom: i < singleSel.contacts.length - 1 ? `1px solid ${C.bg2}` : 'none', cursor: 'pointer' }} onClick={() => setDetailEmail(c.email)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
                      <StagePill stage={c.stage} small />
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{c.email}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Son İletişim: {fmtDate(c.lastContact)}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '10px 18px' }}>
                <textarea placeholder="Not Ekle..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', resize: 'vertical', minHeight: 50, outline: 'none', background: C.bg2, color: C.text, boxSizing: 'border-box' }}
                  value={notes[singleSel.domain] || ''}
                  onChange={e => {
                    const val = e.target.value
                    const updated = { ...notes, [singleSel.domain]: val }
                    setNotes(updated)
                    const cache = loadCache()
                    if (cache) saveCache({ ...cache, notes: updated })
                    dbSaveNotes(singleSel.domain, val)
                  }}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
      {detailCompany && <CompanyDetailModal companyName={detailCompany} onClose={() => setDetailCompany(null)} />}
      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
    </>
  )
}

// ═══════════════ PERFORMANS ═══════════════

function PerformansPage({ contacts, stats }) {
  const [period, setPeriod] = useState('Bu Hafta')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')

  const fc = useMemo(() => filterByDate(contacts, period, startDate, endDate), [contacts, period, startDate, endDate])

  const fs = {
    meetings: fc.filter(c => c.stage === 'meeting_held').length,
    scheduled: fc.filter(c => c.stage === 'meeting_scheduled').length,
    active: fc.filter(c => ['reached_out','follow_up_1','follow_up_2','processing_meeting'].includes(c.stage)).length,
    reply: fc.filter(c => c.stage === 'needs_reply').length,
  }

  const kpis = [
    { label: 'Meeting Held', current: fs.meetings, target: KPI.meetings, unit: '' },
    { label: 'Meeting Scheduled', current: fs.scheduled, target: 50, unit: '' },
    { label: 'Aktif Pipeline', current: fs.active, target: 200, unit: '' },
    { label: 'Yanıt Bekliyor', current: fs.reply, target: 20, unit: '' },
    { label: 'Pipeline ($)', current: fs.active * 8000, target: KPI.pipeline, unit: '$' },
  ]

  const funnel = [
    { stage: 'Reached Out', count: fc.filter(c => c.stage === 'reached_out').length },
    { stage: 'Follow Up', count: fc.filter(c => ['follow_up_1','follow_up_2'].includes(c.stage)).length },
    { stage: 'Processing', count: fc.filter(c => c.stage === 'processing_meeting').length },
    { stage: 'Scheduled', count: fs.scheduled },
    { stage: 'Meeting Held', count: fs.meetings },
    { stage: 'Not Interested', count: fc.filter(c => c.stage === 'not_interested').length },
  ]
  const maxF = funnel[0].count || 1

  return (
    <>
      <DateFilter period={period} onPeriodChange={setPeriod} startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* KPI vs Hedef */}
        <Card>
          <CardHeader title="KPI Vs Hedef" right={<span style={{ fontSize: 10.5, color: C.muted }}>Yıllık: {KPI.meetings} Mtg · ${(KPI.pipeline/1000000).toFixed(1)}M</span>} />
          <div style={{ padding: '8px 0' }}>
            {kpis.map((k, i) => {
              const pct = Math.min((k.current / k.target) * 100, 100)
              return (
                <div key={i} style={{ padding: '8px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{k.label}</span>
                    <span style={{ color: C.muted }}>{k.unit === '$' ? '$' : ''}{k.current.toLocaleString()}{k.unit !== '$' ? k.unit : ''} / {k.unit === '$' ? '$' : ''}{k.target.toLocaleString()}{k.unit !== '$' ? k.unit : ''}</span>
                  </div>
                  <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#EF9F27' : '#E24B4A', borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader title="Conversion Funnel" />
          <div style={{ padding: '8px 0' }}>
            {funnel.map((f, i) => {
              const rate = funnel[0].count ? ((f.count / funnel[0].count) * 100).toFixed(1) + '%' : '0%'
              return (
                <div key={i} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < funnel.length - 1 ? `1px solid ${C.bg2}` : 'none' }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{f.stage}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12 }}>{f.count}</span>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 40, textAlign: 'right' }}>{rate}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Stage Dağılımı */}
      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Stage Dağılımı" />
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {Object.entries(STAGE_META).map(([stage, meta]) => (
            <div key={stage} style={{ background: C.bg2, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${meta.color}` }}>
              <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{fc.filter(c => c.stage === stage).length}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{meta.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trend */}
      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Trend Çizgisi" right={<span style={{ fontSize: 10.5, color: C.muted }}>Son 8 Hafta</span>} />
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {[8, 14, 12, 22, 18, 26, 20, 24].map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: C.muted }}>{v}</span>
              <div style={{ width: '100%', height: `${(v / 30) * 100}%`, background: C.text, borderRadius: 3, minHeight: 4, opacity: i === 7 ? 1 : 0.3 }} />
              <span style={{ fontSize: 8.5, color: C.muted }}>H{i + 1}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// ═══════════════ KİŞİ DETAY MODAL ═══════════════

function ContactDetailModal({ email, onClose, onSave }) {
  const [info, setInfo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!email) return
    fetch(`/api/contacts-info?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(rows => {
        if (rows.length > 0) {
          setInfo(rows[0])
          setForm(rows[0])
        } else {
          const blank = { id: '', name: '', email, company: '', title: '', linkedin: '', campaign: '', first_email: '', emails_sent: 0, last_email: '', reply_status: '', pipeline_stage: '', source: '', notes: '' }
          setInfo(null)
          setForm(blank)
          setEditing(true)
        }
      })
      .catch(() => setInfo(null))
  }, [email])

  const save = async () => {
    setSaving(true)
    await fetch('/api/contacts-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setInfo(form)
    setEditing(false)
    setSaving(false)
    if (onSave) onSave(email, { name: form.name, company: form.company })
  }

  if (!email) return null

  const fields = [
    ['name', 'Ad Soyad'], ['email', 'Email'], ['company', 'Şirket'],
    ['title', 'Ünvan'], ['linkedin', 'LinkedIn'], ['campaign', 'Kampanya'],
    ['first_email', 'İlk Email'], ['emails_sent', 'Gönderilen Email'],
    ['last_email', 'Son Email'], ['reply_status', 'Yanıt Durumu'],
    ['pipeline_stage', 'Pipeline Stage'], ['notes', 'Not'],
  ]

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={e => e.stopPropagation()}>
        <div style={MS.header}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Kişi Kartı</span>
          <button style={MS.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!editing ? (
          <>
            <div style={MS.infoGrid}>
              {fields.map(([key, label]) => {
                const val = info?.[key]
                if (!val) return null
                return (
                  <div key={key} style={MS.field}>
                    <div style={MS.fieldLabel}>{label}</div>
                    <div style={MS.fieldValue}>
                      {key === 'linkedin' ? <a href={val} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', fontSize: 12 }}>Profili Aç</a> : val}
                    </div>
                  </div>
                )
              })}
            </div>
            <button style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }} onClick={() => setEditing(true)}>Düzenle</button>
          </>
        ) : (
          <>
            <div style={MS.infoGrid}>
              {fields.map(([key, label]) => (
                <div key={key} style={MS.field}>
                  <div style={MS.fieldLabel}>{label}</div>
                  {key === 'notes' ? (
                    <textarea style={MS.textarea} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  ) : (
                    <input style={MS.input} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.text, color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }} onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              <button style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setForm(info || {}); setEditing(false) }}>İptal</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════ ŞİRKET DETAY MODAL ═══════════════

function CompanyDetailModal({ companyName, onClose }) {
  const [info, setInfo] = useState(null)
  const [contacts, setContacts] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyName) return
    fetch(`/api/companies-info?name=${encodeURIComponent(companyName)}`)
      .then(r => r.json())
      .then(rows => {
        if (rows.length > 0) { setInfo(rows[0]); setForm(rows[0]) }
        else {
          const blank = { id: '', name: companyName, sector: '', campaign: '', pipeline_stage: '', website: '', linkedin: '', result_summary: '', notes: '' }
          setInfo(null); setForm(blank); setEditing(true)
        }
      })
    fetch(`/api/contacts-info?company=${encodeURIComponent(companyName)}`)
      .then(r => r.json()).then(setContacts)
  }, [companyName])

  const save = async () => {
    setSaving(true)
    await fetch('/api/companies-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setInfo(form); setEditing(false); setSaving(false)
  }

  if (!companyName) return null

  const fields = [
    ['name', 'Şirket Adı'], ['sector', 'Sektör'], ['campaign', 'Kampanya'],
    ['pipeline_stage', 'Pipeline Stage'], ['has_reply', 'Yanıt'],
    ['first_contact', 'İlk İletişim'], ['last_contact', 'Son İletişim'],
    ['website', 'Website'], ['linkedin', 'LinkedIn'],
    ['result_summary', 'Sonuç'], ['notes', 'Not'],
  ]

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={{ ...MS.modal, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={MS.header}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{companyName}</span>
          <button style={MS.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!editing ? (
          <>
            <div style={MS.infoGrid}>
              {fields.map(([key, label]) => {
                const val = info?.[key]
                if (!val) return null
                return (
                  <div key={key} style={MS.field}>
                    <div style={MS.fieldLabel}>{label}</div>
                    <div style={MS.fieldValue}>
                      {(key === 'linkedin' || key === 'website') ? <a href={val} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', fontSize: 12 }}>{val}</a> : val}
                    </div>
                  </div>
                )
              })}
            </div>
            <button style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }} onClick={() => setEditing(true)}>Düzenle</button>
          </>
        ) : (
          <>
            <div style={MS.infoGrid}>
              {fields.map(([key, label]) => (
                <div key={key} style={MS.field}>
                  <div style={MS.fieldLabel}>{label}</div>
                  {key === 'notes' ? (
                    <textarea style={MS.textarea} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  ) : (
                    <input style={MS.input} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.text, color: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }} onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              <button style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setForm(info || {}); setEditing(false) }}>İptal</button>
            </div>
          </>
        )}

        {contacts.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 20, marginBottom: 10 }}>Kişiler ({contacts.length})</div>
            {contacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.bg2}`, fontSize: 13 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#6B5C4C', flexShrink: 0 }}>{initials(c.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{c.title}</div>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{c.status}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════ MODAL STYLES ═══════════════

const MS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: C.white, borderRadius: 14, padding: '1.5rem', maxWidth: 480, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted, padding: 4 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: {},
  fieldLabel: { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: C.text },
  input: { width: '100%', padding: '6px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 60, padding: '6px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
}

// ═══════════════ YARDIMCI ═══════════════

function extractName(snippet, toHeader) {
  const m = snippet.match(/Merhaba ([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?: [A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?)/)
  if (m) return m[1]
  const t = toHeader.match(/"?([^"<,@]{3,})"?\s*</)
  if (t) return t[1].trim()
  return toHeader.split('@')[0]
}
