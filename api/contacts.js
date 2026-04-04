// api/contacts.js — Kişileri getir / kaydet
import { getDb } from './db.js'

export default async function handler(req, res) {
  const sql = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM contacts ORDER BY last_contact DESC`
      return res.status(200).json(rows)
    } catch (err) {
      console.error('Contacts GET hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { contacts } = req.body
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'contacts dizisi gerekli' })
    }

    try {
      // Batch upsert — 50'lik gruplarla
      const BATCH = 50
      let upserted = 0

      for (let i = 0; i < contacts.length; i += BATCH) {
        const chunk = contacts.slice(i, i + BATCH)
        const promises = chunk.map(c =>
          sql`INSERT INTO contacts (
            email, domain, company, name, stage,
            sent_count, received_count,
            last_sent, last_received, first_contact, last_contact,
            subject, snippet, thread_id, message_count, updated_at
          ) VALUES (
            ${c.email}, ${c.domain}, ${c.company || null}, ${c.name || null}, ${c.stage},
            ${c.sentCount || 0}, ${c.receivedCount || 0},
            ${c.lastSent || null}, ${c.lastReceived || null},
            ${c.firstContact || null}, ${c.lastContact || null},
            ${c.subject || null}, ${c.snippet || null},
            ${c.threadId || null}, ${c.messageCount || 0}, NOW()
          )
          ON CONFLICT (email) DO UPDATE SET
            domain = EXCLUDED.domain,
            company = EXCLUDED.company,
            name = EXCLUDED.name,
            stage = EXCLUDED.stage,
            sent_count = EXCLUDED.sent_count,
            received_count = EXCLUDED.received_count,
            last_sent = EXCLUDED.last_sent,
            last_received = EXCLUDED.last_received,
            first_contact = EXCLUDED.first_contact,
            last_contact = EXCLUDED.last_contact,
            subject = EXCLUDED.subject,
            snippet = EXCLUDED.snippet,
            thread_id = EXCLUDED.thread_id,
            message_count = EXCLUDED.message_count,
            updated_at = NOW()
          `
        )
        await Promise.all(promises)
        upserted += chunk.length
      }

      return res.status(200).json({ ok: true, upserted })
    } catch (err) {
      console.error('Contacts POST hatası:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
