import { useState, useEffect, useCallback } from 'react'
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

// Label ID'leri dinamik olarak Gmail'den çekilir (CRM/stage_name formatında)
const ALL_STAGES = [
  'reached_out','follow_up_1','follow_up_2','needs_reply',
  'processing_meeting','meeting_scheduled','meeting_held','reschedule',
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor','b2c_campaign','smartlead',
]

const STAGE_META = {
  reached_out:        { label: 'Reached Out',         color: '#6B7280' },
  follow_up_1:        { label: '1. Follow Up',         color: '#8B5CF6' },
  follow_up_2:        { label: '2. Follow Up',         color: '#7C3AED' },
  needs_reply:        { label: 'Needs Reply',          color: '#F59E0B' },
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
  b2c_campaign:       { label: 'B2C Campaign',         color: '#0EA5E9' },
  smartlead:          { label: 'Smartlead',            color: '#14B8A6' },
}

const PIPELINE_STAGES = [
  'reached_out','follow_up_1','follow_up_2','needs_reply',
  'processing_meeting','meeting_scheduled','meeting_held','reschedule',
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor',
]
const OUTCOME_STAGES = [
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor',
]

const KPI = { meetings: 156, pipeline: 3100000 }
const TABS = ['Dashboard', 'Pipeline', 'Daily', 'Companies', 'Performans']

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

