import { useState, useMemo, useEffect } from 'react'
import { C, ALL_STAGES, STAGE_META } from '../constants'
import { fmtDate, initials, filterByDate } from '../helpers'
import { dbSaveNotes, loadCache, saveCache } from '../db'

// Close.com tarzı Leads sayfası — eski CRM filtreleriyle birlikte
export default function LeadsPage({ companies, contacts, selCompanies, setSelCompanies, notes, setNotes, changeStage, updateContactInfo, onNavigateDetail, initialStageFilter, setInitialStageFilter }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [showColumns, setShowColumns] = useState(false)
  const [visibleCols, setVisibleCols] = useState(['name', 'contacts', 'status', 'email', 'lastCommDate'])
  const [period, setPeriod] = useState('Tümü')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const [stageFilter, setStageFilter] = useState(initialStageFilter || 'all')

  // Pipeline'dan gelen stage filtresi
  useEffect(() => {
    if (initialStageFilter && initialStageFilter !== 'all') {
      setStageFilter(initialStageFilter)
      if (setInitialStageFilter) setInitialStageFilter('all')
    }
  }, [initialStageFilter, setInitialStageFilter])

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const allCols = [
    { key: 'name', label: 'Name', group: 'General' },
    { key: 'contacts', label: 'Contacts', group: 'General' },
    { key: 'status', label: 'Status', group: 'General' },
    { key: 'email', label: 'Email address', group: 'General' },
    { key: 'domain', label: 'Domain', group: 'General' },
    { key: 'lastCommDate', label: 'Latest comm. date', group: 'Communication' },
    { key: 'firstCommDate', label: 'First comm. date', group: 'Communication' },
    { key: 'emailCount', label: '# Emails', group: 'Emails' },
    { key: 'sentCount', label: '# Sent emails', group: 'Emails' },
  ]

  const companyList = useMemo(() => {
    let list = Object.values(companies)
    // Tarih filtresi
    list = filterByDate(list, period, startDate, endDate, 'lastContact')
    // Stage filtresi
    if (stageFilter !== 'all') list = list.filter(c => c.stage === stageFilter)
    // Arama
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.domain.includes(q))
    }
    // Sort
    const getters = { name: c => c.name.toLowerCase(), status: c => c.stage, contacts: c => c.contacts.length, date: c => new Date(c.lastContact), domain: c => c.domain }
    const getter = getters[sortKey] || getters.date
    list = [...list].sort((a, b) => {
      let va = getter(a), vb = getter(b)
      if (va instanceof Date && vb instanceof Date) return sortDir === 'asc' ? va - vb : vb - va
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va
      va = String(va); vb = String(vb)
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [companies, search, sortKey, sortDir, period, startDate, endDate, stageFilter])

  const toggleSelect = (key) => {
    setSelCompanies(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  const selectAll = () => {
    if (selCompanies.size === companyList.length) setSelCompanies(new Set())
    else setSelCompanies(new Set(companyList.map(c => c.name.toLowerCase())))
  }
  const bulkChangeStage = (newStage) => {
    selCompanies.forEach(key => { const co = companies[key]; if (co) co.contacts.forEach(ct => changeStage(ct.email, newStage)) })
  }

  // Tek şirket seçiliyse detay paneli göster
  const singleSel = selCompanies.size === 1 ? companies[[...selCompanies][0]] : null

  const SortHeader = ({ colKey, label }) => {
    const active = sortKey === colKey
    return (
      <th onClick={() => toggle(colKey)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}>
        {label} <span style={{ fontSize: 10, color: active ? C.text : '#ccc', marginLeft: 2 }}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>
      {/* DateFilter */}
      <DateFilterBar period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />

      {/* StageFilter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        <button onClick={() => setStageFilter('all')} style={{ ...stageBtn, border: `1px solid ${stageFilter === 'all' ? C.text : C.border}`, background: stageFilter === 'all' ? C.text : C.white, color: stageFilter === 'all' ? C.white : C.muted }}>Tümü</button>
        {ALL_STAGES.map(s => {
          const meta = STAGE_META[s]; const active = stageFilter === s
          return <button key={s} onClick={() => setStageFilter(active ? 'all' : s)} style={{ ...stageBtn, border: `1px solid ${active ? meta.color : C.border}`, background: active ? meta.color + '18' : C.white, color: active ? meta.color : C.muted }}>{meta.label}</button>
        })}
      </div>

      {/* Üst Araç Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnStyle, color: '#3B82F6' }}>+ Add filter</button>
          <span style={{ fontSize: 12, color: C.muted }}>{companyList.length} Leads</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', background: C.white, outline: 'none', color: C.text, width: 200 }} />
          <button style={btnStyle}>Sort</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowColumns(!showColumns)} style={{ ...btnStyle, background: showColumns ? C.bg2 : C.white }}>Columns</button>
            {showColumns && <ColumnsDropdown allCols={allCols} visibleCols={visibleCols} setVisibleCols={setVisibleCols} onClose={() => setShowColumns(false)} />}
          </div>
        </div>
      </div>

      {/* Toplu İşlem Bar */}
      {selCompanies.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '8px 14px', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{selCompanies.size} selected</span>
          <select style={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }}
            defaultValue="" onChange={e => { if (e.target.value) { bulkChangeStage(e.target.value); e.target.value = '' } }}>
            <option value="" disabled>Change status...</option>
            {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </select>
          <button onClick={() => setSelCompanies(new Set())} style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        </div>
      )}

      {/* İçerik: Tablo + Sağ Panel */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Tablo */}
        <div style={{ flex: singleSel ? '0 0 58%' : 1, overflow: 'auto', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, padding: '10px 10px 10px 14px' }}>
                  <input type="checkbox" checked={companyList.length > 0 && selCompanies.size === companyList.length} onChange={selectAll} style={{ cursor: 'pointer' }} />
                </th>
                <SortHeader colKey="name" label="Name" />
                {visibleCols.includes('contacts') && <SortHeader colKey="contacts" label="Contacts" />}
                {visibleCols.includes('status') && <th style={thStyle}>Status</th>}
                {visibleCols.includes('email') && <th style={thStyle}>Email address</th>}
                {visibleCols.includes('lastCommDate') && <SortHeader colKey="date" label="Latest comm." />}
              </tr>
            </thead>
            <tbody>
              {companyList.map(c => {
                const key = c.name.toLowerCase(); const isSelected = selCompanies.has(key)
                const primaryEmail = c.contacts[0]?.email || ''
                const extra = c.contacts.length > 1 ? ` +${c.contacts.length - 1}` : ''
                const stageMeta = STAGE_META[c.stage] || { label: c.stage, color: '#9CA3AF' }
                return (
                  <tr key={c.name} style={{ borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', background: isSelected ? '#EDF5FF' : 'transparent', transition: 'background 0.08s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.bg }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    onClick={() => toggleSelect(key)}>
                    <td style={{ padding: '10px 10px 10px 14px', width: 36 }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(key)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '10px 14px' }} onClick={e => { e.stopPropagation(); onNavigateDetail(c.name) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: C.bg2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#6B5C4C', flexShrink: 0 }}>{initials(c.name)}</div>
                        <span style={{ fontWeight: 500, color: '#3B82F6', cursor: 'pointer' }}>{c.name}</span>
                      </div>
                    </td>
                    {visibleCols.includes('contacts') && <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12 }}>{primaryEmail}{extra}</td>}
                    {visibleCols.includes('status') && (
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        <select value={c.stage} onChange={e => c.contacts.forEach(ct => changeStage(ct.email, e.target.value))}
                          style={{ fontSize: 11, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, cursor: 'pointer' }}>
                          {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                        </select>
                      </td>
                    )}
                    {visibleCols.includes('email') && <td style={{ padding: '10px 14px' }}><a href={`mailto:${primaryEmail}`} onClick={e => e.stopPropagation()} style={{ color: '#3B82F6', fontSize: 12, textDecoration: 'none' }}>{primaryEmail}</a></td>}
                    {visibleCols.includes('lastCommDate') && <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12 }}>{fmtDate(c.lastContact)}</td>}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: '8px 14px', fontSize: 11, color: '#3B82F6', cursor: 'pointer' }}>+ Calculation</td>
                {visibleCols.includes('contacts') && <td style={{ padding: '8px 14px', fontSize: 11, color: '#3B82F6', cursor: 'pointer' }}>+ Calculation</td>}
                {visibleCols.includes('status') && <td />}
                {visibleCols.includes('email') && <td />}
                {visibleCols.includes('lastCommDate') && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Sağ Detay Paneli — tek şirket seçiliyse */}
        {singleSel && (
          <div style={{ flex: '0 0 40%', overflow: 'auto', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, cursor: 'pointer', color: '#3B82F6' }} onClick={() => onNavigateDetail(singleSel.name)}>{singleSel.name}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{singleSel.domain}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: (STAGE_META[singleSel.stage]?.color || '#9CA3AF') + '20', color: STAGE_META[singleSel.stage]?.color || '#9CA3AF', fontWeight: 500 }}>{STAGE_META[singleSel.stage]?.label || singleSel.stage}</span>
                <button onClick={() => setSelCompanies(new Set())} style={{ background: 'none', border: 'none', fontSize: 16, color: C.muted, cursor: 'pointer' }}>×</button>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>Kişiler ({singleSel.contacts.length})</span>
              </div>
              {singleSel.contacts.map((c, i) => (
                <div key={c.email} style={{ padding: '6px 0', borderBottom: i < singleSel.contacts.length - 1 ? `1px solid ${C.bg2}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name || c.email}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: (STAGE_META[c.stage]?.color || '#9CA3AF') + '20', color: STAGE_META[c.stage]?.color || '#9CA3AF', fontWeight: 500 }}>{STAGE_META[c.stage]?.label}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{c.email}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Son: {fmtDate(c.lastContact)}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px' }}>
              <textarea placeholder="Not Ekle..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', resize: 'vertical', minHeight: 50, outline: 'none', background: C.bg2, color: C.text, boxSizing: 'border-box' }}
                value={notes[singleSel.domain] || ''}
                onChange={e => {
                  const val = e.target.value
                  const updated = { ...notes, [singleSel.domain]: val }
                  setNotes(updated)
                  const cache = loadCache(); if (cache) saveCache({ ...cache, notes: updated })
                  dbSaveNotes(singleSel.domain, val)
                }}
              />
            </div>
          </div>
        )}
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

function ColumnsDropdown({ allCols, visibleCols, setVisibleCols, onClose }) {
  const [search, setSearch] = useState('')
  const groups = {}
  allCols.forEach(col => { if (!groups[col.group]) groups[col.group] = []; groups[col.group].push(col) })
  const toggleCol = (key) => setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      <div style={{ position: 'absolute', top: 36, right: 0, width: 280, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200, maxHeight: 400, overflow: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {Object.entries(groups).map(([group, cols]) => (
          <div key={group}>
            <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</div>
            {cols.filter(c => !search || c.label.toLowerCase().includes(search.toLowerCase())).map(col => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12.5 }}>
                <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                {col.label}
              </label>
            ))}
          </div>
        ))}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onClose} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 6, border: 'none', background: '#3B82F6', color: C.white, cursor: 'pointer', fontFamily: 'inherit' }}>Apply</button>
        </div>
      </div>
    </>
  )
}

const btnStyle = { padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: C.text }
const stageBtn = { padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }
const dateInputStyle = { padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }
