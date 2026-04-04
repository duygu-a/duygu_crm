// api/companies-info.js — Şirket bilgileri CRUD
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  if (req.method === 'GET') {
    try {
      const { name } = req.query
      let rows
      if (name) {
        rows = await sql`SELECT * FROM companies_info WHERE name = ${name}`
      } else {
        rows = await sql`SELECT * FROM companies_info ORDER BY name`
      }
      return res.status(200).json(rows)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const c = req.body
    if (!c.name) return res.status(400).json({ error: 'name gerekli' })

    try {
      const id = c.id || `co-manual-${Date.now()}`
      await sql`
        INSERT INTO companies_info (
          id, name, sector, campaign, contacts_gmail, contacts_report,
          first_contact, last_contact, has_reply, pipeline_stage,
          website, linkedin, result_summary, notes, updated_at
        ) VALUES (
          ${id}, ${c.name}, ${c.sector || null}, ${c.campaign || null},
          ${c.contacts_gmail || 0}, ${c.contacts_report || 0},
          ${c.first_contact || null}, ${c.last_contact || null},
          ${c.has_reply || null}, ${c.pipeline_stage || null},
          ${c.website || null}, ${c.linkedin || null},
          ${c.result_summary || null}, ${c.notes || null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, sector = EXCLUDED.sector,
          campaign = EXCLUDED.campaign, contacts_gmail = EXCLUDED.contacts_gmail,
          contacts_report = EXCLUDED.contacts_report,
          first_contact = EXCLUDED.first_contact, last_contact = EXCLUDED.last_contact,
          has_reply = EXCLUDED.has_reply, pipeline_stage = EXCLUDED.pipeline_stage,
          website = EXCLUDED.website, linkedin = EXCLUDED.linkedin,
          result_summary = EXCLUDED.result_summary, notes = EXCLUDED.notes,
          updated_at = NOW()
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
      await sql`DELETE FROM companies_info WHERE id = ${id}`
      return res.status(200).json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
