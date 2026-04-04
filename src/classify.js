// Etiketleme motoru — 16 kural, öncelik sırası

export const MY_EMAIL = 'duygu@cambly.com'

export const LABEL_IDS = {
  REACHED_OUT:        'Label_1',
  FOLLOW_UP_1:        'Label_2',
  FOLLOW_UP_2:        'Label_3',
  NEEDS_REPLY:        'Label_4',
  PROCESSING_MEETING: 'Label_5',
  MEETING_SCHEDULED:  'Label_6',
  MEETING_HELD:       'Label_7',
  RESCHEDULE:         'Label_8',
  NO_ANSWER:          'Label_9',
  NOT_INTERESTED:     'Label_10',
  BOUNCE:             'Label_11',
  WRONG_PERSON:       'Label_12',
  OUT_OF_OFFICE:      'Label_13',
  COMPETITOR:         'Label_14',
  B2C_CAMPAIGN:       'Label_15',
  SMARTLEAD:          'Label_16',
}

export const ALL_LABEL_IDS = Object.values(LABEL_IDS)

export const LABEL_TO_STAGE = {
  Label_1:  'reached_out',
  Label_2:  'follow_up_1',
  Label_3:  'follow_up_2',
  Label_4:  'needs_reply',
  Label_5:  'processing_meeting',
  Label_6:  'meeting_scheduled',
  Label_7:  'meeting_held',
  Label_8:  'reschedule',
  Label_9:  'no_answer',
  Label_10: 'not_interested',
  Label_11: 'bounce',
  Label_12: 'wrong_person',
  Label_13: 'out_of_office',
  Label_14: 'competitor',
  Label_15: 'b2c_campaign',
  Label_16: 'smartlead',
}

export const STAGE_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_STAGE).map(([k, v]) => [v, k])
)

export const STAGE_META = {
  reached_out:        { label: 'Reached Out',          color: '#6B7280' },
  follow_up_1:        { label: '1. Follow Up',          color: '#8B5CF6' },
  follow_up_2:        { label: '2. Follow Up',          color: '#7C3AED' },
  needs_reply:        { label: 'Needs Reply',           color: '#F59E0B' },
  processing_meeting: { label: 'Processing - Meeting',  color: '#3B82F6' },
  meeting_scheduled:  { label: 'Meeting Scheduled',     color: '#10B981' },
  meeting_held:       { label: 'Meeting Held',          color: '#059669' },
  reschedule:         { label: 'Reschedule',            color: '#F97316' },
  no_answer:          { label: 'No Answer',             color: '#9CA3AF' },
  not_interested:     { label: 'Not Interested',        color: '#EF4444' },
  bounce:             { label: 'Bounce',                color: '#DC2626' },
  wrong_person:       { label: 'Wrong Person',          color: '#991B1B' },
  out_of_office:      { label: 'Out Of Office',         color: '#6366F1' },
  competitor:         { label: 'Competitor',            color: '#DB2777' },
  b2c_campaign:       { label: 'B2C Campaign',          color: '#0EA5E9' },
  smartlead:          { label: 'Smartlead',             color: '#14B8A6' },
}

export const PIPELINE_STAGES = [
  'reached_out','follow_up_1','follow_up_2','needs_reply',
  'processing_meeting','meeting_scheduled','meeting_held','reschedule',
]
export const OUTCOME_STAGES = [
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor','b2c_campaign','smartlead',
]

// ── Mesaj header'larını map'e çevir ──────────────────────────
function headersToMap(headers) {
  const m = {}
  ;(headers || []).forEach(h => { m[h.name] = h.value })
  return m
}

