import { useState, useMemo, useEffect } from 'react'
import { C, STAGE_META, KPI, MEETING_SOURCES } from '../constants'
import { filterByDate, businessDaysSince } from '../helpers'

// Close.com tarzı Reports — Activity Overview + Funnel
export default function ReportsPage({ contacts, stats, companies }) {
  const [activeReport, setActiveReport] = useState('overview') // overview | funnels
  const [period, setPeriod] = useState('Bu Hafta')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-04-04')
  const [meetingSources, setMeetingSources] = useState({})

  useEffect(() => {
    fetch('/api/companies-info').then(r => r.json()).then(rows => {
      const counts = {}
      MEETING_SOURCES.forEach(s => { counts[s] = 0 })
      counts['Belirtilmemiş'] = 0
      rows.forEach(r => {
        if (r.pipeline_stage === 'Meeting Held' || Object.values(companies).find(c => c.name === r.name && c.stage === 'meeting_held')) {
          if (r.meeting_source && MEETING_SOURCES.includes(r.meeting_source)) counts[r.meeting_source]++
          else counts['Belirtilmemiş']++
        }
      })
      setMeetingSources(counts)
    }).catch(() => {})
  }, [companies])

  const fc = useMemo(() => filterByDate(contacts, period, startDate, endDate), [contacts, period, startDate, endDate])

  const s = {
    total: fc.length,
    meetings: fc.filter(c => c.stage === 'meeting_held').length,
    scheduled: fc.filter(c => c.stage === 'meeting_scheduled').length,
    active: fc.filter(c => ['reached_out','follow_up_1','follow_up_2','processing_meeting'].includes(c.stage)).length,
    reply: fc.filter(c => c.stage === 'needs_reply').length,
    sentEmails: fc.filter(c => c.sentCount > 0).length,
    receivedEmails: fc.filter(c => c.receivedCount > 0).length,
  }

  const reports = [
    { key: 'overview', label: 'Activity Overview' },
    { key: 'comparison', label: 'Activity Comparison' },
    { key: 'funnels', label: 'Opportunity Funnels' },
  ]

  return (
    <div>
      {/* Sidebar Report List — Close tarzı sol menüde alt menü */}

      {/* DateFilter */}
      <DateFilterBar period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />

      {/* Rapor Sekmeleri */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {reports.map(r => (
            <button key={r.key} onClick={() => setActiveReport(r.key)} style={{
              padding: '6px 14px', borderRadius: 6,
              border: activeReport === r.key ? 'none' : `1px solid ${C.border}`,
              background: activeReport === r.key ? C.text : C.white,
              color: activeReport === r.key ? C.white : C.muted,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>{r.label}</button>
          ))}
        </div>
        <button style={{ ...btnStyle, background: '#3B82F6', color: C.white, border: 'none' }}>Save As...</button>
      </div>

      {activeReport === 'overview' && (
        <ActivityOverview s={s} meetingSources={meetingSources} fc={fc} />
      )}

      {activeReport === 'funnels' && (
        <OpportunityFunnels s={s} fc={fc} />
      )}

      {activeReport === 'comparison' && (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 8 }}>Activity Comparison</div>
          <div style={{ fontSize: 13 }}>Compare activity across time periods.</div>
        </div>
      )}
    </div>
  )
}

// Close.com tarzı Activity Overview — KPI tile grid
function ActivityOverview({ s, meetingSources, fc }) {
  const tiles = [
    { value: s.total, label: 'Leads', sublabel: 'CREATED', color: '#3B82F6' },
    { value: s.sentEmails, label: 'Sent Emails', sublabel: 'ALL TYPES', color: '#3B82F6' },
    { value: s.receivedEmails, label: 'Received Emails', sublabel: 'ALL TYPES', color: '#3B82F6' },
    { value: s.meetings + s.scheduled, label: 'Opportunities', sublabel: 'CREATED', color: '#3B82F6' },
    { value: s.meetings, label: 'Opportunities', sublabel: 'WON', color: '#3B82F6' },
    { value: s.reply, label: 'Needs Reply', sublabel: 'PENDING', color: '#F59E0B' },
    { value: s.active, label: 'Active Pipeline', sublabel: 'IN PROGRESS', color: '#10B981' },
    { value: 0, label: 'Outbound Calls', sublabel: 'ALL TYPES', color: '#3B82F6' },
  ]

  return (
    <>
      {/* KPI Tile Grid — Close.com 2x4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {tiles.map((tile, i) => (
          <div key={i} style={{
            background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
            padding: '20px 18px',
          }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: tile.color, lineHeight: 1, marginBottom: 6 }}>
              {tile.value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
              {tile.label} <span style={{ color: C.muted }}>▾</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{tile.sublabel}</div>
          </div>
        ))}
      </div>

      {/* Stage Dağılımı */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Stage Distribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {Object.entries(STAGE_META).map(([stage, meta]) => {
            const count = fc.filter(c => c.stage === stage).length
            return (
              <div key={stage} style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${meta.color}` }}>
                <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{count}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{meta.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leaderboard — Close.com sağ kart */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Leaderboard</div>
          <span style={{ fontSize: 11, color: C.muted }}>Opportunities WON</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#6B5C4C' }}>DA</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Duygu Atayan</div>
            <div style={{ fontSize: 11, color: C.muted }}>SDR</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{fc.filter(c => c.stage === 'meeting_held').length}</div>
        </div>
      </div>

      {/* KPI vs Hedef — progress bar'lar */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>KPI vs Target</div>
        {[
          { label: 'Meeting Held', current: s.meetings, target: KPI.meetings },
          { label: 'Meeting Scheduled', current: s.meetings + (fc.filter(c => c.stage === 'meeting_scheduled').length), target: 50 },
          { label: 'Aktif Pipeline', current: s.active, target: 200 },
          { label: 'Yanıt Bekliyor', current: s.reply, target: 20 },
        ].map((k, i) => {
          const pct = Math.min((k.current / k.target) * 100, 100)
          return (
            <div key={i} style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 500 }}>{k.label}</span>
                <span style={{ color: C.muted }}>{k.current} / {k.target}</span>
              </div>
              <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#EF9F27' : '#E24B4A', borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Meeting Source */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Kanal Bazlı Meeting Dağılımı</div>
        {Object.entries(meetingSources).filter(([,v]) => v > 0).map(([source, count]) => {
          const total = Object.values(meetingSources).reduce((a,b) => a+b, 0) || 1
          return (
            <div key={source} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 500, minWidth: 160 }}>{source}</span>
              <div style={{ flex: 1, height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count/total)*100}%`, background: '#10B981', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* Trend Çizgisi */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Trend Çizgisi</span>
          <span style={{ fontSize: 10.5, color: C.muted }}>Son 8 Hafta</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {[8, 14, 12, 22, 18, 26, 20, 24].map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: C.muted }}>{v}</span>
              <div style={{ width: '100%', height: `${(v / 30) * 100}%`, background: C.text, borderRadius: 3, minHeight: 4, opacity: i === 7 ? 1 : 0.3 }} />
              <span style={{ fontSize: 8.5, color: C.muted }}>H{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add a tile */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px dashed ${C.border}`, padding: '20px', textAlign: 'center', cursor: 'pointer', color: '#3B82F6', fontSize: 13, fontWeight: 500 }}>
        + Add a tile
      </div>
    </>
  )
}

// Close.com tarzı Opportunity Funnels
function OpportunityFunnels({ s, fc }) {
  const funnelStages = [
    { label: 'LEAD', color: '#3B82F6', count: fc.filter(c => c.stage === 'reached_out').length },
    { label: 'PROCESSING - MEETING', color: '#F59E0B', count: fc.filter(c => c.stage === 'processing_meeting').length },
    { label: 'MEETING HELD', color: '#10B981', count: fc.filter(c => c.stage === 'meeting_held').length },
    { label: 'WON', color: '#059669', count: s.meetings },
  ]
  const maxCount = Math.max(...funnelStages.map(f => f.count), 1)

  const kpis = [
    { value: s.meetings + s.scheduled, label: 'Opportunities' },
    { value: s.meetings > 0 ? '100%' : '0%', label: 'Win Rate (Count)' },
    { value: '—', label: 'Avg Time to Win' },
    { value: '$—', label: 'Avg Value per Win' },
    { value: '$—/day', label: 'Sales Velocity' },
  ]

  return (
    <>
      {/* KPI Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '18px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#3B82F6', lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel Bar Chart */}
      <div style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Sales Funnel</span>
          <span style={{ fontSize: 11, color: C.muted }}>Funnel Calculations</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, height: 200, paddingBottom: 40 }}>
          {funnelStages.map((stage, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              {/* Label */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: stage.color, color: C.white, textTransform: 'uppercase' }}>{stage.label}</span>
              </div>
              {/* Bar */}
              <div style={{
                width: '60%', background: stage.color,
                height: `${Math.max((stage.count / maxCount) * 140, 4)}px`,
                borderRadius: '4px 4px 0 0',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                position: 'relative',
              }}>
                {stage.count > 0 && (
                  <span style={{
                    position: 'absolute', top: -20,
                    fontSize: 11, fontWeight: 600, color: C.text,
                    background: C.white, borderRadius: 10, padding: '1px 6px',
                    border: `1px solid ${C.border}`,
                  }}>{stage.count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function DateFilterBar({ period, setPeriod, startDate, setStartDate, endDate, setEndDate }) {
  const presets = ['Bugün', 'Bu Hafta', 'Bu Ay', 'Tümü', 'Özel Aralık']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      {presets.map(p => (
        <button key={p} onClick={() => setPeriod(p)} style={{
          padding: '5px 14px', borderRadius: 6, border: `1px solid ${period === p ? C.text : C.border}`,
          background: period === p ? C.text : C.white, color: period === p ? C.white : C.muted,
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>{p}</button>
      ))}
      {period === 'Özel Aralık' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }} />
          <span style={{ fontSize: 11, color: C.muted }}>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, fontFamily: 'inherit', color: C.text, background: C.white, outline: 'none' }} />
        </div>
      )}
    </div>
  )
}

const btnStyle = {
  padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", color: C.text,
}

const selectStyle = {
  padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
  color: C.text, cursor: 'pointer',
}
