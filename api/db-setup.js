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

    // Excel'den gelen kişi bilgileri
    await sql`
      CREATE TABLE IF NOT EXISTS contacts_info (
        id              TEXT PRIMARY KEY,
        name            TEXT,
        email           TEXT,
        company         TEXT,
        title           TEXT,
        status          TEXT,
        linkedin        TEXT,
        linkedin_connected BOOLEAN DEFAULT FALSE,
        reached_out_date TEXT,
        last_mail_snippet TEXT,
        source          TEXT,
        notes           TEXT,
        linkedin_status TEXT,
        linkedin_date   TEXT,
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Excel'den gelen şirket bilgileri
    await sql`
      CREATE TABLE IF NOT EXISTS companies_info (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        status     TEXT,
        notes      TEXT,
        website    TEXT,
        linkedin   TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_info_email ON contacts_info(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_info_company ON contacts_info(company)`
    await sql`CREATE INDEX IF NOT EXISTS idx_companies_info_name ON companies_info(name)`

    return res.status(200).json({ ok: true, message: 'Tüm tablolar oluşturuldu' })
  } catch (err) {
    console.error('DB setup hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
