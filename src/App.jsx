import { useState, useEffect, useCallback } from 'react'
import {
  getToken, login, handleOAuthRedirect, clearToken,
  getProfile, fetchAllMessages, getMessage, modifyThread, listLabels,
} from './gmail.js'
import {
  classifyMessage, extractContact,
  STAGE_META, PIPELINE_STAGES, OUTCOME_STAGES,
  LABEL_IDS, ALL_LABEL_IDS, STAGE_TO_LABEL, LABEL_TO_STAGE,
  MY_EMAIL,
} from './classify.js'
import {
  loadCache, saveCache, clearCache, buildCompanies, mergeContacts,
} from './cache.js'

// ── YARDIMCILAR ───────────────────────────────────────────────
const KPI = { meetings: 156, revenue: 310000, pipeline: 3100000 }

function daysSince(d) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' })
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── STAGE PILL ────────────────────────────────────────────────
function StagePill({ stage, small }) {
  const m = STAGE_META[stage] || { label: stage, color: '#9CA3AF' }
  return (
    <span style={{
      fontSize: small ? 10 : 11, padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 20, background: m.color + '22', color: m.color,
      fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-block',
    }}>{m.label}</span>
  )
}

// ── LOGIN EKRANI ──────────────────────────────────────────────
function LoginScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF4EB' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>Duygu CRM</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Cambly Business — SDR Pipeline</div>
        <button onClick={login} style={{
          background: '#050500', color: '#FAF4EB', border: 'none',
          padding: '12px 32px', borderRadius: 10, fontSize: 14,
          fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Gmail ile Giriş Yap
        </button>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 16 }}>
          Sadece duygu@cambly.com hesabı ile giriş yapın
        </div>
      </div>
    </div>
  )
}

