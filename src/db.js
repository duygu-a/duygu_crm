import { CACHE_KEY, CACHE_VER } from './constants'

// ── DB API helpers ───────────────────────────────────────────
export const dbSaveContacts = async (contacts) => {
  try {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts }),
    })
  } catch (e) { console.warn('DB contacts save hatası:', e) }
}

export const dbLoadContacts = async () => {
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

export const dbSaveNotes = async (domain, notes) => {
  try {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, notes }),
    })
  } catch (e) { console.warn('DB notes save hatası:', e) }
}

export const dbLoadNotes = async () => {
  try {
    const res = await fetch('/api/notes')
    if (!res.ok) return {}
    return await res.json()
  } catch (e) { return {} }
}

export const dbSaveLabelMap = async (labelMap) => {
  try {
    await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelMap }),
    })
  } catch (e) { console.warn('DB labels save hatası:', e) }
}

export const dbLoadLabelMap = async () => {
  try {
    const res = await fetch('/api/labels')
    if (!res.ok) return null
    const map = await res.json()
    return Object.keys(map).length ? map : null
  } catch (e) { return null }
}

// ── CACHE (localStorage fallback) ────────────────────────────
export const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d.version !== CACHE_VER) return null
    return d
  } catch { return null }
}

export const saveCache = data =>
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, version: CACHE_VER, savedAt: Date.now() }))
