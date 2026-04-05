import { useState, useMemo } from 'react'
import { C, STAGE_META, ALL_STAGES } from '../constants'
import { fmtDate, initials, businessDaysSince } from '../helpers'

// Close.com tarzı Inbox — görev merkezi
export default function InboxPage({ contacts, onNavigateDetail }) {
  const [activeTab, setActiveTab] = useState('Primary')
  const [subView, setSubView] = useState('inbox') // inbox | done | future

  const tabs = [
    { key: 'Primary', label: 'Primary' },
    { key: 'Emails', label: 'Emails' },
    { key: 'Calls', label: 'Calls' },
    { key: 'Messages', label: 'Messages' },
    { key: 'Tasks', label: 'Tasks' },
    { key: 'Reminders', label: 'Reminders' },
    { key: 'Potential', label: 'Potential Contacts' },
  ]

  // İnbox verileri — follow-up gerekli, needs_reply, interested
  const inboxItems = useMemo(() => {
    const items = []

    // Needs Reply — email sekmesi
    contacts.filter(c => c.stage === 'needs_reply').forEach(c => {
      items.push({ type: 'email', lead: c.company || c.domain, contact: c.email, task: `Reply to ${c.name || c.email}`, stage: c.stage, date: c.lastContact, name: c.name })
    })

    // Follow-up gerekli — task sekmesi
    contacts.filter(c => ['follow_up_1', 'follow_up_2'].includes(c.stage) && businessDaysSince(c.lastContact) >= 2).forEach(c => {
      items.push({ type: 'task', lead: c.company || c.domain, contact: c.email, task: `Follow up with ${c.name || c.email}`, stage: c.stage, date: c.lastContact, name: c.name })
    })

    // Interested — follow up on opportunity
    contacts.filter(c => c.stage === 'interested').forEach(c => {
      items.push({ type: 'reminder', lead: c.company || c.domain, contact: c.email, task: 'Follow up on opportunity', stage: c.stage, date: c.lastContact, name: c.name })
    })

    // Processing meeting
    contacts.filter(c => c.stage === 'processing_meeting').forEach(c => {
      items.push({ type: 'task', lead: c.company || c.domain, contact: c.email, task: 'Schedule meeting', stage: c.stage, date: c.lastContact, name: c.name })
    })

    items.sort((a, b) => new Date(b.date) - new Date(a.date))
    return items
  }, [contacts])

  // Tab filtering
  const filteredItems = inboxItems.filter(item => {
    if (activeTab === 'Primary') return true
    if (activeTab === 'Emails') return item.type === 'email'
    if (activeTab === 'Tasks') return item.type === 'task'
    if (activeTab === 'Reminders') return item.type === 'reminder'
    return false
  })

  const tabCounts = {
    Primary: inboxItems.length,
    Emails: inboxItems.filter(i => i.type === 'email').length,
    Tasks: inboxItems.filter(i => i.type === 'task').length,
    Reminders: inboxItems.filter(i => i.type === 'reminder').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
        {tabs.map(tab => {
          const count = tabCounts[tab.key]
          const isActive = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: isActive ? C.bg2 : 'transparent',
              color: isActive ? C.text : C.muted,
              fontSize: 12, fontWeight: isActive ? 500 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {tab.key === 'Emails' && '✉ '}
              {tab.key === 'Calls' && '📞 '}
              {tab.key === 'Messages' && '💬 '}
              {tab.key === 'Tasks' && '☑ '}
              {tab.key === 'Reminders' && '⏰ '}
              {tab.key === 'Potential' && '✨ '}
              {tab.label}
              {count > 0 && <span style={{
                fontSize: 10, fontWeight: 600, color: C.white,
                background: isActive ? C.text : C.muted, borderRadius: 10,
                padding: '1px 6px', minWidth: 16, textAlign: 'center', marginLeft: 4,
              }}>{count}</span>}
            </button>
          )
        })}

        <div style={{ flex: 1 }} />
        <button style={filterBtn}>Filters</button>
        <button style={filterBtn}>Due date</button>
      </div>

      {/* Select All */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '4px 0' }}>
        <input type="checkbox" style={{ cursor: 'pointer' }} />
        <span style={{ fontSize: 12, color: C.muted }}>Select all</span>
      </div>

      {/* İnbox Listesi */}
      <div style={{ flex: 1, overflow: 'auto', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
        {filteredItems.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>Inbox Zero!</div>
            <div style={{ fontSize: 13 }}>No pending tasks right now.</div>
          </div>
        )}
        {filteredItems.map((item, i) => {
          const meta = STAGE_META[item.stage] || { label: item.stage, color: '#9CA3AF' }
          return (
            <div key={i}
              onClick={() => onNavigateDetail(item.lead)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                borderBottom: i < filteredItems.length - 1 ? `1px solid ${C.bg2}` : 'none',
                cursor: 'pointer', transition: 'background 0.08s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {/* Checkbox */}
              <input type="checkbox" onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', flexShrink: 0 }} />

              {/* İkon */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: item.type === 'email' ? '#E6F1FB' : item.type === 'reminder' ? '#EEEDFE' : '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {item.type === 'email' ? '✉' : item.type === 'reminder' ? '⏰' : '☑'}
              </div>

              {/* Lead + Kişi */}
              <div style={{ minWidth: 140, maxWidth: 200, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.lead}</div>
                <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.contact}</div>
              </div>

              {/* Görev açıklaması */}
              <div style={{ flex: 1, fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {item.task}
              </div>

              {/* Attention dot */}
              {(item.type === 'reminder' || item.stage === 'needs_reply') && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
              )}

              {/* Status badge */}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: meta.color + '18', color: meta.color,
                textTransform: 'uppercase', letterSpacing: '0.02em', flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>{meta.label}</span>

              {/* Tarih */}
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, minWidth: 55, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDate(item.date)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const filterBtn = {
  padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}
