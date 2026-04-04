import { useEffect, useState } from 'react'
import { handleCallback } from './useGmail'

export default function AuthCallback() {
  const [status, setStatus] = useState('Giriş tamamlanıyor...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const error  = params.get('error')

    if (error) {
      setStatus('Giriş iptal edildi. Sayfayı kapat.')
      return
    }

    if (!code) {
      setStatus('Geçersiz callback. Tekrar dene.')
      return
    }

    handleCallback(code)
      .then(() => {
        setStatus('Giriş başarılı! Yönlendiriliyor...')
        setTimeout(() => window.location.href = '/', 1000)
      })
      .catch(err => {
        setStatus('Hata: ' + err.message)
      })
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: "'DM Sans', sans-serif",
      background: '#FAF4EB', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #E4DBD3',
        borderTopColor: '#050500', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 14, color: '#888' }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
