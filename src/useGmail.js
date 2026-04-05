// Gmail OAuth 2.0 — Authorization Code flow (backend ile)

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI
const SCOPES       = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify'
const TOKEN_KEY    = 'duygu_crm_access_token'
const EXPIRY_KEY   = 'duygu_crm_token_expiry'

// ── Token ────────────────────────────────────────────────────
export function getToken() {
  const token  = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(EXPIRY_KEY)
  if (!token || !expiry) return null
  if (Date.now() > parseInt(expiry)) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRY_KEY)
    return null
  }
  return token
}

export function saveToken(token, expiresIn) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

// ── Login ────────────────────────────────────────────────────
export function startLogin() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Callback — code → token exchange ─────────────────────────
// Backend client_secret ile token exchange yapar — PKCE gerekmez
export async function handleCallback(code) {
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Token exchange başarısız')
  }

  const data = await res.json()
  saveToken(data.access_token, data.expires_in)
  return data.access_token
}

// ── Gmail API çağrıları ───────────────────────────────────────
async function gmailFetch(path, token, params = {}) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    if (res.status === 401) { clearToken(); throw new Error('TOKEN_EXPIRED') }
    throw new Error(`Gmail API hatası: ${res.status}`)
  }
  return res.json()
}

export async function gmailSearchMessages(token, q, maxResults = 500, pageToken) {
  const params = { q, maxResults }
  if (pageToken) params.pageToken = pageToken
  return gmailFetch('messages', token, params)
}

export async function gmailGetMessage(token, id) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`)
  url.searchParams.set('format', 'metadata')
  ;['From','To','Cc','Subject','Date'].forEach(h => url.searchParams.append('metadataHeaders', h))
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    if (res.status === 401) { clearToken(); throw new Error('TOKEN_EXPIRED') }
    throw new Error(`Gmail API hatası: ${res.status}`)
  }
  return res.json()
}

export async function gmailListLabels(token) {
  return gmailFetch('labels', token)
}

export async function gmailModifyThread(token, threadId, addLabelIds = [], removeLabelIds = []) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  })
  if (!res.ok) throw new Error('Thread modify başarısız')
  return res.json()
}

export async function gmailGetProfile(token) {
  return gmailFetch('profile', token)
}

// ── Outreach Thread Kontrolü ─────────────────────────────────
// Bir thread'in gerçek outreach olup olmadığını belirler.
// Sadece duygu@cambly.com'dan external (cambly dışı) kişilere gönderilen
// VE noise/system sender olmayan thread'ler outreach sayılır.
export function isOutreachThread(messages) {
  const INTERNAL = ['duygu@cambly.com', 'batuhan@cambly.com', 'tugba@cambly.com']
  const NOISE_SENDERS = [
    'noreply', 'no-reply', 'no_reply', 'mailer-daemon', 'postmaster',
    'notifications', 'notification', 'calendar-notification', 'meetings-noreply',
    'instapage.com', 'hubspot.com', 'google.com', 'googlemail.com',
    'vercel.com', 'slack.com', 'openai.com', 'anthropic.com',
    'zoom.us', 'sellbetter', 'apollo.io', 'streak.com', 'theorg.com',
    'mixmax.com', 'superhuman.com', 'intercom.io', 'intercom-mail.com',
    'mailchimp.com', 'sendgrid.net', 'amazonses.com',
    'smartlead.ai', 'instantly.ai', 'outreach.io',
    'calendly.com', 'loom.com', 'grammarly.com', 'canva.com',
    'figma.com', 'notion.so', 'github.com', 'linkedin.com',
  ]

  return messages.some(msg => {
    const headers = msg.payload?.headers || []
    const from = (headers.find(h => h.name === 'From')?.value || '').toLowerCase()
    const to   = (headers.find(h => h.name === 'To')?.value || '').toLowerCase()

    const sentByMe    = from.includes('duygu@cambly.com')
    const notInternal = !INTERNAL.some(addr => to.includes(addr))
    const notNoise    = !NOISE_SENDERS.some(n => from.includes(n))

    return sentByMe && notInternal && notNoise
  })
}

// Label oluştur (yoksa)
export async function gmailCreateLabel(token, name) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  })
  if (!res.ok) throw new Error(`Label oluşturulamadı: ${name}`)
  return res.json()
}

// Label'ları isme göre eşleştir, yoksa oluştur
export async function ensureCrmLabels(token, stageNames) {
  const existing = await gmailListLabels(token)
  const userLabels = existing.labels.filter(l => l.type === 'user')
  const nameToId = {}

  for (const stageName of stageNames) {
    const crmName = `CRM/${stageName}`
    const found = userLabels.find(l => l.name === crmName)
    if (found) {
      nameToId[stageName] = found.id
    } else {
      const created = await gmailCreateLabel(token, crmName)
      nameToId[stageName] = created.id
    }
  }
  return nameToId
}
