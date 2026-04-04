// api/contacts-info.js — Kişi kartı bilgileri CRUD
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  // GET — tüm kişiler veya tek kişi (?email=...)
  if (req.method === 'GET') {
    try {
      const { email, company } = req.query
      let rows
      if (email) {
        rows = await sql`SELECT * FROM contacts_info WHERE email = ${email}`
      } else if (company) {
        rows = await sql`SELECT * FROM contacts_info WHERE company = ${company} ORDER BY name`
      } else {
        rows = await sql`SELECT * FROM contacts_info ORDER BY company, name`
      }
      return res.status(200).json(rows)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST — tek kişi ekle/güncelle
  if (req.method === 'POST') {
    const c = req.body
    if (!c.email && !c.id) return res.status(400).json({ error: 'email veya id gerekli' })

    try {
      const id = c.id || `manual-${Date.now()}`
      await sql`
        INSERT INTO contacts_info (
          id, name, email, company, title, status, linkedin,
          linkedin_connected, reached_out_date, last_mail_snippet,
          source, notes, linkedin_status, linkedin_date, updated_at
        ) VALUES (
          ${id}, ${c.name || null}, ${c.email || null}, ${c.company || null},
          ${c.title || null}, ${c.status || null}, ${c.linkedin || null},
          ${c.linkedinConnected || false}, ${c.reachedOutDate || null},
          ${c.lastMailSnippet || null}, ${c.source || 'Manual'},
          ${c.notes || null}, ${c.linkedinStatus || null},
          ${c.linkedinDate || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email,
          company = EXCLUDED.company, title = EXCLUDED.title,
          status = EXCLUDED.status, linkedin = EXCLUDED.linkedin,
          linkedin_connected = EXCLUDED.linkedin_connected,
          reached_out_date = EXCLUDED.reached_out_date,
          last_mail_snippet = EXCLUDED.last_mail_snippet,
          source = EXCLUDED.source, notes = EXCLUDED.notes,
          linkedin_status = EXCLUDED.linkedin_status,
          linkedin_date = EXCLUDED.linkedin_date,
          updated_at = NOW()
      `
      return res.status(200).json({ ok: true, id })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id gerekli' })
    try {
      await sql`DELETE FROM contacts_info WHERE id = ${id}`
      return res.status(200).json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