// İki yönlü iletişime göre classify et
const classifyContact = (c) => {
  const s = (c.snippet || '').toLowerCase()
  const sub = (c.subject || '').toLowerCase()
  const hasSent = c.sentCount > 0
  const hasReply = c.receivedCount > 0
  const daysSinceSent = c.lastSent ? Math.floor((Date.now() - new Date(c.lastSent).getTime()) / 86400000) : 999
  const daysSinceReply = c.lastReceived ? Math.floor((Date.now() - new Date(c.lastReceived).getTime()) / 86400000) : 999

  // Bounce
  if (s.includes('mailer-daemon') || s.includes('postmaster') ||
      sub.includes('delivery status') || sub.includes('undeliverable') ||
      sub.includes('mail delivery failed') || sub.includes('returned mail'))
    return 'bounce'

  // Out Of Office
  if (sub.includes('out of office') || sub.includes('otomatik yanıt') ||
      sub.includes('automatic reply') || sub.includes('dışarıda') ||
      sub.includes('izinde') || s.includes('out of office') ||
      s.includes('otomatik yanıt'))
    return 'out_of_office'

  // Wrong Person
  if (hasReply && (s.includes('yanlış kişi') || s.includes('ben değilim') ||
      s.includes('sorumlu değil') || s.includes('başka birine yönlendiriyorum')))
    return 'wrong_person'

  // Not Interested
  if (hasReply && (s.includes('ilgilenmiyoruz') || s.includes('ilgilenmiyorum') ||
      s.includes('ihtiyacımız yok') || s.includes('gündemimizde değil') ||
      s.includes('şu an için değil') || s.includes('not interested')))
    return 'not_interested'

  // Competitor
  if (hasReply && (s.includes('babbel') || s.includes('duolingo') || s.includes('rosetta') ||
      s.includes('başka bir platform') || s.includes('farklı bir çözüm')))
    return 'competitor'

  // Reschedule
  if (hasReply && (s.includes('reschedule') || s.includes('ertelemek') ||
      s.includes('ertelememiz') || s.includes('başka bir güne')))
    return 'reschedule'

  // Meeting Scheduled
  if (s.includes('toplantı oluşturdum') || s.includes('davetiye gönderdim') ||
      s.includes('davetiyesini paylaştı') || s.includes('için toplantı oluşturd') ||
      (s.includes('saat') && s.includes('için') && s.includes('oluşturdum')))
    return 'meeting_scheduled'

  // Processing - Meeting (müsaitlik konuşuluyor)
  if (hasReply && (s.includes('müsaitlik') || s.includes('müsait misiniz') ||
      s.includes('hangi gün') || s.includes('uygun olur mu') ||
      s.includes('ne zaman uygun') || s.includes('saat kaçta') ||
      s.includes('takvim')))
    return 'processing_meeting'

  // B2C Campaign
  if (sub.includes('cambly invoices') || sub.includes('invoices —') ||
      sub.includes('english training at') || sub.includes('english development at') ||
      sub.includes('english benefit at'))
    return 'b2c_campaign'

  // Yanıt geldiyse → Needs Reply (sen henüz yanıtlamamışsan)
  if (hasReply && hasSent && new Date(c.lastReceived) > new Date(c.lastSent))
    return 'needs_reply'

  // 2. Follow Up — breakup mesajları
  if (c.sentCount >= 3 || s.includes('birkaç kez ulaşmaya çalıştım') ||
      s.includes('doğrudan konuya gelmek') || s.includes('son bir not'))
    return 'follow_up_2'

  // 1. Follow Up
  if (c.sentCount === 2 || s.includes('farklı bir açıdan tekrar') ||
      s.includes('tekrar ulaşmak istedim'))
    return 'follow_up_1'

  // Sadece gönderilmiş, yanıt yok
  if (hasSent && !hasReply) {
    if (daysSinceSent >= 7) return 'no_answer'
    return 'reached_out'
  }

  // Default
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
    // DB snake_case → frontend camelCase
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

// ── ANA UYGULAMA ──────────────────────────────────────────────
export default function DuygyCRM({ token, onLogout }) {
  const [tab, setTab]               = useState('Dashboard')
  const [contacts, setContacts]     = useState([])
  const [companies, setCompanies]   = useState({})
  const [loading, setLoading]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [statusMsg, setStatusMsg]   = useState('')
  const [lastSync, setLastSync]     = useState(null)
  const [searchQ, setSearchQ]       = useState('')
  const [selCompany, setSelCompany] = useState(null)
  const [pipeFilter, setPipeFilter] = useState('all')
  const [expStage, setExpStage]     = useState(null)
  const [notes, setNotes]           = useState({})
  const [labelMap, setLabelMap]     = useState(null) // { stage_name: gmail_label_id }

  // İlk yükleme — önce DB, yoksa localStorage fallback
  useEffect(() => {
    const groupByDomain = (ctcts) => {
      const m = {}
      ctcts.forEach(c => {
        if (!m[c.domain]) {
          m[c.domain] = { domain: c.domain, name: c.company, contacts: [], stage: c.stage, lastContact: c.lastContact }
        }
        m[c.domain].contacts.push(c)
        if (new Date(c.lastContact) > new Date(m[c.domain].lastContact)) {
          m[c.domain].lastContact = c.lastContact
          m[c.domain].stage = c.stage
        }
      })
      return m
    }

    ;(async () => {
      setStatusMsg('Veriler yükleniyor...')

      // DB'den yükle
      const [dbContacts, dbNotes, dbLabels] = await Promise.all([
        dbLoadContacts(),
        dbLoadNotes(),
        dbLoadLabelMap(),
      ])

      if (dbContacts && dbContacts.length > 0) {
        const comps = groupByDomain(dbContacts)
        setContacts(dbContacts)
        setCompanies(comps)
        setNotes(dbNotes || {})
        if (dbLabels) setLabelMap(dbLabels)
        setLastSync(Date.now())
        setStatusMsg(`DB: ${dbContacts.length} kişi`)
        saveCache({ contacts: dbContacts, companies: comps, notes: dbNotes || {}, labelMap: dbLabels })
        return
      }

      // DB boşsa localStorage'dan dene
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

  // Mesaj listesinden contact/company yapısı
  // Hem gönderilen hem alınan mailleri işler
  const buildData = useCallback((messages, labelWriteQueue = [], stageToLabelId = {}, labelIdToStage = {}) => {
    // Thread bazlı gruplama: her thread'deki tüm mesajları topla
    const threadMap = {} // threadId → { sent: [], received: [], contactEmail, ... }
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

      // Karşı tarafın emailini bul
      let contactEmails = []
      if (isSent) {
        contactEmails = to.split(/[,;]/)
          .map(e => e.trim().replace(/.*<(.+)>.*/, '$1').trim().toLowerCase())
          .filter(e => e && !e.includes('cambly.com') && !e.includes('mailer-daemon'))
      } else {
        const fromEmail = from.replace(/.*<(.+)>.*/, '$1').trim().toLowerCase()
        if (fromEmail && !fromEmail.includes('cambly.com') && !fromEmail.includes('mailer-daemon')) {
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

    // Her contact için stage belirle
    return Object.values(contactMap).map(c => {
      // Önce Gmail label'dan stage bul
      const uniqueLabels = [...new Set(c.labels)]
      const fromLabel = stageFromLabels(uniqueLabels, labelIdToStage)

      let stage
      if (fromLabel) {
        stage = fromLabel
      } else {
        // İki yönlü iletişim bazlı classification
        stage = classifyContact(c)
      }

      // Label yoksa yazma kuyruğuna al
      if (!fromLabel && c.threadId && stageToLabelId[stage]) {
        labelWriteQueue.push({ threadId: c.threadId, labelId: stageToLabelId[stage] })
      }

      // Gereksiz field'ları temizle
      delete c.labels
      return { ...c, stage }
    })
  }, [])

  const buildCompanies = useCallback((ctcts) => {
    const m = {}
    ctcts.forEach(c => {
      if (!m[c.domain]) {
        m[c.domain] = { domain: c.domain, name: c.company, contacts: [], stage: c.stage, lastContact: c.lastContact }
      }
      m[c.domain].contacts.push(c)
      if (new Date(c.lastContact) > new Date(m[c.domain].lastContact)) {
        m[c.domain].lastContact = c.lastContact
        m[c.domain].stage = c.stage
      }
    })
    return m
  }, [])

  // Mesajları batch halinde çek (rate limit koruması)
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
      // 1) Gmail label'larını oluştur / eşleştir
      const stageToLabelId = await ensureCrmLabels(token, ALL_STAGES)
      const labelIdToStage = Object.fromEntries(
        Object.entries(stageToLabelId).map(([stage, id]) => [id, stage])
      )
      setLabelMap(stageToLabelId)
      setProgress(10)

      // 2) Önce tüm mesaj ID'lerini topla
      const sentIds = []
      const receivedIds = []
      let pageToken = null

      // Gönderilen mesaj ID'leri
      setStatusMsg('Gönderilen mailler listeleniyor...')
      do {
        const res = await gmailSearchMessages(token, `from:${MY_EMAIL}`, 500, pageToken)
        sentIds.push(...(res.messages || []))
        pageToken = res.nextPageToken
      } while (pageToken)
      setProgress(15)
      setStatusMsg(`${sentIds.length} gönderilen mesaj bulundu...`)

      // Alınan mesaj ID'leri
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

      // 3) Mesaj detaylarını batch halinde çek
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

      // contacts_info'dan doğru isimleri al
      try {
        const infoRows = await fetch('/api/contacts-info').then(r => r.json())
        const infoMap = {}
        infoRows.forEach(r => { if (r.email) infoMap[r.email.toLowerCase()] = r })
        ctcts.forEach(c => {
          const info = infoMap[c.email]
          if (info) {
            if (info.name) c.name = info.name
            if (info.company) c.company = info.company
          }
        })
      } catch (e) { /* contacts_info yoksa devam */ }

      const comps = buildCompanies(ctcts)

      setContacts(ctcts)
      setCompanies(comps)
      setLastSync(Date.now())

      saveCache({ contacts: ctcts, companies: comps, notes, labelMap: stageToLabelId })
      // DB'ye kaydet (arka planda)
      dbSaveContacts(ctcts)
      dbSaveLabelMap(stageToLabelId)
      setProgress(90)

      // Label'ları Gmail'e yaz (throttled)
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

  // DELTA SYNC (son 48 saat)
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
        dbSaveContacts(newC) // sadece değişen kişileri DB'ye yaz
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

  // Stage değiştir → Gmail etiket güncelle
  const changeStage = useCallback(async (email, newStage) => {
    const contact = contacts.find(c => c.email === email)
    if (!contact) return

    setContacts(prev => {
      const updated = prev.map(c => c.email === email ? { ...c, stage: newStage } : c)
      const comps   = buildCompanies(updated)
      setCompanies(comps)
      saveCache({ contacts: updated, companies: comps, notes })
      // DB'ye stage değişikliğini yaz
      const updatedContact = updated.find(c => c.email === email)
      if (updatedContact) dbSaveContacts([updatedContact])
      return updated
    })

    // Gmail etiket güncelle (arka planda)
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

  // Kişi bilgisi güncellendiğinde listeyi de güncelle
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

  const weeklyC    = contacts.filter(c => daysSince(c.lastContact) <= 7)
  const overdue    = contacts.filter(c => ['follow_up_1','follow_up_2'].includes(c.stage) && daysSince(c.lastContact) >= 3)
  const filtered   = contacts.filter(c => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.email.includes(q) || c.company?.toLowerCase().includes(q)
  })

  return (
    <div style={S.app}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hLeft}>
          <span style={S.logo}>Duygu CRM</span>
          <nav style={S.nav}>
            {TABS.map(t => (
              <button key={t} style={{ ...S.navBtn, ...(tab === t ? S.navActive : {}) }} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>
        <div style={S.hRight}>
          {statusMsg && <span style={S.statusBadge}>{statusMsg}</span>}
          {lastSync && <span style={S.lastSyncTxt}>{new Date(lastSync).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })}</span>}
          <button style={S.btn} onClick={deltaSync} disabled={loading}>↻ Sync</button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={fullScan} disabled={loading}>Tam Tarama</button>
          <button style={{ ...S.btn, color: '#888' }} onClick={onLogout}>Çıkış</button>
        </div>
      </header>

      {/* PROGRESS */}
      {progress > 0 && (
        <div style={{ height: 3, background: '#E4DBD3' }}>
          <div style={{ height: '100%', background: '#050500', width: progress + '%', transition: 'width 0.3s' }} />
        </div>
      )}

      {/* SAYFA */}
      <main style={S.main}>
        {tab === 'Dashboard'  && <Dashboard stats={stats} weeklyC={weeklyC} overdue={overdue} updateContactInfo={updateContactInfo} />}
        {tab === 'Pipeline'   && <Pipeline contacts={filtered} searchQ={searchQ} setSearchQ={setSearchQ} pipeFilter={pipeFilter} setPipeFilter={setPipeFilter} expStage={expStage} setExpStage={setExpStage} changeStage={changeStage} updateContactInfo={updateContactInfo} />}
        {tab === 'Daily'      && <Daily contacts={contacts} overdue={overdue} />}
        {tab === 'Companies'  && <Companies companies={companies} selCompany={selCompany} setSelCompany={setSelCompany} notes={notes} setNotes={setNotes} changeStage={changeStage} updateContactInfo={updateContactInfo} />}
        {tab === 'Performans' && <Performans contacts={contacts} stats={stats} />}
      </main>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({ stats, weeklyC, overdue: rawOverdue, updateContactInfo }) {
  const [detailEmail, setDetailEmail] = useState(null)
  const [detailCompany, setDetailCompany] = useState(null)
  const { sortKey, sortDir, toggle, sortFn } = useSortable('days', 'desc')
  const overdueGetters = {
    name: c => c.name, company: c => c.company, stage: c => c.stage,
    date: c => new Date(c.lastContact), days: c => daysSince(c.lastContact),
  }
  const overdue = sortFn(rawOverdue, overdueGetters)
  const dow = new Date().getDay()
  return (
    <div style={S.page}>
      <div style={S.remind}>
        <span style={{ fontSize: 14 }}>⚑</span>
        <div>
          {dow === 1 && <div style={S.remindLine}>Pazartesi — Weekly TR-SDR Sync</div>}
          {dow === 3 && <div style={S.remindLine}>Çarşamba — Mid-Week Check-in</div>}
          <div style={S.remindLine}>Her gün 09:00 → Gmail tara, etiketle, follow-up listesi hazırla</div>
          <div style={S.remindLine}>Bir şirketten olumlu yanıt varsa o şirketteki diğer kişilere follow-up gönderme</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={S.sTitle}>Haftalık Skor</div>
          <div style={S.statGrid}>
            {[
              ['Toplam Kişi', stats.total],
              ['Bu Hafta Aktif', weeklyC.length],
              ['Meeting Held', stats.meetings],
              ['Scheduled', stats.scheduled],
              ['Yanıt Bekliyor', stats.reply],
              ['Aktif Pipeline', stats.active],
            ].map(([l, v]) => (
              <div key={l} style={S.statCard}>
                <div style={S.statNum}>{v}</div>
                <div style={S.statLbl}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 260 }}>
          <div style={S.sTitle}>Günlük Görevler</div>
          <div style={S.card}>
            {['Gmail tara & etiketle','Yeni bağlantılara mesaj gönder','Follow-up listesini hazırla','Pipeline stage güncelle','Meeting notlarını kaydet','KPI tablosunu güncelle'].map((t, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F5EFE6', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" />
                {t}
              </label>
            ))}
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <>
          <div style={S.sTitle}>
            Gecikmiş Follow-Up
            <span style={{ ...S.badge, background: '#FEE2E2', color: '#DC2626', marginLeft: 8 }}>Acil — {overdue.length}</span>
          </div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>
                {[['name','Kişi'],['company','Şirket'],['stage','Stage'],['date','Son İletişim'],['days','Gün']].map(([k,l]) =>
                  <SortTh key={k} label={l} sortKey={k} currentKey={sortKey} currentDir={sortDir} onToggle={toggle} />
                )}
              </tr></thead>
              <tbody>
                {overdue.slice(0, 8).map(c => (
                  <tr key={c.email} style={S.tr}>
                    <td style={{ ...S.td, cursor: 'pointer' }} onClick={() => setDetailEmail(c.email)}><div style={{ fontWeight: 500, color: '#3B82F6' }}>{c.name}</div><div style={{ fontSize: 11, color: '#888' }}>{c.email}</div></td>
                    <td style={{ ...S.td, cursor: 'pointer', color: '#3B82F6' }} onClick={() => setDetailCompany(c.company)}>{c.company}</td>
                    <td style={S.td}><StagePill stage={c.stage} /></td>
                    <td style={S.td}>{fmtDate(c.lastContact)}</td>
                    <td style={{ ...S.td, color: '#EF4444', fontWeight: 500 }}>{daysSince(c.lastContact)}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
      {detailCompany && <CompanyDetailModal companyName={detailCompany} onClose={() => setDetailCompany(null)} />}
    </div>
  )
}

// ── PIPELINE ──────────────────────────────────────────────────
function Pipeline({ contacts, searchQ, setSearchQ, pipeFilter, setPipeFilter, expStage, setExpStage, changeStage, updateContactInfo }) {
  const stageMap = {
    all: PIPELINE_STAGES,
    outcome: OUTCOME_STAGES,
    b2c: ['b2c_campaign'],
    smartlead: ['smartlead'],
  }
  const stages = stageMap[pipeFilter] || PIPELINE_STAGES
  const [detailEmail, setDetailEmail] = useState(null)
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={S.search} placeholder="Kişi, şirket veya email ara..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {[['all','Pipeline'],['b2c','B2C'],['smartlead','Smartlead']].map(([f, l]) => (
          <button key={f} style={{ ...S.filterBtn, ...(pipeFilter === f ? S.filterActive : {}) }} onClick={() => setPipeFilter(f)}>{l}</button>
        ))}
      </div>
      <div style={S.pipeGrid}>
        {stages.map(stage => {
          const sc   = contacts.filter(c => c.stage === stage)
          const meta = STAGE_META[stage]
          const exp  = expStage === stage
          return (
            <div key={stage} style={S.stageCol}>
              <div style={{ ...S.stageHdr, borderLeftColor: meta.color, cursor: 'pointer' }} onClick={() => setExpStage(exp ? null : stage)}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</span>
                <span style={{ ...S.badge, background: meta.color + '20', color: meta.color }}>{sc.length}</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sc.length === 0
                  ? <div style={{ fontSize: 12, color: '#bbb', padding: '4px 0' }}>Boş</div>
                  : sc.slice(0, exp ? 999 : 3).map(c => (
                      <ContactCard key={c.email} contact={c} onStageChange={changeStage} compact={!exp} onClickDetail={() => setDetailEmail(c.email)} />
                    ))
                }
                {!exp && sc.length > 3 && (
                  <button style={S.showMore} onClick={() => setExpStage(stage)}>+{sc.length - 3} daha</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
    </div>
  )
}

// ── DAILY ─────────────────────────────────────────────────────
function Daily({ contacts, overdue }) {
  const sections = [
    { title: 'Needs Reply',           contacts: contacts.filter(c => c.stage === 'needs_reply'),          color: '#F59E0B', urgent: true },
    { title: 'Gecikmiş Follow-Up',    contacts: overdue,                                                  color: '#EF4444', urgent: true },
    { title: '1. Follow Up Gerekli',  contacts: contacts.filter(c => c.stage === 'follow_up_1'),          color: '#8B5CF6' },
    { title: '2. Follow Up Gerekli',  contacts: contacts.filter(c => c.stage === 'follow_up_2'),          color: '#7C3AED' },
    { title: 'Processing - Meeting',  contacts: contacts.filter(c => c.stage === 'processing_meeting'),   color: '#3B82F6' },
  ].filter(s => s.contacts.length > 0)

  const dow = new Date().getDay()

  return (
    <div style={S.page}>
      <div style={S.remind}>
        <span style={{ fontSize: 14 }}>⚑</span>
        <div>
          {dow === 1 && <div style={S.remindLine}>Pazartesi — Weekly TR-SDR Sync</div>}
          {dow === 3 && <div style={S.remindLine}>Çarşamba — Mid-Week Check-in</div>}
          <div style={S.remindLine}>Her 2 günde bir: Yanıt vermeyen kişiler için follow-up taslağı hazırla</div>
        </div>
      </div>
      {sections.map(s => <DailySection key={s.title} {...s} />)}
    </div>
  )
}

function DailySection({ title, contacts, color, urgent }) {
  const [open, setOpen] = useState(true)
  const byCompany = {}
  contacts.forEach(c => {
    if (!byCompany[c.company]) byCompany[c.company] = []
    byCompany[c.company].push(c)
  })
  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${color}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: open ? 10 : 0 }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{title}</span>
        {urgent && <span style={{ ...S.badge, background: color + '20', color, fontSize: 11 }}>Acil</span>}
        <span style={{ ...S.badge, background: '#F5EFE6', color: '#888', fontSize: 11 }}>{contacts.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && Object.entries(byCompany).map(([company, ctcts]) => (
        <div key={company} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #F5EFE6', fontSize: 13 }}>
          <span style={{ fontWeight: 500, minWidth: 140 }}>{company}</span>
          <span style={{ color: '#888', fontSize: 12 }}>{ctcts.length} kişi</span>
          <span style={{ color: '#bbb', fontSize: 12, marginLeft: 'auto' }}>{fmtDate(ctcts[0].lastContact)}</span>
          {urgent && <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 500 }}>{daysSince(ctcts[0].lastContact)}g</span>}
        </div>
      ))}
    </div>
  )
}

// ── COMPANIES ─────────────────────────────────────────────────
function Companies({ companies, selCompany, setSelCompany, notes, setNotes, changeStage, updateContactInfo }) {
  const [search, setSearch] = useState('')
  const [detailCompany, setDetailCompany] = useState(null)
  const [detailEmail, setDetailEmail] = useState(null)
  const { sortKey, sortDir, toggle, sortFn } = useSortable('date', 'desc')
  const compGetters = {
    company: c => c.name, domain: c => c.domain, stage: c => c.stage,
    count: c => c.contacts.length, date: c => new Date(c.lastContact),
  }
  const filtered = Object.values(companies).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.domain.includes(search.toLowerCase())
  )
  const list = sortFn(filtered, compGetters)
  const sel = selCompany ? companies[selCompany] : null

  return (
    <div style={{ display: 'flex', gap: '1.25rem' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <input style={{ ...S.search, marginBottom: '1rem', width: '100%' }} placeholder="Şirket ara..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              {[['company','Şirket'],['domain','Domain'],['stage','Stage'],['count','Kişi'],['date','Son İletişim']].map(([k,l]) =>
                <SortTh key={k} label={l} sortKey={k} currentKey={sortKey} currentDir={sortDir} onToggle={toggle} />
              )}
            </tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.domain} style={{ ...S.tr, cursor: 'pointer', background: selCompany === c.domain ? '#F5EFE6' : '' }} onClick={() => setSelCompany(c.domain)}>
                  <td style={{ ...S.td, fontWeight: 500, cursor: 'pointer', color: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); setDetailCompany(c.name) }}>{c.name}</td>
                  <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{c.domain}</td>
                  <td style={S.td} onClick={e => e.stopPropagation()}>
                    <select style={{ ...S.stageSelect, width: 'auto', marginTop: 0, fontSize: 12 }} value={c.stage} onChange={e => {
                      const newStage = e.target.value
                      c.contacts.forEach(ct => changeStage(ct.email, newStage))
                    }}>
                      {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>{c.contacts.length}</td>
                  <td style={S.td}>{fmtDate(c.lastContact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <div style={S.detailPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{sel.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{sel.domain}</div>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }} onClick={() => setSelCompany(null)}>✕</button>
          </div>
          <select style={{ ...S.stageSelect, width: 'auto', marginTop: 0 }} value={sel.stage} onChange={e => {
            const newStage = e.target.value
            sel.contacts.forEach(ct => changeStage(ct.email, newStage))
          }}>
            {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{fmtDate(sel.lastContact)}</span>

          <div style={{ ...S.sTitle, marginTop: '1rem' }}>Kişiler ({sel.contacts.length})</div>
          {sel.contacts.map(c => (
            <div key={c.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5EFE6', cursor: 'pointer' }} onClick={() => setDetailEmail(c.email)}>
              <div style={S.avatar}>{initials(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
              </div>
              <StagePill stage={c.stage} small />
            </div>
          ))}

          <div style={{ ...S.sTitle, marginTop: '1rem' }}>Not</div>
          <textarea
            style={S.noteArea}
            placeholder="Bu şirket için notlar..."
            value={notes[sel.domain] || ''}
            onChange={e => {
              const val = e.target.value
              const updated = { ...notes, [sel.domain]: val }
              setNotes(updated)
              const cache = loadCache()
              if (cache) saveCache({ ...cache, notes: updated })
              // DB'ye kaydet (debounce olmadan, her tuşta)
              dbSaveNotes(sel.domain, val)
            }}
          />
        </div>
      )}
      {detailCompany && <CompanyDetailModal companyName={detailCompany} onClose={() => setDetailCompany(null)} />}
      {detailEmail && <ContactDetailModal email={detailEmail} onClose={() => setDetailEmail(null)} onSave={updateContactInfo} />}
    </div>
  )
}

// ── PERFORMANS ────────────────────────────────────────────────
function Performans({ contacts, stats }) {
  const funnel = [
    ['Reached Out', contacts.filter(c => c.stage === 'reached_out').length],
    ['Follow Up',   contacts.filter(c => ['follow_up_1','follow_up_2'].includes(c.stage)).length],
    ['Processing',  contacts.filter(c => c.stage === 'processing_meeting').length],
    ['Scheduled',   stats.scheduled],
    ['Held',        stats.meetings],
  ]
  const maxF = funnel[0][1] || 1
  const colors = ['#6B7280','#8B5CF6','#3B82F6','#10B981','#059669']

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={S.sTitle}>KPI vs Hedef</div>
          <div style={S.card}>
            {[
              { label: 'Meeting Held', val: stats.meetings, target: KPI.meetings, color: '#10B981', prefix: '' },
              { label: 'Pipeline (tahmini)', val: stats.active * 8000, target: KPI.pipeline, color: '#3B82F6', prefix: '$' },
            ].map(k => (
              <div key={k.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#888' }}>{k.label}</span>
                  <span><strong>{k.prefix}{k.val.toLocaleString()}</strong><span style={{ color: '#bbb', fontSize: 12 }}> / {k.prefix}{k.target.toLocaleString()}</span></span>
                </div>
                <div style={{ background: '#F5EFE6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: k.color, height: '100%', width: Math.min(100, Math.round(k.val / k.target * 100)) + '%', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>%{Math.min(100, Math.round(k.val / k.target * 100))} hedefe ulaşıldı</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 260 }}>
          <div style={S.sTitle}>Conversion Funnel</div>
          <div style={S.card}>
            {funnel.map(([label, val], i) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>{label}</span>
                  <strong>{val}</strong>
                </div>
                <div style={{ background: '#F5EFE6', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ background: colors[i], height: '100%', width: Math.round(val / maxF * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.sTitle}>Stage Dağılımı</div>
      <div style={S.statGrid}>
        {Object.entries(STAGE_META).map(([stage, meta]) => (
          <div key={stage} style={{ ...S.statCard, borderLeft: `3px solid ${meta.color}` }}>
            <div style={{ ...S.statNum, fontSize: 20 }}>{contacts.filter(c => c.stage === stage).length}</div>
            <div style={{ ...S.statLbl, fontSize: 11 }}>{meta.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SORTABLE TABLE HEADER ─────────────────────────────────────
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
      style={{ ...S.th, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => onToggle(sortKey)}
    >
      {label} <span style={{ fontSize: 10, color: active ? '#050500' : '#ccc', marginLeft: 2 }}>
        {active ? (currentDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )
}

// ── CONTACT CARD ──────────────────────────────────────────────
function ContactCard({ contact: c, onStageChange, compact, onClickDetail }) {
  return (
    <div style={{ background: '#F5EFE6', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }} onClick={() => onClickDetail?.()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ ...S.avatar, width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{initials(c.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
          <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
        </div>
        <div style={{ fontSize: 11, color: '#bbb', whiteSpace: 'nowrap' }}>{daysSince(c.lastContact)}g</div>
      </div>
      {!compact && (
        <select style={S.stageSelect} value={c.stage} onClick={e => e.stopPropagation()} onChange={e => onStageChange(c.email, e.target.value)}>
          {Object.entries(STAGE_META).map(([s, m]) => (
            <option key={s} value={s}>{m.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── STAGE PILL ────────────────────────────────────────────────
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

// ── STYLES ────────────────────────────────────────────────────
const S = {
  app:        { fontFamily: "'DM Sans', sans-serif", background: '#FAF4EB', minHeight: '100vh' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: 52, background: '#FFFFFF', borderBottom: '1px solid #E4DBD3', position: 'sticky', top: 0, zIndex: 100 },
  hLeft:      { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  hRight:     { display: 'flex', alignItems: 'center', gap: 8 },
  logo:       { fontSize: 15, fontWeight: 700, color: '#050500', letterSpacing: '-0.02em' },
  nav:        { display: 'flex', gap: 2 },
  navBtn:     { background: 'none', border: 'none', padding: '5px 12px', fontSize: 13, color: '#888', cursor: 'pointer', borderRadius: 6 },
  navActive:  { background: '#F5EFE6', color: '#050500', fontWeight: 500 },
  statusBadge:{ fontSize: 11, color: '#888', padding: '3px 8px', background: '#F5EFE6', borderRadius: 20 },
  lastSyncTxt:{ fontSize: 11, color: '#bbb' },
  btn:        { fontSize: 12, padding: '5px 12px', border: '1px solid #E4DBD3', borderRadius: 6, background: '#FFFFFF', cursor: 'pointer', color: '#050500' },
  btnPrimary: { background: '#050500', color: '#FAF4EB', border: 'none' },
  main:       { padding: '1.5rem' },
  page:       { maxWidth: 1100, margin: '0 auto' },
  sTitle:     { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  card:       { background: '#FFFFFF', border: '1px solid #E4DBD3', borderRadius: 10, padding: '12px 14px' },
  statGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: '1.25rem' },
  statCard:   { background: '#FFFFFF', border: '1px solid #E4DBD3', borderRadius: 10, padding: '12px 14px' },
  statNum:    { fontSize: 26, fontWeight: 600, color: '#050500', lineHeight: 1.1 },
  statLbl:    { fontSize: 12, color: '#888', marginTop: 3 },
  tableWrap:  { background: '#FFFFFF', borderRadius: 10, border: '1px solid #E4DBD3', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #E4DBD3', background: '#FAF4EB' },
  tr:         { borderBottom: '1px solid #F5EFE6' },
  td:         { padding: '10px 14px', fontSize: 13, color: '#050500' },
  badge:      { display: 'inline-block', fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500 },
  remind:     { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF8F0', border: '1px solid #F5E6D0', borderRadius: 10, padding: '12px 14px', marginBottom: '1.25rem' },
  remindLine: { fontSize: 12, color: '#6B4C2A', lineHeight: 1.7 },
  pipeGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  stageCol:   { background: '#FFFFFF', border: '1px solid #E4DBD3', borderRadius: 10, overflow: 'hidden' },
  stageHdr:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderLeft: '3px solid', background: '#FAF4EB', borderBottom: '1px solid #E4DBD3' },
  showMore:   { width: '100%', fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'center' },
  search:     { padding: '7px 12px', fontSize: 13, border: '1px solid #E4DBD3', borderRadius: 8, background: '#FFFFFF', color: '#050500', outline: 'none', minWidth: 220 },
  filterBtn:  { fontSize: 12, padding: '5px 12px', border: '1px solid #E4DBD3', borderRadius: 20, background: '#FFFFFF', cursor: 'pointer', color: '#888' },
  filterActive:{ background: '#050500', color: '#FAF4EB', border: '1px solid #050500' },
  detailPanel:{ width: 300, background: '#FFFFFF', border: '1px solid #E4DBD3', borderRadius: 10, padding: '1.25rem', overflow: 'auto', maxHeight: 'calc(100vh - 120px)' },
  avatar:     { width: 34, height: 34, borderRadius: '50%', background: '#E4DBD3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6B5C4C', flexShrink: 0 },
  noteArea:   { width: '100%', minHeight: 80, padding: '8px 10px', border: '1px solid #E4DBD3', borderRadius: 8, fontSize: 12, background: '#FAF4EB', color: '#050500', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginTop: 6 },
  stageSelect:{ width: '100%', fontSize: 11, padding: '3px 6px', border: '1px solid #E4DBD3', borderRadius: 6, background: '#FFFFFF', color: '#050500', cursor: 'pointer', marginTop: 6 },
}

// ── KİŞİ DETAY MODAL ─────────────────────────────────────────
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
          // DB'de yoksa boş form
          const blank = { id: '', name: '', email, company: '', title: '', status: '', linkedin: '', linkedin_connected: false, reached_out_date: '', last_mail_snippet: '', source: '', notes: '', linkedin_status: '', linkedin_date: '' }
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
    // Ana listeyi güncelle
    if (onSave) onSave(email, { name: form.name, company: form.company })
  }

  if (!email) return null

  const fields = [
    ['name', 'Ad Soyad'], ['email', 'Email'], ['company', 'Şirket'],
    ['title', 'Ünvan'], ['status', 'Durum'], ['linkedin', 'LinkedIn'],
    ['linkedin_status', 'LinkedIn Durumu'], ['reached_out_date', 'İlk İletişim'],
    ['source', 'Kaynak'], ['notes', 'Not'],
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
            <button style={{ ...S.btn, marginTop: 12, width: '100%' }} onClick={() => setEditing(true)}>Düzenle</button>
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
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => { setForm(info || {}); setEditing(false) }}>İptal</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── ŞİRKET DETAY MODAL ──────────────────────────────────────
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
          const blank = { id: '', name: companyName, status: '', notes: '', website: '', linkedin: '' }
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
    ['name', 'Şirket Adı'], ['status', 'Durum'],
    ['website', 'Website'], ['linkedin', 'LinkedIn'], ['notes', 'Not'],
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
            <button style={{ ...S.btn, marginTop: 12, width: '100%' }} onClick={() => setEditing(true)}>Düzenle</button>
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
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => { setForm(info || {}); setEditing(false) }}>İptal</button>
            </div>
          </>
        )}

        {contacts.length > 0 && (
          <>
            <div style={{ ...S.sTitle, marginTop: 20 }}>Kişiler ({contacts.length})</div>
            {contacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F5EFE6', fontSize: 13 }}>
                <div style={{ ...S.avatar, width: 26, height: 26, fontSize: 10 }}>{initials(c.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{c.title}</div>
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>{c.status}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── MODAL STYLES ─────────────────────────────────────────────
const MS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#FFFFFF', borderRadius: 14, padding: '1.5rem', maxWidth: 480, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: 4 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: {},
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: '#050500' },
  input: { width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid #E4DBD3', borderRadius: 6, background: '#FAF4EB', color: '#050500', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 60, padding: '6px 10px', fontSize: 13, border: '1px solid #E4DBD3', borderRadius: 6, background: '#FAF4EB', color: '#050500', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
}

// ── YARDIMCI ──────────────────────────────────────────────────
function extractName(snippet, toHeader) {
  const m = snippet.match(/Merhaba ([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?: [A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?)/)
  if (m) return m[1]
  const t = toHeader.match(/"?([^"<,@]{3,})"?\s*</)
  if (t) return t[1].trim()
  return toHeader.split('@')[0]
}
