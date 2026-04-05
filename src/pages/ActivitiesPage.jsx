import { C } from '../constants'

// Close.com tarzı Activities — aktivite türü seçimi
export default function ActivitiesPage() {
  const types = [
    { icon: '📞', label: 'Calls' },
    { icon: '✉', label: 'Emails' },
    { icon: '💬', label: 'SMS' },
    { icon: '📱', label: 'WhatsApp' },
    { icon: '📅', label: 'Meetings' },
    { icon: '📝', label: 'Notes' },
  ]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>Select an activity type</h2>
        <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 32, lineHeight: 1.5 }}>
          A Smart View in Close is a saved filter for leads, opportunities, and other objects. Set your criteria, and it automatically updates to display the most relevant records—no manual searching required.
        </p>

        {/* Activity Type Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {types.map(t => (
            <div key={t.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: C.white, cursor: 'pointer', transition: 'border-color 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{t.label}</span>
              </div>
              <span style={{ color: C.muted }}>›</span>
            </div>
          ))}
        </div>

        {/* Custom Activity */}
        <div style={{ padding: '16px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Select a Custom Activity</div>
          <input placeholder="Search for custom activities..." style={{
            width: '100%', padding: '8px 12px', borderRadius: 6,
            border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }} />
        </div>

        {/* Select a Form */}
        <div style={{ padding: '16px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Select a Form</div>
          <input placeholder="Search for Forms..." style={{
            width: '100%', padding: '8px 12px', borderRadius: 6,
            border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
      </div>
    </div>
  )
}
