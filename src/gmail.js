// Gmail OAuth 2.0 — implicit flow (SPA, client-side only)
// Token localStorage'da tutulur

const CLIENT_ID   = import.meta.env.VITE_GMAIL_CLIENT_ID
const SCOPES      = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels'
const REDIRECT_URI = window.location.origin
const TOKEN_KEY   = 'duygu_crm_token'
const EXPIRY_KEY  = 'duygu_crm_expiry'

// ── AUTH ─────────────────────────────────────────────────────

export function getToken() {
  const token  = localStorage.getItem(TOKEN_KEY)
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0')
  if (!token || Date.now() > expiry) return null
  return token
}

export function saveToken(token, expiresIn) {
  localStorage.setItem(TOKEN_KEY,  token)
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

export function login() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'token',
    scope:         SCOPES,
    prompt:        'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// OAuth redirect'ten token al
export function handleOAuthRedirect() {
  const hash = window.location.hash.substring(1)
  if (!hash) return false
  const params = new URLSearchParams(hash)
  const token    = params.get('access_token')
  const expiresIn = parseInt(params.get('expires_in') || '3600')
  if (token) {
    saveToken(token, expiresIn)
    window.history.replaceState({}, '', window.location.pathname)
    return true
  }
  return false
}

// ── API HELPERS ───────────────────────────────────────────────

async function gmailFetch(path, params = {}) {
  const token = getToken()
  if (!token) throw new Error('Token yok — login gerekli')

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val))
    else url.searchParams.set(k, v)
  })

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (res.status === 401) {
    clearToken()
    throw new Error('Token süresi doldu — tekrar giriş yap')
  }

  if (!res.ok) throw new Error(`Gmail API hatası: ${res.status}`)
  return res.json()
}

async function gmailPost(path, body) {
  const token = getToken()
  if (!token) throw new Error('Token yok — login gerekli')

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 401) { clearToken(); throw new Error('Token süresi doldu') }
  if (!res.ok) throw new Error(`Gmail API hatası: ${res.status}`)
  return res.json()
}

// ── GMAIL OPERASYONLARI ───────────────────────────────────────

export async function getProfile() {
  return gmailFetch('profile')
}

export async function listLabels() {
  const data = await gmailFetch('labels')
  return data.labels || []
}

export async function searchMessages(query, maxResults = 500, pageToken = null) {
  const params = { q: query, maxResults }
  if (pageToken) params.pageToken = pageToken
  return gmailFetch('messages', params)
}

export async function getMessage(id) {
  return gmailFetch(`messages/${id}`, {
    format:          'metadata',
    metadataHeaders: ['From','To','Cc','Subject','Date'],
  })
}

export async function modifyThread(threadId, addLabelIds = [], removeLabelIds = []) {
  return gmailPost(`threads/${threadId}/modify`, { addLabelIds, removeLabelIds })
}

// Tüm mesajları sayfalayarak çek
export async function fetchAllMessages(query, onProgress) {
  const all = []
  let pageToken = null
  let page = 0

  do {
    const res = await searchMessages(query, 500, pageToken)
    const msgs = res.messages || []
    all.push(...msgs)
    pageToken = res.nextPageToken
    page++
    if (onProgress) onProgress(all.length, res.resultSizeEstimate || 0)
  } while (pageToken)

  return all
}
