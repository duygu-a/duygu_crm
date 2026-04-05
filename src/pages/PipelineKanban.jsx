import { useState, useMemo, useRef } from 'react'
import { C, ALL_STAGES, STAGE_META, ACTIVE_STAGES, CLOSED_STAGES } from '../constants'
import { fmtDate, initials, filterByDate } from '../helpers'

// Close.com tarzı Pipeline — Kanban Board + Drag & Drop + Şirket bazlı
export default function PipelineKanban({ contacts, changeStage, onNavigateDetail, onNavigateCompanies }) {
  const [viewMode, setViewMode] = useState('pipeline')
  const [period, setPeriod] = useState('Tümü')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const [searchQ, setSearchQ] = useState('')
  const [channel, setChannel] = useState('Email')
  const [selectedStage, setSelectedStage] = useState(null)
  const [hideEmpty, setHideEmpty] = useState(false)

  // Drag state
  const [dragCompany, setDragCompany] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)

  const fc = useMemo(() => filterByDate(contacts, period, startDate, endDate), [contacts, period, startDate, endDate])
  const filtered = useMemo(() => {
    if (!searchQ) return fc
    const q = searchQ.toLowerCase()
    return fc.filter(c => c.name?.toLowerCase().includes(q) || c.email.includes(q) || c.company?.toLowerCase().includes(q))
  }, [fc, searchQ])

  // Şirket bazlı gruplama — her stage için
  const columns = useMemo(() => {
    return ACTIVE_STAGES.map(stage => {
      const meta = STAGE_META[stage]
      const stageContacts = filtered.filter(c => c.stage === stage)
      const companyMap = {}
      stageContacts.forEach(c => {
        const key = (c.company || c.domain).toLowerCase()
        if (!companyMap[key]) companyMap[key] = { name: c.company || c.domain, contacts: [], lastContact: c.lastContact, key }
        companyMap[key].contacts.push(c)
        if (new Date(c.lastContact) > new Date(companyMap[key].lastContact)) companyMap[key].lastContact = c.lastContact
      })
      return {
        key: stage, label: meta.label, color: meta.color,
        companies: Object.values(companyMap).sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact)),
        count: Object.keys(companyMap).length, contactCount: stageContacts.length,
      }
    })
  }, [filtered])

  // Boş olmayan kolonlar (opsiyonel filtre)
  const visibleColumns = hideEmpty ? columns.filter(c => c.count > 0) : columns

  // Kapalı stage'ler
  const closedGroups = useMemo(() => {
    return CLOSED_STAGES.map(stage => {
      const meta = STAGE_META[stage]
      const sc = filtered.filter(c => c.stage === stage)
      const companySet = new Set(sc.map(c => (c.company || c.domain).toLowerCase()))
      return { key: stage, name: meta.label, count: sc.length, companyCount: companySet.size, contacts: sc, color: meta.color }
    })
  }, [filtered])

  // Drag & Drop handlers
  const handleDragStart = (companyData, fromStage) => {
    setDragCompany({ ...companyData, fromStage })
  }

  const handleDragOver = (e, stageKey) => {
    e.preventDefault()
    setDragOverStage(stageKey)
  }

  const handleDrop = (e, toStage) => {
    e.preventDefault()
    if (dragCompany && dragCompany.fromStage !== toStage) {
      // Şirketteki tüm kişilerin stage'ini değiştir
      dragCompany.contacts.forEach(c => changeStage(c.email, toStage))
    }
    setDragCompany(null)
    setDragOverStage(null)
  }

  const handleDragEnd = () => {
    setDragCompany(null)
    setDragOverStage(null)
  }

  if (viewMode === 'list') {
    return <PipelineList contacts={filtered} changeStage={changeStage} onNavigateDetail={onNavigateDetail} onSwitchView={() => setViewMode('pipeline')} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>
      {/* DateFilter */}
      <DateFilterBar period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />

      {/* Filtre Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['Email', 'LinkedIn', 'Smartlead'].map(f => (
            <button key={f} onClick={() => setChannel(f)} style={{
              padding: '5px 14px', borderRadius: 6,
              border: `1px solid ${channel === f ? C.text : C.border}`,
              background: channel === f ? C.text : C.white,
              color: channel === f ? C.white : C.muted,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>{f}</button>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, marginLeft: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
            Boşları gizle
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Kişi, şirket ara..."
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', background: C.white, outline: 'none', color: C.text, width: 200 }} />
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setViewMode('pipeline')} style={{ padding: '5px 12px', border: 'none', background: C.bg2, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Pipeline</button>
            <button onClick={() => setViewMode('list')} style={{ padding: '5px 12px', border: 'none', borderLeft: `1px solid ${C.border}`, background: C.white, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>List</button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'flex', gap: 6, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {visibleColumns.map(col => (
          <div key={col.key}
            onDragOver={e => handleDragOver(e, col.key)}
            onDrop={e => handleDrop(e, col.key)}
            onDragLeave={() => setDragOverStage(null)}
            style={{
              flex: `1 1 ${100 / visibleColumns.length}%`, minWidth: 130, maxWidth: 280,
              display: 'flex', flexDirection: 'column',
              background: dragOverStage === col.key ? col.color + '10' : 'transparent',
              borderRadius: 8, transition: 'background 0.15s',
              border: dragOverStage === col.key ? `2px dashed ${col.color}` : '2px solid transparent',
            }}>
            {/* Kolon başlığı */}
            <div style={{ marginBottom: 6, padding: '0 4px' }}>
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: col.color, color: C.white, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                {col.label}
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>
                {col.count} şirket · {col.contactCount} kişi
              </div>
            </div>

            {/* Kartlar */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5, padding: '0 2px' }}>
              {col.companies.length === 0 && (
                <div style={{ padding: 10, textAlign: 'center', color: C.muted, fontSize: 10, background: C.white, borderRadius: 6, border: `1px dashed ${C.border}` }}>—</div>
              )}
              {col.companies.map(co => (
                <div key={co.name}
                  draggable
                  onDragStart={() => handleDragStart(co, col.key)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onNavigateDetail(co.name)}
                  style={{
                    background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
                    padding: '8px 10px', cursor: 'grab', transition: 'box-shadow 0.1s, opacity 0.15s',
                    opacity: dragCompany?.name === co.name ? 0.4 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  {/* Şirket adı */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: C.bg2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: '#6B5C4C', flexShrink: 0 }}>
                      {initials(co.name)}
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: '#3B82F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</span>
                  </div>
                  {/* Kişi sayısı + son iletişim */}
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {co.contacts.length} kişi · {fmtDate(co.lastContact)}
                  </div>
                  {/* İlk kişi emaili */}
                  <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {co.contacts[0]?.name || co.contacts[0]?.email}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Kapalı / Pasif */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 6px', color: C.muted }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>Kapalı / Pasif</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
        {closedGroups.map(s => (
          <div key={s.key}
            onDragOver={e => handleDragOver(e, s.key)}
            onDrop={e => handleDrop(e, s.key)}
            onDragLeave={() => setDragOverStage(null)}
            onClick={() => setSelectedStage(selectedStage === s.key ? null : s.key)}
            style={{
              background: dragOverStage === s.key ? s.color + '15' : C.bg2,
              borderRadius: 8, border: `1.5px solid ${selectedStage === s.key ? C.text : dragOverStage === s.key ? s.color : C.border}`,
              cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'border-color 0.12s, background 0.12s', opacity: 0.85,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: s.color }} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{s.name}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: s.companyCount > 0 ? C.text : C.muted }}>{s.companyCount}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{s.count} kişi</div>
            </div>
          </div>
        ))}
      </div>

      {/* Seçilen Kapalı Stage detayı */}
      {selectedStage && (() => {
        const sg = closedGroups.find(g => g.key === selectedStage)
        if (!sg || sg.contacts.length === 0) return null
        const companyMap = {}
        sg.contacts.forEach(c => {
          const key = (c.company || c.domain).toLowerCase()
          if (!companyMap[key]) companyMap[key] = { name: c.company || c.domain, contacts: [], lastContact: c.lastContact }
          companyMap[key].contacts.push(c)
          if (new Date(c.lastContact) > new Date(companyMap[key].lastContact)) companyMap[key].lastContact = c.lastContact
        })
        const companies = Object.values(companyMap).sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact))
        return (
          <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8, maxHeight: 200, overflow: 'auto' }}>
            <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.white, zIndex: 1 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{sg.name} — {companies.length} Şirket</span>
              <button onClick={() => setSelectedStage(null)} style={{ background: 'none', border: 'none', fontSize: 14, color: C.muted, cursor: 'pointer' }}>×</button>
            </div>
            {companies.slice(0, 30).map(co => (
              <div key={co.name} onClick={() => onNavigateDetail(co.name)} style={{
                padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', fontSize: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 500 }}>{co.name}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{co.contacts.length} kişi</span>
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(co.lastContact)}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// Pipeline List View
function PipelineList({ contacts, changeStage, onNavigateDetail, onSwitchView }) {
  const opportunities = useMemo(() => {
    const companyMap = {}
    contacts.forEach(c => {
      const key = (c.company || c.domain).toLowerCase()
      if (!companyMap[key]) companyMap[key] = { name: c.company || c.domain, contacts: [], stage: c.stage, lastContact: c.lastContact }
      companyMap[key].contacts.push(c)
      if (new Date(c.lastContact) > new Date(companyMap[key].lastContact)) {
        companyMap[key].lastContact = c.lastContact; companyMap[key].stage = c.stage
      }
    })
    return Object.values(companyMap).sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact))
  }, [contacts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={filterBtn}>All Leads</button>
          <button style={filterBtn}>All Statuses</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={filterBtn}>Export</button>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={onSwitchView} style={{ padding: '5px 12px', border: 'none', background: C.white, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Pipeline</button>
            <button style={{ padding: '5px 12px', border: 'none', borderLeft: `1px solid ${C.border}`, background: C.bg2, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>List</button>
          </div>
        </div>
      </div>
      <div style={{ background: C.bg2, borderRadius: 8, padding: '14px 20px', display: 'flex', gap: 40, marginBottom: 12 }}>
        <div><div style={{ fontSize: 11, color: C.muted }}>Opportunities:</div><div style={{ fontSize: 22, fontWeight: 600 }}>{opportunities.length}</div></div>
        <div><div style={{ fontSize: 11, color: C.muted }}>Total Value:</div><div style={{ fontSize: 22, fontWeight: 600 }}>${(opportunities.length * 8000).toLocaleString()}</div></div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Lead', 'Kişi Sayısı', 'Status', 'Son İletişim', 'User'].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {opportunities.map(opp => {
              const meta = STAGE_META[opp.stage] || { label: opp.stage, color: '#9CA3AF' }
              return (
                <tr key={opp.name} style={{ borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer' }}
                  onClick={() => onNavigateDetail(opp.name)}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#3B82F6' }}>{opp.name}</td>
                  <td style={{ padding: '10px 14px', color: C.muted }}>{opp.contacts.length} kişi</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: meta.color + '20', color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: C.muted }}>{fmtDate(opp.lastContact)}</td>
                  <td style={{ padding: '10px 14px', color: C.muted }}>Duygu Atayan</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DateFilterBar({ period, setPeriod, startDate, setStartDate, endDate, setEndDate }) {
  const presets = ['Bugün', 'Bu Hafta', 'Bu Ay', 'Tümü', 'Özel Aralık']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {presets.map(p => (
        <button key={p} onClick={() => setPeriod(p)} style={{
          padding: '5px 14px', borderRadius: 6, border: `1px solid ${period === p ? C.text : C.border}`,
          background: period === p ? C.text : C.white, color: period === p ? C.white : C.muted,
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>{p}</button>
      ))}
      {period === 'Özel Aralık' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInputStyle} />
          <span style={{ fontSize: 11, color: C.muted }}>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInputStyle} />
        </div>
      )}
    </div>
  )
}

const filterBtn = { padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: C.text }
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2 }
const dateInputStyle = { padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }
