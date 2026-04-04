// api/labels.js — Gmail label eşleştirmesini getir / kaydet
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT stage, label_id FROM label_map`
      const map = {}
      rows.forEach(r => { map[r.stage] = r.label_id })
      return res.status(200).json(map)
    } catch (err) {
      console.error('Labels GET hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { labelMap } = req.body
    if (!labelMap || typeof labelMap !== 'object') {
      return res.status(400).json({ error: 'labelMap objesi gerekli' })
    }

    try {
      const entries = Object.entries(labelMap)
      await Promise.all(entries.map(([stage, labelId]) =>
        sql`
          INSERT INTO label_map (stage, label_id)
          VALUES (${stage}, ${labelId})
          ON CONFLICT (stage) DO UPDATE SET label_id = EXCLUDED.label_id
        `
      ))
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Labels POST hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
