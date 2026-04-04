// api/db-setup.js — Tabloları oluştur (tek seferlik çağrılır)
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        email         TEXT PRIMARY KEY,
        domain        TEXT NOT NULL,
        company       TEXT,
        name          TEXT,
        stage         TEXT NOT NULL DEFAULT 'reached_out',
        sent_count    INT DEFAULT 0,
        received_count INT DEFAULT 0,
        last_sent     TIMESTAMPTZ,
        last_received TIMESTAMPTZ,
        first_contact TIMESTAMPTZ,
        last_contact  TIMESTAMPTZ,
        subject       TEXT,
        snippet       TEXT,
        thread_id     TEXT,
        message_count INT DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS company_notes (
        domain     TEXT PRIMARY KEY,
        notes      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS label_map (
        stage    TEXT PRIMARY KEY,
        label_id TEXT NOT NULL
      )
    `

    // Kişi bilgileri (Excel Master Contacts)
    await sql`DROP TABLE IF EXISTS contacts_info`
    await sql`
      CREATE TABLE contacts_info (
        id              TEXT PRIMARY KEY,
        name            TEXT,
        email           TEXT,
        company         TEXT,
        title           TEXT,
        linkedin        TEXT,
        campaign        TEXT,
        first_email     TEXT,
        emails_sent     INT DEFAULT 0,
        last_email      TEXT,
        reply_status    TEXT,
        pipeline_stage  TEXT,
        source          TEXT DEFAULT 'Excel Import',
        notes           TEXT,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Şirket bilgileri (Excel Master Companies)
    await sql`DROP TABLE IF EXISTS companies_info`
    await sql`
      CREATE TABLE companies_info (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        sector          TEXT,
        campaign        TEXT,
        contacts_gmail  INT DEFAULT 0,
        contacts_report INT DEFAULT 0,
        first_contact   TEXT,
        last_contact    TEXT,
        has_reply       TEXT,
        pipeline_stage  TEXT,
        website         TEXT,
        linkedin        TEXT,
        result_summary  TEXT,
        notes           TEXT,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_info_email ON contacts_info(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_info_company ON contacts_info(company)`
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_info_name ON companies_info(name)`

    return res.status(200).json({ ok: true, message: 'Tüm tablolar oluşturuldu (contacts_info ve companies_info sıfırlandı)' })
  } catch (err) {
    console.error('DB setup hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
