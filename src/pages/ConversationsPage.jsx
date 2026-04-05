import { C } from '../constants'

// Close.com tarzı Conversations — History + Live Calls
export default function ConversationsPage() {
  return (
    <div>
      {/* Filtre Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input placeholder="Search for phrases and keywords..." style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box', background: C.white,
          }} />
        </div>
        <select style={selectStyle}>
          <option>Match any</option>
          <option>Match all</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={filterBtn}>All Users</button>
        <button style={filterBtn}>All Leads</button>
        <button style={filterBtn}>More filters</button>
      </div>

      {/* Empty State */}
      <div style={{
        background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
        padding: '80px 40px', textAlign: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: '#E1F5EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 20px',
        }}>📞</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>No call history</div>
        <div style={{ fontSize: 13, color: C.muted }}>As users create calls and meetings, they'll display here.</div>
      </div>
    </div>
  )
}

const filterBtn = {
  padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
  color: C.text, cursor: 'pointer',
}
