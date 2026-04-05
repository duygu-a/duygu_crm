import { useState, useEffect, useMemo } from 'react'
import { C, ALL_STAGES, STAGE_META, MS, MEETING_SOURCES, HANDOFF_FIELDS, WARMTH_OPTIONS, WARMTH_COLORS, isValidLinkedin } from '../constants'

const updateContactField = async (contactId, field, value, contactsInfo, setContactsInfo) => {
  const c = contactsInfo.find(x => x.id === contactId)
  if (!c) return
  const updated = { ...c, [field]: value }
  setContactsInfo(prev => prev.map(x => x.id === contactId ? updated : x))
  await fetch('/api/contacts-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
}
import { fmtDate, initials, getDomain } from '../helpers'
import { dbSaveNotes, loadCache, saveCache } from '../db'

// Close.com tarzı Lead Detay — 2 kolon layout
export default function LeadDetailPage({ companyName, companies, contacts, notes, setNotes, changeStage, updateContactInfo, onBack }) {
  const company = useMemo(() => {
    return Object.values(companies).find(c => c.name === companyName) || null
  }, [companies, companyName])

  const companyContacts = useMemo(() => {
    if (!company) return []
    return company.contacts || []
  }, [company])

  const [companyInfo, setCompanyInfo] = useState(null)
  const [contactsInfo, setContactsInfo] = useState([])
  const [activeTimelineTab, setActiveTimelineTab] = useState('All')
  const [timelineSearch, setTimelineSearch] = useState('')

  // Şirket bilgilerini yükle
  useEffect(() => {
    if (!companyName) return
    fetch(`/api/companies-info?name=${encodeURIComponent(companyName)}`)
      .then(r => r.json())
      .then(rows => { if (rows.length > 0) setCompanyInfo(rows[0]) })
      .catch(() => {})
    fetch(`/api/contacts-info?company=${encodeURIComponent(companyName)}`)
      .then(r => r.json())
      .then(setContactsInfo)
      .catch(() => {})
  }, [companyName])

  if (!company) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Lead not found</div>
        <button onClick={onBack} style={btnStyle}>← Back to Leads</button>
      </div>
    )
  }

  const stageMeta = STAGE_META[company.stage] || { label: company.stage, color: '#9CA3AF' }

  // Timeline entries — email konuşmaları + status değişiklikleri
  const timelineEntries = useMemo(() => {
    const entries = []

    // Email konuşmaları
    companyContacts.forEach(c => {
      if (c.subject) {
        entries.push({
          type: 'email',
          date: c.lastContact,
          subject: c.subject,
          snippet: c.snippet,
          from: c.name || c.email,
          email: c.email,
          sentCount: c.sentCount,
          receivedCount: c.receivedCount,
        })
      }
    })

    // Status change (son)
    entries.push({
      type: 'status_change',
      date: company.lastContact,
      from: 'Reached Out',
      to: stageMeta.label,
    })

    // Sort by date desc
    entries.sort((a, b) => new Date(b.date) - new Date(a.date))
    return entries
  }, [companyContacts, company, stageMeta])

  const filteredTimeline = timelineEntries.filter(e => {
    if (activeTimelineTab === 'Conversations') return e.type === 'email'
    if (activeTimelineTab === 'Notes & Summaries') return e.type === 'note'
    return true
  })

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {/* Logo */}
          <div style={{ width: 48, height: 48, borderRadius: 10, background: C.bg2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#6B5C4C' }}>
            {initials(company.name)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{company.name}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {/* Status dropdown */}
              <select
                value={company.stage}
                onChange={e => company.contacts.forEach(ct => changeStage(ct.email, e.target.value))}
                style={{
                  fontSize: 11.5, padding: '3px 8px', borderRadius: 20,
                  border: 'none', background: stageMeta.color, color: C.white,
                  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
              </select>
              <span style={{ fontSize: 12, color: C.muted }}>•••</span>
            </div>
          </div>
        </div>

        {/* Sağ aksiyon butonları — Close.com tarzı */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['Note', 'Email', 'SMS', 'Call'].map(action => (
            <button key={action} style={{
              padding: '7px 16px', borderRadius: 6,
              border: `1px solid ${C.border}`, background: C.white,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", color: C.text,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {action === 'Note' && '📝'}
              {action === 'Email' && '✉'}
              {action === 'SMS' && '💬'}
              {action === 'Call' && '📞'}
              {action}
            </button>
          ))}
          <button style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, cursor: 'pointer', color: C.muted }}>Activity ▾</button>
        </div>
      </div>

      {/* 2 Kolon Layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* SOL PANEL — Details */}
        <div style={{ width: 340, flexShrink: 0 }}>
          {/* Details / Files tabs */}
          <div style={{ display: 'flex', gap: 16, borderBottom: `2px solid ${C.border}`, marginBottom: 16 }}>
            {['Details', 'Files'].map(tab => (
              <span key={tab} style={{
                fontSize: 13, fontWeight: 500, paddingBottom: 8, cursor: 'pointer',
                borderBottom: tab === 'Details' ? `2px solid ${C.text}` : 'none',
                color: tab === 'Details' ? C.text : C.muted, marginBottom: -2,
              }}>{tab}</span>
            ))}
          </div>

          {/* ABOUT */}
          <Section title="ABOUT" icon="ℹ">
            <DetailRow icon="📍" placeholder="Add address..." />
            <DetailRow icon="🔗" value={companyInfo?.website || company.domain} link />
            <DetailRow icon="≡" placeholder="Add description..." />
          </Section>

          {/* TASKS */}
          <Section title="TASKS" icon="🎯" count={0} hasAdd>
            <div style={{ padding: '8px 0', fontSize: 12, color: C.muted }}>No tasks</div>
          </Section>

          {/* OPPORTUNITIES */}
          <Section title="OPPORTUNITIES" icon="🏆" count={company.stage === 'meeting_held' ? 1 : 0} hasAdd>
            {company.stage === 'meeting_held' && (
              <div style={{ padding: '10px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#6B5C4C' }}>DA</div>
                  <span style={{ fontSize: 12, color: C.muted }}>100%</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.muted }}>🏆</span> Meeting Held
                </div>
              </div>
            )}
          </Section>

          {/* CONTACTS — warmth badge + quick note */}
          <Section title="CONTACTS" icon="👤" count={companyContacts.length} hasAdd hasSearch>
            {companyContacts.map((c, i) => {
              const ci = contactsInfo.find(x => x.email === c.email)
              return (
                <div key={c.email} style={{ padding: '8px 0', borderBottom: i < companyContacts.length - 1 ? `1px solid ${C.bg2}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#6B5C4C', flexShrink: 0 }}>{initials(c.name)}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name || c.email}</span>
                      {/* Warmth badge */}
                      {ci && (
                        <span onClick={() => {
                          const idx = WARMTH_OPTIONS.indexOf(ci.warmth || 'Nötr')
                          const next = WARMTH_OPTIONS[(idx + 1) % WARMTH_OPTIONS.length]
                          updateContactField(ci.id, 'warmth', next, contactsInfo, setContactsInfo)
                        }} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: (WARMTH_COLORS[ci?.warmth] || '#F59E0B') + '20', color: WARMTH_COLORS[ci?.warmth] || '#F59E0B', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                          {ci?.warmth || 'Nötr'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={`mailto:${c.email}`} style={{ color: C.muted, textDecoration: 'none', fontSize: 13 }}>✉</a>
                      <span style={{ color: C.muted, fontSize: 13 }}>📞</span>
                    </div>
                  </div>
                  {ci?.title && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1, marginLeft: 30 }}>{ci.title}</div>}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1, marginLeft: 30 }}>{c.email}</div>
                  {/* Quick note */}
                  {ci && (
                    <input style={{ width: 'calc(100% - 30px)', marginLeft: 30, border: 'none', background: 'transparent', fontSize: 10.5, color: C.muted, outline: 'none', padding: '2px 0', fontFamily: 'inherit' }}
                      placeholder="Kısa not ekle..."
                      value={ci.quick_note || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateContactField(ci.id, 'quick_note', e.target.value, contactsInfo, setContactsInfo)} />
                  )}
                </div>
              )
            })}
          </Section>

          {/* Handoff Notları — Meeting Held şirketler için */}
          {company.stage === 'meeting_held' && companyInfo && (() => {
            const handoff = (typeof companyInfo.handoff_notes === 'string' ? (() => { try { return JSON.parse(companyInfo.handoff_notes) } catch { return {} } })() : companyInfo.handoff_notes) || {}
            const handoffFilled = HANDOFF_FIELDS.filter(f => handoff[f]?.trim()).length
            return (
              <Section title="HANDOFF NOTU" icon="📋" count={`${handoffFilled}/${HANDOFF_FIELDS.length}`}>
                {HANDOFF_FIELDS.map(f => (
                  <div key={f} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>{f}:</div>
                    <input style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: C.bg }} placeholder={f + '...'} value={handoff[f] || ''} onChange={e => {
                      const updated = { ...companyInfo, handoff_notes: JSON.stringify({ ...handoff, [f]: e.target.value }) }
                      setCompanyInfo(updated)
                      fetch('/api/companies-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
                    }} />
                  </div>
                ))}
              </Section>
            )
          })()}

          {/* Note */}
          <div style={{ marginTop: 12 }}>
            <textarea
              placeholder="Add note..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', minHeight: 50, outline: 'none', background: C.bg2, color: C.text, boxSizing: 'border-box' }}
              value={notes[company.domain] || ''}
              onChange={e => {
                const val = e.target.value
                const updated = { ...notes, [company.domain]: val }
                setNotes(updated)
                const cache = loadCache()
                if (cache) saveCache({ ...cache, notes: updated })
                dbSaveNotes(company.domain, val)
              }}
            />
          </div>
        </div>

        {/* SAĞ PANEL — Activity Timeline */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Summarize Lead */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✨ Summarize Lead</span>
            <span style={{ fontSize: 11, color: C.muted }}>Get a snapshot of key details and activities</span>
          </div>

          {/* Timeline Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            {['All', 'Important', 'Conversations', 'Notes & Summaries'].map(tab => (
              <button key={tab} onClick={() => setActiveTimelineTab(tab)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: activeTimelineTab === tab ? C.bg2 : 'transparent',
                color: activeTimelineTab === tab ? C.text : C.muted,
                fontSize: 12, fontWeight: activeTimelineTab === tab ? 500 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{tab}</button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white }}>
              <span style={{ fontSize: 12, color: C.muted }}>🔍</span>
              <input value={timelineSearch} onChange={e => setTimelineSearch(e.target.value)}
                placeholder="Search keywords, people, and activities"
                style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', fontFamily: 'inherit', color: C.text, width: 220 }} />
            </div>
          </div>

          {/* Timeline Entries */}
          <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
            {filteredTimeline.map((entry, i) => (
              <div key={i} style={{ padding: '14px 18px', borderBottom: i < filteredTimeline.length - 1 ? `1px solid ${C.bg2}` : 'none' }}>
                {entry.type === 'status_change' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: C.muted, fontSize: 14 }}>🔄</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12.5 }}>Status changed from </span>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#6B7280', color: C.white, fontWeight: 500 }}>{entry.from}</span>
                      <span style={{ fontSize: 12.5 }}> → </span>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: stageMeta.color, color: C.white, fontWeight: 500 }}>{entry.to}</span>
                    </div>
                    <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(entry.date)}</span>
                  </div>
                )}
                {entry.type === 'email' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>✉</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.subject || '(no subject)'}</span>
                          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 12 }}>{fmtDate(entry.date)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          <span style={{ fontWeight: 500, color: C.text }}>{entry.from}</span>
                          {entry.snippet && <span> — {entry.snippet.slice(0, 120)}...</span>}
                        </div>
                        {entry.sentCount > 1 && (
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                            {entry.sentCount} sent · {entry.receivedCount} received
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredTimeline.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No activity yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Section bileşeni — Close.com sol panel bölümleri
function Section({ title, icon, count, hasAdd, hasSearch, children }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 8 }}>
      <div onClick={() => setCollapsed(!collapsed)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.muted }}>{collapsed ? '▶' : '▼'}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{icon} {title}</span>
          {count !== undefined && <span style={{ fontSize: 10, color: C.muted }}>{count}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasSearch && <span style={{ fontSize: 12, color: C.muted, cursor: 'pointer' }}>🔍</span>}
          {hasAdd && <span style={{ fontSize: 14, color: C.muted, cursor: 'pointer' }}>+</span>}
        </div>
      </div>
      {!collapsed && children}
    </div>
  )
}

function DetailRow({ icon, value, placeholder, link }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: C.muted, width: 16, textAlign: 'center' }}>{icon}</span>
      {value ? (
        link ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none' }}>{value}</a>
        : <span style={{ fontSize: 12 }}>{value}</span>
      ) : (
        <span style={{ fontSize: 12, color: C.muted }}>{placeholder}</span>
      )}
    </div>
  )
}

const btnStyle = {
  padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}
