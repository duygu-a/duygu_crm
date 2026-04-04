// api/notes.js — Şirket notlarını getir / kaydet
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT domain, notes FROM company_notes`
      const notesMap = {}
      rows.forEach(r => { notesMap[r.domain] = r.notes })
      return res.status(200).json(notesMap)
    } catch (err) {
      console.error('Notes GET hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { domain, notes } = req.body
    if (!domain) return res.status(400).json({ error: 'domain gerekli' })

    try {
      await sql`
        INSERT INTO company_notes (domain, notes, updated_at)
        VALUES (${domain}, ${notes || ''}, NOW())
        ON CONFLICT (domain) DO UPDATE SET
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Notes POST hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
