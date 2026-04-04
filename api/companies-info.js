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
        INSERT INTO companies_info (id, name, status, notes, website, linkedin, updated_at)
        VALUES (${id}, ${c.name}, ${c.status || null}, ${c.notes || null},
                ${c.website || null}, ${c.linkedin || null}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, status = EXCLUDED.status,
          notes = EXCLUDED.notes, website = EXCLUDED.website,
          linkedin = EXCLUDED.linkedin, updated_at = NOW()
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
