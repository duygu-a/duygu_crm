import { IGNORED_DOMAINS, IGNORED_PREFIXES } from './constants'

// ── YARDIMCILAR ───────────────────────────────────────────────
export const hdr = (headers, name) => {
  const h = headers?.find(h => h.name === name)
  return h ? h.value : ''
}

export const getDomain = email => {
  const m = email?.match(/@([\w.-]+)/)
  return m ? m[1].toLowerCase() : ''
}

export const companyName = domain =>
  domain ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1) : ''

export const daysSince = d => {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export const fmtDate = d => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'2-digit' })
}

export const initials = name =>
  (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

export const stageFromLabels = (labelIds, labelToStage) => {
  if (!labelIds || !labelToStage) return null
  for (const id of labelIds) {
    if (labelToStage[id]) return labelToStage[id]
  }
  return null
}

export const isIgnoredEmail = (email) => {
  if (!email) return true
  const domain = getDomain(email)
  const local = email.split('@')[0]
  if (IGNORED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return true
  if (IGNORED_PREFIXES.some(p => p.includes('@') ? email.startsWith(p) : local.includes(p))) return true
  return false
}

// ── İŞ GÜNÜ HESAPLAMA ────────────────────────────────────────
export function businessDaysSince(dateStr) {
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
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

// ── TARİH FİLTRE YARDIMCISI ──────────────────────────────────
export function getDateRange(period, startDate, endDate) {
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
    const [sy, sm, sd] = startDate.split('-').map(Number)
    const [ey, em, ed] = endDate.split('-').map(Number)
    return { from: new Date(sy, sm - 1, sd, 0, 0, 0), to: new Date(ey, em - 1, ed, 23, 59, 59) }
  }

  return { from: null, to: null }
}

export function filterByDate(items, period, startDate, endDate, dateField = 'lastContact') {
  const { from, to } = getDateRange(period, startDate, endDate)
  if (!from && !to) return items
  return items.filter(item => {
    const raw = item[dateField]
    if (!raw) return false
    const d = new Date(raw)
    if (isNaN(d.getTime())) return false
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

// ── CONTACT SINIFLANDIRMA ────────────────────────────────────
export const classifyContact = (c) => {
  const s = (c.snippet || '').toLowerCase()
  const sub = (c.subject || '').toLowerCase()
  const hasSent = c.sentCount > 0
  const hasReply = c.receivedCount > 0
  const daysSinceSent = businessDaysSince(c.lastSent)

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

// ── İSİM ÇIKARMA ────────────────────────────────────────────
export function extractName(snippet, toHeader) {
  const m = snippet.match(/Merhaba ([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?: [A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?)/)
  if (m) return m[1]
  const t = toHeader.match(/"?([^"<,@]{3,})"?\s*</)
  if (t) return t[1].trim()
  return toHeader.split('@')[0]
}
