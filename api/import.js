// api/import.js — Excel JSON verilerini DB'ye aktar (tek seferlik)
import { getDb } from './db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const sql = getDb()
  const { contacts, companies } = req.body

  try {
    let cImported = 0, coImported = 0

    // Kişileri aktar
    if (contacts?.length) {
      for (const c of contacts) {
        await sql`
          INSERT INTO contacts_info (
            id, name, email, company, title, status, linkedin,
            linkedin_connected, reached_out_date, last_mail_snippet,
            source, notes, linkedin_status, linkedin_date, updated_at
          ) VALUES (
            ${c.id || 'xl-' + Date.now() + '-' + cImported},
            ${c.name || null}, ${c.email || null}, ${c.company || null},
            ${c.title || null}, ${c.status || null}, ${c.linkedin || null},
            ${c.linkedinConnected === 'TRUE' || c.linkedinConnected === true},
            ${c.reachedOutDate || null}, ${c.lastMailSnippet || null},
            ${c.source || 'Excel Import'}, ${c.notes || null},
            ${c.linkedinStatus || null}, ${c.linkedinDate || null}, NOW()
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
        cImported++
      }
    }

    // Şirketleri aktar
    if (companies?.length) {
      for (const c of companies) {
        await sql`
          INSERT INTO companies_info (id, name, status, notes, website, linkedin, updated_at)
          VALUES (
            ${c.id || 'co-' + coImported},
            ${c.name}, ${c.status || null}, ${c.notes || null},
            ${c.website || null}, ${c.linkedin || null}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, status = EXCLUDED.status,
            notes = EXCLUDED.notes, website = EXCLUDED.website,
            linkedin = EXCLUDED.linkedin, updated_at = NOW()
        `
        coImported++
      }
    }

    return res.status(200).json({ ok: true, contacts: cImported, companies: coImported })
  } catch (err) {
    console.error('Import hatası:', err)
    return res.status(500).json({ error: err.message })
  }
}