// ── Mesajdan stage belirle ───────────────────────────────────
export function classifyMessage(msg) {
  const headers  = headersToMap(msg.payload?.headers || [])
  const snippet  = (msg.snippet || '').toLowerCase()
  const subject  = (headers['Subject'] || '').toLowerCase()
  const from     = (headers['From']    || '').toLowerCase()
  const to       = (headers['To']      || '').toLowerCase()
  const cc       = (headers['Cc']      || '').toLowerCase()
  const labels   = msg.labelIds || []

  const isMine   = from.includes(MY_EMAIL)
  const isBounce = from.includes('mailer-daemon') || from.includes('postmaster')

  // 1. Bounce
  if (isBounce ||
      subject.includes('delivery status') ||
      subject.includes('undeliverable') ||
      subject.includes('mail delivery failed') ||
      subject.includes('returned mail') ||
      subject.includes('delivery failure'))
    return 'bounce'

  // 2. Out Of Office
  if (subject.includes('out of office') ||
      subject.includes('otomatik yanıt') ||
      subject.includes('automatic reply') ||
      subject.includes('dışarıda') ||
      subject.includes('izinde') ||
      snippet.includes('out of office') ||
      snippet.includes('otomatik yanıt'))
    return 'out_of_office'

  // 3. Wrong Person
  if (snippet.includes('yanlış kişi') ||
      snippet.includes('ben değilim') ||
      snippet.includes('sorumlu değil') ||
      snippet.includes('başka birine yönlendiriyorum') ||
      snippet.includes('wrong person'))
    return 'wrong_person'

  // 4. Not Interested
  if (snippet.includes('ilgilenmiyoruz') ||
      snippet.includes('ilgilenmiyorum') ||
      snippet.includes('ihtiyacımız yok') ||
      snippet.includes('gündemimizde değil') ||
      snippet.includes('şu an için değil') ||
      snippet.includes('not interested'))
    return 'not_interested'

  // 5. Competitor
  if (snippet.includes('babbel') ||
      snippet.includes('duolingo') ||
      snippet.includes('rosetta') ||
      snippet.includes('başka bir platform') ||
      snippet.includes('farklı bir çözüm'))
    return 'competitor'

  // 6. Reschedule
  if (snippet.includes('reschedule') ||
      snippet.includes('ertelemek') ||
      snippet.includes('ertelememiz') ||
      snippet.includes('başka bir güne') ||
      snippet.includes('tarih değişikliği') ||
      snippet.includes('acil bir durum sebebiyle ertelemeniz'))
    return 'reschedule'

  // 7. Meeting Held
  if (isMine &&
      (cc.includes('batuhan@cambly.com') || cc.includes('kemal@cambly.com') || cc.includes('tugba@cambly.com')) &&
      (snippet.includes('toplantı') || snippet.includes('davetiye') || snippet.includes('görüşme')))
    return 'meeting_held'

  // 8. Meeting Scheduled
  if (isMine && (
      snippet.includes('toplantı oluşturdum') ||
      snippet.includes('davetiye gönderdim') ||
      snippet.includes('davetiyesini paylaştı') ||
      snippet.includes('için toplantı oluşturd') ||
      (snippet.includes('saat') && snippet.includes('için') && snippet.includes('oluşturdum'))))
    return 'meeting_scheduled'

  // 9. Processing - Meeting
  if (!isMine && !from.includes('cambly.com') && !isBounce && (
      snippet.includes('müsaitlik') ||
      snippet.includes('müsait misiniz') ||
      snippet.includes('hangi gün') ||
      snippet.includes('uygun olur mu') ||
      snippet.includes('ne zaman uygun') ||
      snippet.includes('saat kaçta') ||
      snippet.includes('takvim') ||
      snippet.includes('toplantı için')))
    return 'processing_meeting'

  // 10. Needs Reply — gelen kutusu, dışarıdan
  if (!isMine &&
      !from.includes('cambly.com') &&
      !isBounce &&
      labels.includes('INBOX'))
    return 'needs_reply'

  // 11. B2C Campaign
  if (isMine && (
      subject.includes('cambly invoices') ||
      subject.includes('invoices —') ||
      subject.includes('english training at') ||
      subject.includes('english development at') ||
      subject.includes('english benefit at')))
    return 'b2c_campaign'

  // 12. 2. Follow Up
  if (isMine && (
      snippet.includes('birkaç kez ulaşmaya çalıştım') ||
      snippet.includes('doğrudan konuya gelmek') ||
      snippet.includes('son bir not') ||
      snippet.includes('bu yüzden doğrudan')))
    return 'follow_up_2'

  // 13. 1. Follow Up
  if (isMine && (
      snippet.includes('farklı bir açıdan tekrar') ||
      snippet.includes('düşünerek tekrar ulaşmak') ||
      snippet.includes('gündemine denk gelmemiş olabilece') ||
      snippet.includes('tekrar ulaşmak istedim')))
    return 'follow_up_1'

  // 14. No Answer / Reached Out
  if (isMine) {
    const dateStr = headers['Date']
    const daysOld = dateStr
      ? (Date.now() - new Date(dateStr).getTime()) / 86400000
      : 999
    return daysOld >= 7 ? 'no_answer' : 'reached_out'
  }

  return null
}

// ── Mesajdan contact verisi çıkar ────────────────────────────
export function extractContact(msg) {
  const headers  = headersToMap(msg.payload?.headers || [])
  const from     = (headers['From']    || '').toLowerCase()
  const to       = headers['To']       || ''
  const subject  = headers['Subject']  || ''
  const date     = headers['Date']     || ''
  const snippet  = msg.snippet || ''
  const isMine   = from.includes(MY_EMAIL)
  if (!isMine) return []

  const toEmails = to.split(/[,;]/)
    .map(e => e.trim())
    .map(e => { const m = e.match(/<(.+?)>/); return m ? m[1] : e })
    .map(e => e.toLowerCase().trim())
    .filter(e => e && !e.includes('cambly.com') && !e.includes('mailer-daemon') && !e.includes('postmaster') && e.includes('@'))

  if (toEmails.length === 0) return []

  const stage = classifyMessage(msg)
  if (!stage) return []

  return toEmails.map(email => {
    const domain  = email.split('@')[1] || ''
    const nameMatch = snippet.match(/Merhaba ([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?: [A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?)/)
    const toMatch   = to.match(/"([^"]+)"\s*<[^>]+>/)
    const name = nameMatch ? nameMatch[1] : (toMatch ? toMatch[1].trim() : email.split('@')[0])
    const company = domain.split('.')[0]
    const companyName = company.charAt(0).toUpperCase() + company.slice(1)

    return {
      email,
      name,
      domain,
      company:      companyName,
      stage,
      lastContact:  date,
      firstContact: date,
      subject,
      snippet:      snippet.slice(0, 140),
      threadId:     msg.threadId,
      messageId:    msg.id,
    }
  })
}
