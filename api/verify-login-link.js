import { hasPaidAccess } from './_access.js'
import { normalizeEmail, verifyMagicToken } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = normalizeEmail(req.body?.email)
  const token = String(req.body?.token || '')
  if (!email || !email.includes('@') || !token) {
    return res.status(400).json({ error: 'Email and token are required' })
  }

  if (!process.env.MAGIC_LINK_SECRET) {
    return res.status(500).json({ error: 'Server auth is not configured' })
  }

  try {
    const tokenResult = verifyMagicToken(email, token, process.env.MAGIC_LINK_SECRET)
    if (!tokenResult.ok) {
      return res.status(401).json({ access: false, error: tokenResult.error })
    }

    const paid = await hasPaidAccess(email)
    if (!paid) {
      return res.status(403).json({ access: false, error: 'No paid access found for this email.' })
    }

    return res.status(200).json({ access: true, email })
  } catch (err) {
    console.error('Magic link verify error:', err.message)
    return res.status(500).json({ access: false, error: 'Failed to verify sign-in link' })
  }
}
