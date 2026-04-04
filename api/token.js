// api/token.js — Vercel Serverless Function
// PKCE token exchange — client_secret burada güvenli saklanır

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, verifier, redirect_uri } = req.body

  if (!code || !verifier || !redirect_uri) {
    return res.status(400).json({ error: 'Eksik parametreler' })
  }

  try {
    const params = new URLSearchParams({
      client_id:     process.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier:  verifier,
      grant_type:     'authorization_code',
      redirect_uri,
    })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    const data = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error('Token exchange hatası:', data)
      return res.status(400).json({ error: data.error_description || 'Token exchange başarısız' })
    }

    // Sadece access_token ve expires_in dön — refresh_token saklamıyoruz
    return res.status(200).json({
      access_token: data.access_token,
      expires_in:   data.expires_in,
    })
  } catch (err) {
    console.error('Token handler hatası:', err)
    return res.status(500).json({ error: 'Sunucu hatası' })
  }
}
