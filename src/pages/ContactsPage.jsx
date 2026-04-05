import { useState, useMemo } from 'react'
import { C, STAGE_META } from '../constants'
import { fmtDate, initials } from '../helpers'

export default function ContactsPage({ contacts, onNavigateDetail }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = [...contacts]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name?.toLowerCase().includes(q) || c.email.includes(q) || c.company?.toLowerCase().includes(q))
    }
    const getters = {
      name: c => (c.name || c.email).toLowerCase(),
      email: c => c.email,
      company: c => (c.company || '').toLowerCase(),
      date: c => new Date(c.lastContact),
    }
    const getter = getters[sortKey] || getters.name
    list.sort((a, b) => {
      let va = getter(a), vb = getter(b)
      if (va instanceof Date && vb instanceof Date) return sortDir === 'asc' ? va - vb : vb - va
      va = String(va); vb = String(vb)
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [contacts, search, sortKey, sortDir])

  const SortHeader = ({ colKey, label }) => {
    const active = sortKey === colKey
    return (
      <th onClick={() => toggle(colKey)} style={{
        padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500,
        color: C.muted, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        borderBottom: `1px solid ${C.border}`, background: C.white,
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        {label} <span style={{ fontSize: 10, color: active ? C.text : '#ccc', marginLeft: 2 }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 76px)' }}>
      {/* Üst Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={btnStyle}>+ Add filter</button>
          <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} Contacts</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', background: C.white, outline: 'none', color: C.text, width: 200 }} />
          <button style={btnStyle}>Sort</button>
          <button style={btnStyle}>Columns</button>
        </div>
      </div>

      {/* Tablo */}
      <div style={{ flex: 1, overflow: 'auto', background: C.white, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <SortHeader colKey="name" label="Name" />
              <th style={{ padding: '10px 8px', width: 32, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: C.muted }}>✉</span>
              </th>
              <th style={{ padding: '10px 8px', width: 32, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: C.muted }}>📞</span>
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2 }}>Title</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 500, color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.white, position: 'sticky', top: 0, zIndex: 2 }}>Email address</th>
              <SortHeader colKey="company" label="Lead" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.email}
                style={{ borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer', transition: 'background 0.08s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => onNavigateDetail(c.company || c.domain)}>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontWeight: 500, color: '#3B82F6' }}>{c.name || c.email}</span>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: C.muted, textDecoration: 'none', fontSize: 13 }}>✉</a>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>📞</span>
                </td>
                <td style={{ padding: '10px 14px', color: C.muted, fontSize: 12 }}>{c.title || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: '#3B82F6', fontSize: 12, textDecoration: 'none' }}>{c.email}</a>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.company || c.domain}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 14px', fontSize: 11, color: '#3B82F6', cursor: 'pointer' }}>+ Calculation</td>
              <td /><td />
              <td style={{ padding: '8px 14px', fontSize: 11, color: '#3B82F6', cursor: 'pointer' }}>+ Calculation</td>
              <td style={{ padding: '8px 14px', fontSize: 11, color: '#3B82F6', cursor: 'pointer' }}>+ Calculation</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const btnStyle = {
  padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}
