import { useState } from 'react'
import { C } from '../constants'

// Close.com tarzı Workflows
export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [activeFilter, setActiveFilter] = useState('Active')

  const templates = [
    { icon: '📧', name: 'Cold Outreach', desc: 'Personalized emails with follow-ups, ending in a meeting request' },
    { icon: '🎉', name: 'Customer Onboarding', desc: 'Welcome, setup, feature intro, kickoff call, and week-one check-in' },
    { icon: '📋', name: 'Demo Follow-up', desc: 'Thank you, recap, pain points, case studies, and next steps' },
    { icon: '📨', name: 'Lead Nurturing', desc: 'Educate leads with insights, proof, and timely decision support' },
    { icon: '🎯', name: 'Missed Demo', desc: 'Follow-up emails and SMS if demo was a no-show' },
    { icon: '🔄', name: 'Renewal Campaign', desc: 'Renew customers with highlights, updates, incentives & escalation' },
  ]

  return (
    <div>
      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: C.white, borderRadius: 14, padding: '24px', width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Create a New Workflow</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.muted }}>x</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button style={{ ...tagBtn, background: C.bg2 }}>Choose a template...</button>
              <button style={tagBtn}>+ Start from scratch</button>
            </div>

            {/* Template Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {templates.map(t => (
                <div key={t.name} onClick={() => setShowCreate(false)} style={{
                  padding: '14px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                  cursor: 'pointer', transition: 'border-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.4 }}>{t.desc}</div>
                </div>
              ))}
            </div>

            {/* Free text */}
            <textarea
              placeholder="Or describe your intended workflow..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                border: `1px solid ${C.border}`, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif", resize: 'vertical',
                minHeight: 60, outline: 'none', boxSizing: 'border-box',
              }}
            />

            <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12, color: '#3B82F6' }}>
              What is a Workflow? ↗
            </a>
          </div>
        </div>
      )}

      {/* Üst Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 240 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.muted }}>🔍</span>
            <input placeholder="Search Workflows..." style={{
              width: '100%', padding: '6px 12px 6px 30px', borderRadius: 6,
              border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }} />
          </div>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {['Active', 'Archived'].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                padding: '5px 14px', border: 'none',
                borderLeft: f === 'Archived' ? `1px solid ${C.border}` : 'none',
                background: activeFilter === f ? C.bg2 : C.white,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: activeFilter === f ? 500 : 400,
              }}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted }}>All Users</span>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: '#3B82F6', color: C.white, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}>+ New Workflow</button>
        </div>
      </div>

      {/* Tablo */}
      <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Call Tasks</th>
              <th style={thStyle}>Stats</th>
              <th style={thStyle}>Last activity</th>
              <th style={thStyle}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {workflows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>⚡</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 6 }}>Workflows</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Create a series of steps to automate reaching out to Contacts.</div>
                  <button onClick={() => setShowCreate(true)} style={{
                    padding: '8px 20px', borderRadius: 6, border: 'none',
                    background: '#3B82F6', color: C.white, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  }}>+ New Workflow</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500,
  color: C.muted,
}

const tagBtn = {
  padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}
