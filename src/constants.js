// ── SABİTLER ──────────────────────────────────────────────────
export const MY_EMAIL   = 'duygu@cambly.com'
export const CACHE_KEY  = 'duygu_crm_v5_data'
export const CACHE_VER  = 5

export const ALL_STAGES = [
  'reached_out','follow_up_1','follow_up_2','needs_reply',
  'interested','referral_received',
  'processing_meeting','meeting_scheduled','meeting_held','reschedule',
  'no_answer','not_interested','bounce','wrong_person',
  'out_of_office','competitor','spam',
]

export const STAGE_META = {
  reached_out:        { label: 'Reached Out',         color: '#6B7280' },
  follow_up_1:        { label: '1. Follow Up',         color: '#8B5CF6' },
  follow_up_2:        { label: '2. Follow Up',         color: '#7C3AED' },
  needs_reply:        { label: 'Needs Reply',          color: '#F59E0B' },
  interested:         { label: 'Interested',           color: '#0EA5E9' },
  referral_received:  { label: 'Referral Received',    color: '#14B8A6' },
  processing_meeting: { label: 'Processing - Meeting', color: '#3B82F6' },
  meeting_scheduled:  { label: 'Meeting Scheduled',    color: '#10B981' },
  meeting_held:       { label: 'Meeting Held',         color: '#059669' },
  reschedule:         { label: 'Reschedule',           color: '#F97316' },
  no_answer:          { label: 'No Answer',            color: '#9CA3AF' },
  not_interested:     { label: 'Not Interested',       color: '#EF4444' },
  bounce:             { label: 'Bounce',               color: '#DC2626' },
  wrong_person:       { label: 'Wrong Person',         color: '#991B1B' },
  out_of_office:      { label: 'Out Of Office',        color: '#6366F1' },
  competitor:         { label: 'Competitor',           color: '#DB2777' },
  spam:               { label: 'Spam / Reklam',       color: '#78716C' },
}

export const ACTIVE_STAGES = ['reached_out','follow_up_1','follow_up_2','needs_reply','interested','referral_received','processing_meeting','meeting_scheduled','meeting_held']
export const CLOSED_STAGES = ['reschedule','no_answer','not_interested','bounce','wrong_person','out_of_office','competitor','spam']

// Excel stage → sistem stage eşleştirmesi (geçmiş veriler için)
export const EXCEL_STAGE_MAP = {
  'no answer':                       'no_answer',
  'meeting held':                    'meeting_held',
  'meeting scheduled':               'meeting_scheduled',
  'competitor':                      'competitor',
  'ooo':                             'out_of_office',
  'interested':                      'interested',
  'referral received':               'referral_received',
  'not interested':                  'not_interested',
  'not interested (existing vendor)':'not_interested',
  'not interested (not on agenda)':  'not_interested',
  'not interested (wants f2f)':      'not_interested',
  'not interested (not in yearly plan)': 'not_interested',
}

export const PIPELINE_STAGES = ALL_STAGES
export const KPI = { meetings: 156, pipeline: 3100000 }

export const MEETING_SOURCES = ['LinkedIn Outbound', 'Email Outbound', 'Smartlead Kampanyası', 'Referans / Inbound', 'Diğer']
export const HANDOFF_FIELDS = ['Dönüş Alan Mail', 'Yan Hak Paketleri', 'Geçmiş Şirketler (Partner Kontrolü)', 'Title & LinkedIn', 'Sustainable Reports', 'Org Chart (HR Yapısı)']
export const WARMTH_OPTIONS = ['Sıcak', 'Nötr', 'Soğuk']
export const WARMTH_COLORS = { 'Sıcak': '#EF4444', 'Nötr': '#F59E0B', 'Soğuk': '#3B82F6' }

// ── V5 RENK SABİTLERİ ───────────────────────────────────────
export const C = {
  bg: '#FAF4EB', bg2: '#F5EFE6', white: '#FFFFFF',
  border: '#E4DBD3', text: '#050500', muted: '#888',
}

// ── FİLTRELENECEK DOMAİNLER (sistem/araç mailleri) ──────────
export const IGNORED_DOMAINS = [
  'cambly.com',
  'google.com', 'googlemail.com', 'gmail.com',
  'mixmax.com', 'vercel.com', 'github.com', 'linkedin.com',
  'hubspot.com', 'salesforce.com', 'slack.com',
  'notion.so', 'figma.com', 'zoom.us',
  'theofficialboard.com',
  'superhuman.com', 'instapage.com', 'intercom.io', 'intercom-mail.com',
  'mailchimp.com', 'sendgrid.net', 'amazonses.com',
  'smartlead.ai', 'instantly.ai', 'apollo.io', 'outreach.io',
  'calendly.com', 'loom.com', 'grammarly.com', 'canva.com',
  'claude.ai', 'anthropic.com',
]

export const IGNORED_PREFIXES = [
  'noreply', 'no-reply', 'no_reply',
  'notifications', 'notification',
  'mailer-daemon', 'postmaster',
  'info@', 'welcome@', 'hello@',
  'support@', 'team@', 'news@', 'newsletter@',
  'onboarding@', 'updates@', 'alert@', 'alerts@',
  'ship@', 'calendar-notification@', 'meetings-noreply@',
]

// ── SIDEBAR NAVİGASYON ──────────────────────────────────────
export const SIDEBAR_MENU = [
  { key: 'Inbox',          label: 'Inbox',          icon: '📥' },
  { key: 'Opportunities',  label: 'Opportunities',  icon: '🏆' },
  { key: 'Leads',          label: 'Leads',          icon: '🏢', hasAdd: true },
  { key: 'Contacts',       label: 'Contacts',       icon: '👤' },
  { key: 'Activities',     label: 'Activities',     icon: '📊' },
  { key: 'Conversations',  label: 'Conversations',  icon: '💬' },
]

export const SIDEBAR_MENU_SECONDARY = [
  { key: 'Workflows',  label: 'Workflows',  icon: '⚡', hasAdd: true },
  { key: 'Reports',    label: 'Reports',    icon: '📈' },
]

// ── MODAL STYLES ─────────────────────────────────────────────
export const MS = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: C.white, borderRadius: 14, padding: '1.5rem', maxWidth: 480, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted, padding: 4 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: {},
  fieldLabel: { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: C.text },
  input: { width: '100%', padding: '6px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 60, padding: '6px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
}

export const isValidLinkedin = (val) => !val || val.includes('linkedin.com')
