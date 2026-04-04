// Gmail OAuth 2.0 — PKCE flow (backend yok, tamamen client-side)

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI
const SCOPES       = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify'
const TOKEN_KEY    = 'duygu_crm_access_token'
const EXPIRY_KEY   = 'duygu_crm_token_expiry'
const VERIFIER_KEY = 'duygu_crm_code_verifier'

// ── PKCE ────────────────────────────────────────────────────
function generateVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

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

// ── Cookie helpers ──────────────────────────────────────────
function setCookie(name, value, minutes = 10) {
  const expires = new Date(Date.now() + minutes * 60000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax;Secure`
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
}

// ── Login ────────────────────────────────────────────────────
export async function startLogin() {
  const verifier   = generateVerifier()
  const challenge  = await generateChallenge(verifier)

  // 3 farklı yere kaydet — en az biri çalışacak
  try { localStorage.setItem(VERIFIER_KEY, verifier) } catch (e) {}
  try { sessionStorage.setItem(VERIFIER_KEY, verifier) } catch (e) {}
  setCookie(VERIFIER_KEY, verifier)

  console.log('Verifier saved to localStorage:', !!localStorage.getItem(VERIFIER_KEY))
  console.log('Verifier saved to sessionStorage:', !!sessionStorage.getItem(VERIFIER_KEY))
  console.log('Verifier saved to cookie:', !!getCookie(VERIFIER_KEY))

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    response_type:         'code',
    scope:                 SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    access_type:           'offline',
    prompt:                'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Callback — code → token exchange ─────────────────────────
// NOT: PKCE ile client_secret olmadan token exchange ÇALIŞMAZ
// Google desktop app type gerektirir veya backend proxy gerekir.
// Bu proje için Vercel serverless function kullanıyoruz.
export async function handleCallback(code) {
  // 3 kaynaktan da dene
  const fromLocal   = localStorage.getItem(VERIFIER_KEY)
  const fromSession = sessionStorage.getItem(VERIFIER_KEY)
  const fromCookie  = getCookie(VERIFIER_KEY)
  const verifier    = fromLocal || fromSession || fromCookie

  console.log('handleCallback debug:', {
    fromLocal: !!fromLocal,
    fromSession: !!fromSession,
    fromCookie: !!fromCookie,
    cookies: document.cookie,
    localKeys: Object.keys(localStorage),
    sessionKeys: Object.keys(sessionStorage),
    origin: window.location.origin,
  })

  if (!verifier) {
    throw new Error(
      'Code verifier bulunamadı. localStorage, sessionStorage ve cookie üçü de boş.'
    )
  }

  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier, redirect_uri: REDIRECT_URI }),
  })
  if (!res.ok) throw new Error('Token exchange başarısız')
  const data = await res.json()
  saveToken(data.access_token, data.expires_in)
  localStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  deleteCookie(VERIFIER_KEY)
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
  return gmailFetch(`messages/${id}`, token, { format: 'metadata', metadataHeaders: 'From,To,Cc,Subject,Date' })
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
