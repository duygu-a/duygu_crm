import { useState, useEffect } from 'react'
import { getToken, startLogin, clearToken } from './useGmail'
import AuthCallback from './AuthCallback'
import DuygyCRM from './DuygyCRM'

export default function App() {
  const [token, setToken] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.location.pathname === '/auth/callback') {
      setReady(true)
      return
    }
    const t = getToken()
    setToken(t)
    setReady(true)
  }, [])

  if (!ready) return null
  if (window.location.pathname === '/auth/callback') return <AuthCallback />
  if (!token) return <LoginScreen onLogin={startLogin} />

  return (
    <DuygyCRM
      token={token}
      onLogout={() => { clearToken(); setToken(null) }}
    />
  )
}

function LoginScreen({ onLogin }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#FAF4EB', fontFamily: "'DM Sans', sans-serif",
      flexDirection: 'column', gap: 24,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#050500', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Duygu CRM
      </h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
        Gmail hesabınla giriş yap
      </p>
      <button onClick={onLogin} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 24px', background: '#050500', color: '#FAF4EB',
        border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500,
        cursor: 'pointer',
      }}>
        <GoogleIcon />
        Google ile Giriş Yap
      </button>
      <p style={{ fontSize: 11, color: '#bbb', maxWidth: 280, textAlign: 'center' }}>
        Gmail verilerine sadece sen erişebilirsin. Veriler tarayıcında saklanır.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706C3.786 10.166 3.685 9.59 3.685 9s.101-1.166.279-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
