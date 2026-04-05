// api/db-migrate.js — Yeni alanları ekle (mevcut verileri korur)
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  try {
    // companies_info: meeting_source, handoff_notes, follow_up_date
    const newCols = [
      ['companies_info', 'meeting_source', 'TEXT'],
      ['companies_info', 'handoff_notes', 'JSONB'],
      ['companies_info', 'follow_up_date', 'TEXT'],
    ]

    // contacts_info: warmth, quick_note
    const contactCols = [
      ['contacts_info', 'warmth', 'TEXT'],
      ['contacts_info', 'quick_note', 'TEXT'],
    ]

    const allCols = [...newCols, ...contactCols]

    for (const [table, col, type] of allCols) {
      try {
        await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`)
      } catch (e) {
        // Column already exists — ignore
      }
    }

    // LinkedIn alanındaki yanlış verileri temizle (linkedin.com içermeyen)
    await sql`UPDATE companies_info SET linkedin = NULL WHERE linkedin IS NOT NULL AND linkedin NOT LIKE '%linkedin.com%'`
    await sql`UPDATE contacts_info SET linkedin = NULL WHERE linkedin IS NOT NULL AND linkedin NOT LIKE '%linkedin.com%'`

    return res.status(200).json({ ok: true, message: 'Migration tamamlandı — yeni alanlar eklendi, LinkedIn verileri temizlendi' })
  } catch (err) {
    console.error('Migration hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
