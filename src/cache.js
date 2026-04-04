const CACHE_KEY   = 'duygu_crm_v5_data'
const VERSION     = 5

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.version !== VERSION) return null
    return data
  } catch { return null }
}

export function saveCache(contacts, companies, historyId) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version:   VERSION,
      savedAt:   Date.now(),
      historyId,
      contacts,
      companies,
    }))
  } catch (e) {
    console.warn('Cache kaydetme hatası:', e)
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY)
}

export function buildCompanies(contacts) {
  const map = {}
  contacts.forEach(c => {
    if (!map[c.domain]) {
      map[c.domain] = {
        domain:      c.domain,
        name:        c.company,
        contacts:    [],
        stage:       c.stage,
        lastContact: c.lastContact,
        note:        '',
      }
    }
    map[c.domain].contacts.push(c)
    if (new Date(c.lastContact) > new Date(map[c.domain].lastContact)) {
      map[c.domain].lastContact = c.lastContact
      map[c.domain].stage       = c.stage
    }
  })
  return map
}

export function mergeContacts(existing, incoming) {
  const map = {}
  existing.forEach(c  => { map[c.email] = { ...c } })
  incoming.forEach(c  => {
    if (!map[c.email]) {
      map[c.email] = c
    } else {
      const ex = map[c.email]
      if (new Date(c.lastContact) > new Date(ex.lastContact)) {
        map[c.email] = { ...c, firstContact: ex.firstContact }
      }
      if (new Date(c.firstContact) < new Date(ex.firstContact)) {
        map[c.email].firstContact = c.firstContact
      }
    }
  })
  return Object.values(map)
}
