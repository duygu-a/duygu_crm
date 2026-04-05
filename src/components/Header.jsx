import { useState } from 'react'
import { C } from '../constants'

export default function Header({
  pageTitle,
  searchQ,
  setSearchQ,
  onFullScan,
  onDeltaSync,
  onLogout,
  loading,
  statusMsg,
  lastSync,
  contactCount,
}) {
  const [gmailDd, setGmailDd] = useState(false)
  const [linkedinDd, setLinkedinDd] = useState(false)

  const syncInfo = lastSync
    ? `Son Tarama: ${new Date(lastSync).toLocaleDateString('tr-TR')} · ${contactCount} Kişi`
    : (statusMsg || 'Henüz tarama yapılmadı')

  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52,
        borderBottom: `1px solid ${C.border}`, background: C.white,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Sol: Sayfa Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: C.text }}>{pageTitle}</h1>
          <span style={{ fontSize: 12, color: C.muted, cursor: 'pointer' }}>▾</span>
        </div>

        {/* Orta: Global Arama */}
        <div style={{ flex: 1, maxWidth: 480, margin: '0 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.bg,
          }}>
            <span style={{ fontSize: 13, color: C.muted }}>🔍</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 13, color: C.text, outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Sağ: Aksiyon Butonları */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
          {statusMsg && (
            <span style={{
              fontSize: 11, color: C.muted, padding: '3px 8px',
              background: C.bg2, borderRadius: 20, marginRight: 4,
            }}>{statusMsg}</span>
          )}

          {/* Gmail Tarama */}
          <div style={{ position: 'relative' }}>
            <HeaderBtn icon="✉" title="Gmail Tarama" onClick={() => { setGmailDd(!gmailDd); setLinkedinDd(false) }} />
            {gmailDd && (
              <DropdownPanel
                title="Gmail Tarama"
                info={syncInfo}
                btn={loading ? 'Taranıyor...' : 'Tam Tarama Başlat'}
                onBtnClick={() => { onFullScan(); setGmailDd(false) }}
                onClose={() => setGmailDd(false)}
              />
            )}
          </div>

          {/* Hızlı Sync */}
          <HeaderBtn icon="↻" title="Hızlı Sync" onClick={onDeltaSync} disabled={loading} />

          {/* LinkedIn */}
          <div style={{ position: 'relative' }}>
            <HeaderBtn icon="in" title="LinkedIn Extension" onClick={() => { setLinkedinDd(!linkedinDd); setGmailDd(false) }} small />
            {linkedinDd && (
              <DropdownPanel
                title="LinkedIn Extension"
                info="Manuel Import · 4 Adımlı Workflow"
                btn="LinkedIn Aktar"
                onBtnClick={() => setLinkedinDd(false)}
                onClose={() => setLinkedinDd(false)}
              />
            )}
          </div>

          {/* Yardım */}
          <HeaderBtn icon="?" title="Yardım" onClick={() => {}} />

          {/* Çıkış */}
          <HeaderBtn icon="⏻" title="Çıkış" onClick={onLogout} />
        </div>
      </header>

      {/* Backdrop */}
      {(gmailDd || linkedinDd) && (
        <div onClick={() => { setGmailDd(false); setLinkedinDd(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}
    </>
  )
}

function HeaderBtn({ icon, title, onClick, disabled, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 7,
        border: `1px solid ${C.border}`, background: C.white,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 11 : 13, fontWeight: small ? 600 : 400,
        color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = C.bg2 }}
      onMouseLeave={e => e.currentTarget.style.background = C.white}
    >{icon}</button>
  )
}

function DropdownPanel({ title, info, btn, onBtnClick, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: 40, right: 0, width: 240,
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.07)', zIndex: 200,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>{info}</div>
      <button onClick={onBtnClick} style={{
        width: '100%', padding: '7px 0', borderRadius: 6,
        border: 'none', background: C.text, color: C.white,
        fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}>{btn}</button>
    </div>
  )
}
