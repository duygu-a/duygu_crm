// api/contacts-info.js — Kişi kartı bilgileri CRUD
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

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

  if (req.method === 'POST') {
    const c = req.body
    if (!c.email && !c.id) return res.status(400).json({ error: 'email veya id gerekli' })

    try {
      const id = c.id || `manual-${Date.now()}`
      await sql`
        INSERT INTO contacts_info (
          id, name, email, company, title, linkedin,
          campaign, first_email, emails_sent, last_email,
          reply_status, pipeline_stage, source, notes, updated_at
        ) VALUES (
          ${id}, ${c.name || null}, ${c.email || null}, ${c.company || null},
          ${c.title || null}, ${c.linkedin || null}, ${c.campaign || null},
          ${c.first_email || null}, ${c.emails_sent || 0}, ${c.last_email || null},
          ${c.reply_status || null}, ${c.pipeline_stage || null},
          ${c.source || 'Manual'}, ${c.notes || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email,
          company = EXCLUDED.company, title = EXCLUDED.title,
          linkedin = EXCLUDED.linkedin, campaign = EXCLUDED.campaign,
          first_email = EXCLUDED.first_email, emails_sent = EXCLUDED.emails_sent,
          last_email = EXCLUDED.last_email, reply_status = EXCLUDED.reply_status,
          pipeline_stage = EXCLUDED.pipeline_stage,
          notes = EXCLUDED.notes, updated_at = NOW()
      `
      return res.status(200).json({ ok: true, id })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

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
