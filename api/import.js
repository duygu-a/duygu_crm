// api/import.js — Excel JSON verilerini DB'ye aktar (sil + yükle)
import { getDb } from './db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const sql = getDb()
  const { contacts, companies, clean } = req.body

  try {
    // clean=true ise önce tabloları temizle
    if (clean) {
      await sql`DELETE FROM contacts_info`
      await sql`DELETE FROM companies_info`
    }

    let cImported = 0, coImported = 0

    // Kişileri aktar (Master Contacts formatı)
    if (contacts?.length) {
      for (const c of contacts) {
        const id = `xl-${cImported}`
        await sql`
          INSERT INTO contacts_info (
            id, name, email, company, title, linkedin,
            campaign, first_email, emails_sent, last_email,
            reply_status, pipeline_stage, source, updated_at
          ) VALUES (
            ${id},
            ${c['Full Name'] || c.name || null},
            ${c['Email'] || c.email || null},
            ${c['Company'] || c.company || null},
            ${c['Title'] || c.title || null},
            ${c['LinkedIn Profile'] || c.linkedin || null},
            ${c['Campaign'] || c.campaign || null},
            ${c['First Email'] || c.first_email || null},
            ${c['Emails Sent'] || c.emails_sent || 0},
            ${c['Last Email'] || c.last_email || null},
            ${c['Reply Status'] || c.reply_status || null},
            ${c['Pipeline Stage'] || c.pipeline_stage || null},
            'Excel Import', NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, email = EXCLUDED.email,
            company = EXCLUDED.company, title = EXCLUDED.title,
            linkedin = EXCLUDED.linkedin, campaign = EXCLUDED.campaign,
            first_email = EXCLUDED.first_email, emails_sent = EXCLUDED.emails_sent,
            last_email = EXCLUDED.last_email, reply_status = EXCLUDED.reply_status,
            pipeline_stage = EXCLUDED.pipeline_stage, updated_at = NOW()
        `
        cImported++
      }
    }

    // Şirketleri aktar (Master Companies formatı)
    if (companies?.length) {
      for (const c of companies) {
        const id = `co-${coImported}`
        await sql`
          INSERT INTO companies_info (
            id, name, sector, campaign, contacts_gmail, contacts_report,
            first_contact, last_contact, has_reply, pipeline_stage,
            website, linkedin, result_summary, updated_at
          ) VALUES (
            ${id},
            ${c['Company'] || c.name || null},
            ${c['Sector'] || c.sector || null},
            ${c['Campaign'] || c.campaign || null},
            ${c['Contacts (Gmail)'] || c.contacts_gmail || 0},
            ${c['Contacts (Report)'] || c.contacts_report || 0},
            ${c['First Contact'] || c.first_contact || null},
            ${c['Last Contact'] || c.last_contact || null},
            ${c['Reply?'] || c.has_reply || null},
            ${c['Pipeline Stage'] || c.pipeline_stage || null},
            ${c['Website'] || c.website || null},
            ${c['Company LinkedIn'] || c.linkedin || null},
            ${c['Result Summary'] || c.result_summary || null},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, sector = EXCLUDED.sector,
            campaign = EXCLUDED.campaign, contacts_gmail = EXCLUDED.contacts_gmail,
            contacts_report = EXCLUDED.contacts_report,
            first_contact = EXCLUDED.first_contact, last_contact = EXCLUDED.last_contact,
            has_reply = EXCLUDED.has_reply, pipeline_stage = EXCLUDED.pipeline_stage,
            website = EXCLUDED.website, linkedin = EXCLUDED.linkedin,
            result_summary = EXCLUDED.result_summary, updated_at = NOW()
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
