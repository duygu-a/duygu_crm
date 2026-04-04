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

    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain)`
    await sql`CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage)`

    return res.status(200).json({ ok: true, message: 'Tablolar oluşturuldu' })
  } catch (err) {
    console.error('DB setup hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