// ── ANA UYGULAMA ──────────────────────────────────────────────
export default function App() {
  const [authed,  setAuthed]  = useState(false)
  const [tab,     setTab]     = useState('Dashboard')
  const [contacts,setContacts]= useState([])
  const [companies,setCompanies]=useState({})
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState('')
  const [progress,setProgress]= useState(0)
  const [lastSync,setLastSync]= useState(null)
  const [searchQ, setSearchQ] = useState('')
  const [selCompany,setSelCompany]=useState(null)
  const [expanded, setExpanded]=useState(null)
  const [notes,   setNotes]   = useState({})
  const [pipeFilter,setPipeFilter]=useState('pipeline')

  // OAuth redirect kontrol
  useEffect(() => {
    if (handleOAuthRedirect()) setAuthed(true)
    else if (getToken())       setAuthed(true)
  }, [])

  // Cache yükle
  useEffect(() => {
    if (!authed) return
    const cache = loadCache()
    if (cache) {
      setContacts(cache.contacts || [])
      setCompanies(cache.companies || {})
      setLastSync(cache.savedAt)
      setStatus('Cache yüklendi')
    } else {
      setStatus("İlk kullanım — 'Tam Tarama' ile başla")
    }
  }, [authed])

  // Mesajları işle
  const processMessages = useCallback((msgs) => {
    const all = []
    msgs.forEach(msg => {
      const contacts = extractContact(msg)
      contacts.forEach(c => all.push(c))
    })
    // Her email için en son mesajı tut
    const map = {}
    all.forEach(c => {
      const key = c.email
      if (!map[key]) {
        map[key] = c
      } else {
        if (new Date(c.lastContact) > new Date(map[key].lastContact)) {
          map[key] = { ...c, firstContact: map[key].firstContact }
        }
      }
    })
    return Object.values(map)
  }, [])

  // TAM TARAMA
  const fullScan = useCallback(async () => {
    setLoading(true); setProgress(2); setStatus('Gmail taranıyor...')
    try {
      const msgList = await fetchAllMessages(`from:${MY_EMAIL}`, (found, est) => {
        setStatus(`${found} mesaj bulundu...`)
        setProgress(Math.min(60, Math.round((found / (est || 500)) * 60)))
      })
      setStatus(`${msgList.length} mesaj işleniyor...`); setProgress(65)

      // Batch olarak detayları çek
      const BATCH = 50
      const detailed = []
      for (let i = 0; i < msgList.length; i += BATCH) {
        const batch = msgList.slice(i, i + BATCH)
        const results = await Promise.allSettled(batch.map(m => getMessage(m.id)))
        results.forEach(r => { if (r.status === 'fulfilled') detailed.push(r.value) })
        const pct = 65 + Math.round((i / msgList.length) * 30)
        setProgress(pct)
        setStatus(`${detailed.length} / ${msgList.length} mesaj işlendi...`)
      }

      const ctcts   = processMessages(detailed)
      const comps   = buildCompanies(ctcts)
      setContacts(ctcts); setCompanies(comps)
      setLastSync(Date.now()); setProgress(100)
      saveCache(ctcts, comps, null)
      setStatus(`✓ ${ctcts.length} kişi, ${Object.keys(comps).length} şirket`)
    } catch (e) {
      setStatus('Hata: ' + e.message)
      if (e.message.includes('Token')) { clearToken(); setAuthed(false) }
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }, [processMessages])

  // DELTA SYNC
  const deltaSync = useCallback(async () => {
    setLoading(true); setStatus('Yeni mesajlar kontrol ediliyor...')
    try {
      const since = Math.floor((Date.now() - 48 * 3600000) / 1000)
      const msgList = await fetchAllMessages(`from:${MY_EMAIL} after:${since}`)
      if (msgList.length === 0) { setStatus('✓ Yeni mesaj yok'); setLoading(false); return }

      const detailed = await Promise.allSettled(msgList.map(m => getMessage(m.id)))
      const msgs = detailed.filter(r => r.status === 'fulfilled').map(r => r.value)
      const newCtcts = processMessages(msgs)

      setContacts(prev => {
        const merged = mergeContacts(prev, newCtcts)
        const comps  = buildCompanies(merged)
        setCompanies(comps)
        saveCache(merged, comps, null)
        return merged
      })
      setLastSync(Date.now())
      setStatus(`✓ ${msgList.length} yeni mesaj senkronize edildi`)
    } catch (e) {
      setStatus('Hata: ' + e.message)
    } finally { setLoading(false) }
  }, [processMessages])

  // Stage değiştir — hem cache hem Gmail
  const changeStage = useCallback(async (email, newStage) => {
    setContacts(prev => {
      const updated = prev.map(c => c.email === email ? { ...c, stage: newStage } : c)
      const comps   = buildCompanies(updated)
      setCompanies(comps)
      saveCache(updated, comps, null)
      return updated
    })
    // Gmail'e de yaz
    const contact = contacts.find(c => c.email === email)
    if (contact?.threadId) {
      const newLabelId = STAGE_TO_LABEL[newStage]
      if (newLabelId) {
        try {
          await modifyThread(contact.threadId, [newLabelId], ALL_LABEL_IDS.filter(id => id !== newLabelId))
        } catch (e) { console.warn('Gmail label güncelleme hatası:', e) }
      }
    }
  }, [contacts])

  const logout = () => { clearToken(); clearCache(); setAuthed(false) }

  if (!authed) return <LoginScreen />

  const TABS = ['Dashboard','Pipeline','Daily','Companies','Performans']

  const filteredContacts = contacts.filter(c => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
  })

  const stats = {
    total:     contacts.length,
    meetings:  contacts.filter(c => c.stage === 'meeting_held').length,
    scheduled: contacts.filter(c => c.stage === 'meeting_scheduled').length,
    active:    contacts.filter(c => ['reached_out','follow_up_1','follow_up_2','processing_meeting'].includes(c.stage)).length,
    reply:     contacts.filter(c => c.stage === 'needs_reply').length,
  }

  const overdueFollowUp = contacts.filter(c =>
    ['follow_up_1','follow_up_2'].includes(c.stage) && daysSince(c.lastContact) >= 3
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF4EB', minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={S.logo}>Duygu CRM</span>
          <nav style={{ display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ ...S.navBtn, ...(tab === t ? S.navActive : {}) }}>{t}</button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status && <span style={S.statusBadge}>{status}</span>}
          {lastSync && <span style={{ fontSize: 11, color: '#888' }}>{new Date(lastSync).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>}
          <button style={S.btnSm} onClick={deltaSync} disabled={loading}>↻ Sync</button>
          <button style={{ ...S.btnSm, ...S.btnDark }} onClick={fullScan} disabled={loading}>Tam Tarama</button>
          <button style={{ ...S.btnSm, color: '#888', border: 'none', background: 'none' }} onClick={logout}>Çıkış</button>
        </div>
      </header>

      {/* PROGRESS */}
      {progress > 0 && (
        <div style={{ height: 3, background: '#E4DBD3', position: 'sticky', top: 52, zIndex: 99 }}>
          <div style={{ height: '100%', background: '#050500', width: progress + '%', transition: 'width 0.3s' }} />
        </div>
      )}

      {/* PAGES */}
      <main style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto' }}>
        {tab === 'Dashboard'  && <Dashboard stats={stats} contacts={contacts} overdueFollowUp={overdueFollowUp} />}
        {tab === 'Pipeline'   && <Pipeline contacts={filteredContacts} searchQ={searchQ} setSearchQ={setSearchQ} pipeFilter={pipeFilter} setPipeFilter={setPipeFilter} expanded={expanded} setExpanded={setExpanded} changeStage={changeStage} />}
        {tab === 'Daily'      && <Daily contacts={contacts} overdueFollowUp={overdueFollowUp} />}
        {tab === 'Companies'  && <Companies companies={companies} selCompany={selCompany} setSelCompany={setSelCompany} changeStage={changeStage} notes={notes} setNotes={setNotes} />}
        {tab === 'Performans' && <Performans contacts={contacts} stats={stats} />}
      </main>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({ stats, contacts, overdueFollowUp }) {
  const dow = new Date().getDay()
  const [tasks, setTasks] = useState(Array(6).fill(false))
  const toggle = i => setTasks(t => t.map((v,j) => j===i ? !v : v))
  const done = tasks.filter(Boolean).length

  return (
    <div>
      <div style={S.remind}>
        <span>⚑</span>
        <div>
          {dow === 1 && <div style={{ fontSize: 12, color: '#6B4C2A' }}>Pazartesi — Weekly TR-SDR Sync</div>}
          {dow === 3 && <div style={{ fontSize: 12, color: '#6B4C2A' }}>Çarşamba — Mid-Week Check-in</div>}
          <div style={{ fontSize: 12, color: '#6B4C2A' }}>Her gün 09:00 → Gmail tara · Follow-up listesi hazırla · Bir şirketten olumlu yanıt varsa diğer kişilere follow-up gönderme</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={S.sTitle}>Haftalık Skor</div>
          <div style={S.grid6}>
            {[
              ['Toplam Kişi',   stats.total],
              ['Meeting Held',  stats.meetings],
              ['Scheduled',     stats.scheduled],
              ['Aktif',         stats.active],
              ['Yanıt Bekliyor',stats.reply],
              ['Overdue FU',    overdueFollowUp.length],
            ].map(([l,v]) => (
              <div key={l} style={S.statCard}>
                <div style={S.statNum}>{v}</div>
                <div style={S.statLbl}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 260 }}>
          <div style={S.sTitle}>Günlük Görevler — {done}/6</div>
          <div style={{ background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, padding: '12px 14px' }}>
            {['Gmail tara & etiketle','Yeni bağlantılara mesaj','Follow-up listesi','Pipeline güncelle','Meeting notları','KPI tablosu'].map((t,i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i<5 ? '1px solid #F5EFE6' : 'none', cursor: 'pointer' }}>
                <input type="checkbox" checked={tasks[i]} onChange={() => toggle(i)} />
                <span style={{ fontSize: 13, textDecoration: tasks[i] ? 'line-through' : 'none', color: tasks[i] ? '#aaa' : '#050500' }}>{t}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {overdueFollowUp.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={S.sTitle}>
            Gecikmiş Follow-Up
            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: '#DC2626', fontWeight: 500 }}>Acil {overdueFollowUp.length}</span>
          </div>
          <Table
            rows={overdueFollowUp.slice(0,8)}
            cols={[
              { h: 'Kişi',         r: c => c.name },
              { h: 'Şirket',       r: c => c.company },
              { h: 'Stage',        r: c => <StagePill stage={c.stage} /> },
              { h: 'Son İletişim', r: c => formatDate(c.lastContact) },
              { h: 'Gün',          r: c => <span style={{ color: '#EF4444', fontWeight: 500 }}>{daysSince(c.lastContact)}g</span> },
            ]}
          />
        </div>
      )}
    </div>
  )
}

// ── PIPELINE ──────────────────────────────────────────────────
function Pipeline({ contacts, searchQ, setSearchQ, pipeFilter, setPipeFilter, expanded, setExpanded, changeStage }) {
  const stages = pipeFilter === 'outcome' ? OUTCOME_STAGES : PIPELINE_STAGES

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={S.search} placeholder="Kişi, şirket, email..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {['pipeline','outcome','b2c','smartlead'].map(f => (
          <button key={f} style={{ ...S.filterBtn, ...(pipeFilter === f ? S.filterActive : {}) }} onClick={() => setPipeFilter(f)}>
            {{ pipeline:'Pipeline', outcome:'Outcome', b2c:'B2C', smartlead:'Smartlead' }[f]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {stages.map(stage => {
          const sc   = contacts.filter(c => c.stage === stage)
          const meta = STAGE_META[stage]
          const isEx = expanded === stage

          return (
            <div key={stage} style={{ background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderLeft: `3px solid ${meta.color}`, background: '#FAF4EB', borderBottom: '1px solid #E4DBD3', cursor: 'pointer' }}
                onClick={() => setExpanded(isEx ? null : stage)}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</span>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: meta.color + '22', color: meta.color, fontWeight: 500 }}>{sc.length}</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sc.length === 0 && <div style={{ fontSize: 12, color: '#bbb', padding: '4px 0' }}>Boş</div>}
                {sc.slice(0, isEx ? 999 : 3).map(c => (
                  <div key={c.email} style={{ background: '#F5EFE6', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <Avatar name={c.name} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#bbb' }}>{daysSince(c.lastContact)}g</span>
                    </div>
                    {isEx && (
                      <select style={S.stageSelect} value={c.stage} onChange={e => changeStage(c.email, e.target.value)}>
                        {Object.entries(STAGE_META).map(([s,m]) => <option key={s} value={s}>{m.label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {!isEx && sc.length > 3 && (
                  <button style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0' }} onClick={() => setExpanded(stage)}>
                    +{sc.length - 3} daha
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DAILY ─────────────────────────────────────────────────────
function Daily({ contacts, overdueFollowUp }) {
  const dow = new Date().getDay()
  const needsReply = contacts.filter(c => c.stage === 'needs_reply')
  const fu1        = contacts.filter(c => c.stage === 'follow_up_1')
  const fu2        = contacts.filter(c => c.stage === 'follow_up_2')
  const proc       = contacts.filter(c => c.stage === 'processing_meeting')

  return (
    <div>
      <div style={S.remind}>
        <span>⚑</span>
        <div>
          {dow === 1 && <div style={{ fontSize: 12, color: '#6B4C2A' }}>Pazartesi — Weekly TR-SDR Sync</div>}
          {dow === 3 && <div style={{ fontSize: 12, color: '#6B4C2A' }}>Çarşamba — Mid-Week Check-in</div>}
          <div style={{ fontSize: 12, color: '#6B4C2A' }}>Her 2 günde bir: Yanıt vermeyen kişiler için follow-up taslağı hazırla</div>
        </div>
      </div>
      {needsReply.length  > 0 && <DSection title="Needs Reply"           color="#F59E0B" items={needsReply}  urgent />}
      {overdueFollowUp.length > 0 && <DSection title="Gecikmiş Follow-Up" color="#EF4444" items={overdueFollowUp} urgent />}
      {fu1.length         > 0 && <DSection title="1. Follow Up Gerekli" color="#8B5CF6" items={fu1} />}
      {fu2.length         > 0 && <DSection title="2. Follow Up Gerekli" color="#7C3AED" items={fu2} />}
      {proc.length        > 0 && <DSection title="Processing - Meeting"  color="#3B82F6" items={proc} />}
      {needsReply.length + overdueFollowUp.length + fu1.length + fu2.length + proc.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#bbb', fontSize: 14 }}>Bugün yapılacak aksiyon yok 🎉</div>
      )}
    </div>
  )
}

function DSection({ title, color, items, urgent }) {
  const [open, setOpen] = useState(true)
  const byCompany = {}
  items.forEach(c => {
    if (!byCompany[c.company]) byCompany[c.company] = []
    byCompany[c.company].push(c)
  })
  return (
    <div style={{ background: '#fff', border: `1px solid #E4DBD3`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 12 : 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{title}</span>
        {urgent && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: color + '22', color, fontWeight: 500 }}>Acil</span>}
        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: '#F5EFE6', color: '#888', fontWeight: 500 }}>{items.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && Object.entries(byCompany).map(([company, cs]) => (
        <div key={company} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid #F5EFE6', fontSize: 13 }}>
          <span style={{ fontWeight: 500, minWidth: 140 }}>{company}</span>
          <span style={{ color: '#888', fontSize: 12 }}>{cs.length} kişi</span>
          <span style={{ color: '#bbb', marginLeft: 'auto', fontSize: 12 }}>Son: {formatDate(cs[0].lastContact)}</span>
          {urgent && <span style={{ color: '#EF4444', fontWeight: 500, fontSize: 11 }}>{daysSince(cs[0].lastContact)}g</span>}
        </div>
      ))}
    </div>
  )
}

// ── COMPANIES ─────────────────────────────────────────────────
function Companies({ companies, selCompany, setSelCompany, changeStage, notes, setNotes }) {
  const [search, setSearch] = useState('')
  const list = Object.values(companies).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.domain.includes(search.toLowerCase())
  )
  const sel = selCompany ? companies[selCompany] : null

  return (
    <div style={{ display: 'flex', gap: '1.25rem' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <input style={{ ...S.search, marginBottom: '1rem', display: 'block' }} placeholder="Şirket ara..." value={search} onChange={e => setSearch(e.target.value)} />
        <Table
          rows={list}
          onRowClick={c => setSelCompany(selCompany === c.domain ? null : c.domain)}
          selectedKey={selCompany}
          rowKey="domain"
          cols={[
            { h: 'Şirket',       r: c => <span style={{ fontWeight: 500 }}>{c.name}</span> },
            { h: 'Domain',       r: c => <span style={{ color: '#888', fontSize: 12 }}>{c.domain}</span> },
            { h: 'Stage',        r: c => <StagePill stage={c.stage} /> },
            { h: 'Kişi',         r: c => c.contacts.length },
            { h: 'Son İletişim', r: c => formatDate(c.lastContact) },
          ]}
        />
      </div>

      {sel && (
        <div style={{ width: 310, background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, padding: '1.25rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{sel.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{sel.domain}</div>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#bbb' }} onClick={() => setSelCompany(null)}>✕</button>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <StagePill stage={sel.stage} />
            <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Son: {formatDate(sel.lastContact)}</span>
          </div>
          <div style={S.sTitle}>Kişiler ({sel.contacts.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
            {sel.contacts.map(c => (
              <div key={c.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F5EFE6' }}>
                <Avatar name={c.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                </div>
                <StagePill stage={c.stage} small />
              </div>
            ))}
          </div>
          <div style={S.sTitle}>Not</div>
          <textarea
            style={{ width: '100%', minHeight: 80, padding: '8px 10px', border: '1px solid #E4DBD3', borderRadius: 8, fontSize: 12, background: '#FAF4EB', color: '#050500', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            placeholder="Bu şirket için notlar..."
            value={notes[sel.domain] || ''}
            onChange={e => setNotes(n => ({ ...n, [sel.domain]: e.target.value }))}
          />
        </div>
      )}
    </div>
  )
}

// ── PERFORMANS ────────────────────────────────────────────────
function Performans({ contacts, stats }) {
  const funnel = [
    { label: 'Reached Out',  val: contacts.filter(c => c.stage === 'reached_out').length,  color: '#6B7280' },
    { label: 'Follow Up',    val: contacts.filter(c => ['follow_up_1','follow_up_2'].includes(c.stage)).length, color: '#8B5CF6' },
    { label: 'Processing',   val: contacts.filter(c => c.stage === 'processing_meeting').length, color: '#3B82F6' },
    { label: 'Scheduled',    val: stats.scheduled, color: '#10B981' },
    { label: 'Held',         val: stats.meetings,  color: '#059669' },
  ]
  const maxF = funnel[0].val || 1

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={S.sTitle}>KPI vs Hedef</div>
          <div style={{ background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, padding: '14px 16px' }}>
            <KPIBar label="Meeting Held" val={stats.meetings} target={KPI.meetings} color="#10B981" />
            <KPIBar label="Aktif Pipeline" val={stats.active} target={100} color="#3B82F6" />
          </div>
        </div>
        <div style={{ width: 280 }}>
          <div style={S.sTitle}>Conversion Funnel</div>
          <div style={{ background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, padding: '14px 16px' }}>
            {funnel.map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#888' }}>{f.label}</span>
                  <span style={{ fontWeight: 500 }}>{f.val}</span>
                </div>
                <div style={{ background: '#F5EFE6', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ background: f.color, height: '100%', width: Math.round((f.val / maxF) * 100) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.sTitle}>Stage Dağılımı</div>
      <div style={S.grid6}>
        {Object.entries(STAGE_META).map(([stage, meta]) => {
          const count = contacts.filter(c => c.stage === stage).length
          return (
            <div key={stage} style={{ ...S.statCard, borderLeft: `3px solid ${meta.color}` }}>
              <div style={{ ...S.statNum, fontSize: 20 }}>{count}</div>
              <div style={{ ...S.statLbl, fontSize: 11 }}>{meta.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KPIBar({ label, val, target, color }) {
  const pct = Math.min(100, Math.round((val / target) * 100))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#888' }}>{label}</span>
        <span><span style={{ fontWeight: 500 }}>{val}</span><span style={{ color: '#bbb', fontSize: 12 }}> / {target}</span></span>
      </div>
      <div style={{ background: '#F5EFE6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: pct + '%', borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>%{pct} hedefe ulaşıldı</div>
    </div>
  )
}

// ── SHARED COMPONENTS ─────────────────────────────────────────
function Avatar({ name, size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#E4DBD3', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.35, fontWeight: 600,
      color: '#6B5C4C', flexShrink: 0,
    }}>{initials(name)}</div>
  )
}

function Table({ rows, cols, onRowClick, selectedKey, rowKey }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E4DBD3', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #E4DBD3', background: '#FAF4EB' }}>{c.h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey ? row[rowKey] : i}
              style={{ borderBottom: '1px solid #F5EFE6', cursor: onRowClick ? 'pointer' : 'default', background: selectedKey && row[rowKey] === selectedKey ? '#F5EFE6' : '' }}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {cols.map(c => (
                <td key={c.h} style={{ padding: '10px 14px', fontSize: 13, color: '#050500' }}>{c.r(row)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: '2rem', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Kayıt yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────
const S = {
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.5rem', height: 52, background: '#fff',
    borderBottom: '1px solid #E4DBD3', position: 'sticky', top: 0, zIndex: 100,
  },
  logo:   { fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#050500' },
  navBtn: { background: 'none', border: 'none', padding: '5px 12px', fontSize: 13, color: '#888', cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' },
  navActive: { background: '#F5EFE6', color: '#050500', fontWeight: 500 },
  statusBadge: { fontSize: 11, color: '#888', padding: '3px 8px', background: '#F5EFE6', borderRadius: 20 },
  btnSm:  { fontSize: 12, padding: '5px 12px', border: '1px solid #E4DBD3', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#050500', fontFamily: 'inherit' },
  btnDark:{ background: '#050500', color: '#FAF4EB', border: 'none' },
  remind: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF8F0', border: '1px solid #F5E6D0', borderRadius: 10, padding: '12px 14px', marginBottom: '1.25rem' },
  sTitle: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  grid6:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: '1.25rem' },
  statCard:{ background: '#fff', border: '1px solid #E4DBD3', borderRadius: 10, padding: '12px 14px' },
  statNum: { fontSize: 26, fontWeight: 600, color: '#050500', lineHeight: 1.1 },
  statLbl: { fontSize: 12, color: '#888', marginTop: 3 },
  search:  { padding: '7px 12px', fontSize: 13, border: '1px solid #E4DBD3', borderRadius: 8, background: '#fff', color: '#050500', outline: 'none', width: '100%' },
  filterBtn: { fontSize: 12, padding: '5px 12px', border: '1px solid #E4DBD3', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  filterActive: { background: '#050500', color: '#FAF4EB', border: '1px solid #050500' },
  stageSelect: { width: '100%', fontSize: 11, padding: '3px 6px', border: '1px solid #E4DBD3', borderRadius: 6, background: '#fff', color: '#050500', cursor: 'pointer', fontFamily: 'inherit' },
}
