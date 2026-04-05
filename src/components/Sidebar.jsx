import { useState } from 'react'
import { C, SIDEBAR_MENU, SIDEBAR_MENU_SECONDARY } from '../constants'

export default function Sidebar({ activeTab, onTabChange, inboxCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false)

  const w = collapsed ? 56 : 240

  return (
    <aside style={{
      width: w, minWidth: w, height: '100vh', position: 'sticky', top: 0,
      background: C.bg2, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease, min-width 0.2s ease',
      fontFamily: "'DM Sans', sans-serif", overflow: 'hidden',
      zIndex: 50,
    }}>
      {/* Kullanıcı Profili */}
      <div style={{
        padding: collapsed ? '16px 12px' : '16px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, color: '#6B5C4C', flexShrink: 0,
        }}>DA</div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>Duygu Atayan</div>
            <div style={{ fontSize: 11, color: C.muted }}>Cambly</div>
          </div>
        )}
        {!collapsed && <span style={{ fontSize: 10, color: C.muted }}>▼</span>}
      </div>

      {/* Ana Navigasyon */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {SIDEBAR_MENU.map(item => {
          const isActive = activeTab === item.key
          const badge = item.key === 'Inbox' && inboxCount > 0 ? inboxCount : null
          return (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              collapsed={collapsed}
              badge={badge}
              hasAdd={item.hasAdd}
              onClick={() => onTabChange(item.key)}
            />
          )
        })}

        {/* Ayraç */}
        <div style={{ height: 1, background: C.border, margin: '8px 14px' }} />

        {SIDEBAR_MENU_SECONDARY.map(item => {
          const isActive = activeTab === item.key
          return (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              isActive={isActive}
              collapsed={collapsed}
              hasAdd={item.hasAdd}
              onClick={() => onTabChange(item.key)}
            />
          )
        })}

        {/* Ayraç */}
        <div style={{ height: 1, background: C.border, margin: '8px 14px' }} />

        {/* Smart Views */}
        {!collapsed && (
          <div style={{ padding: '6px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Smart Views</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, color: C.muted, cursor: 'pointer' }} title="Tablo görünümü">▦</span>
                <span style={{ fontSize: 12, color: C.muted, cursor: 'pointer' }} title="Ara">🔍</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              Smart Views are saved searches that dynamically display the most relevant records.
            </div>
          </div>
        )}
      </nav>

      {/* Alt Menü */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '4px 0' }}>
        {!collapsed && (
          <>
            <SidebarItem icon="📚" label="Support & FAQs" collapsed={collapsed} onClick={() => {}} external />
            <SidebarItem icon="🔗" label="Integrations" collapsed={collapsed} onClick={() => {}} />
            <SidebarItem
              icon="⚙"
              label="Settings"
              isActive={activeTab === 'Settings'}
              collapsed={collapsed}
              onClick={() => onTabChange('Settings')}
            />
          </>
        )}

        {/* Collapse Butonu */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '10px 18px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', fontSize: 12, color: C.muted,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.white + '80'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 14, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>◁</span>
          {!collapsed && <span style={{ fontWeight: 500 }}>Collapse</span>}
        </div>
      </div>
    </aside>
  )
}

function SidebarItem({ icon, label, isActive, collapsed, badge, hasAdd, onClick, external }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '8px 0' : '8px 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        cursor: 'pointer',
        background: isActive ? C.white : 'transparent',
        color: isActive ? C.text : C.muted,
        fontWeight: isActive ? 500 : 400,
        fontSize: 13,
        margin: collapsed ? '1px 0' : '1px 8px',
        borderRadius: 6,
        transition: 'background 0.1s, color 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.white + '80' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {!collapsed && (
        <>
          <span style={{ flex: 1 }}>{label}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.white,
              background: '#10B981', borderRadius: 10,
              padding: '1px 6px', minWidth: 16, textAlign: 'center',
            }}>{badge}</span>
          )}
          {hasAdd && (
            <span
              style={{ fontSize: 14, color: C.muted, cursor: 'pointer', lineHeight: 1 }}
              onClick={e => { e.stopPropagation() }}
              title={`Yeni ${label} ekle`}
            >⊕</span>
          )}
          {external && <span style={{ fontSize: 10, color: C.muted }}>↗</span>}
        </>
      )}
    </div>
  )
}
