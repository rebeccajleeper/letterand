import { hasPaidAccess } from './_access.js'
import { normalizeEmail, signMagicToken } from './_auth.js'

function getBaseUrl(req) {
  const originHeader = req.headers.origin
  const forwardedProto = req.headers['x-forwarded-proto']
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host
  if (originHeader && /^https?:\/\//.test(originHeader)) return originHeader
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  return null
}

async function sendMagicEmail({ to, magicLink }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { sent: false, reason: 'EMAIL_NOT_CONFIGURED' }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your Word Overlay Decoder sign-in link',
      html: `<p>Use this secure sign-in link:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 20 minutes.</p>`,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Email send failed: ${response.status} ${body}`)
  }
  return { sent: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = normalizeEmail(req.body?.email)
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' })
  }

  if (email === 'admin' || email === 'goldfish12!') {
    return res.status(200).json({ sent: false, error: 'Use admin credential directly on this device.' })
  }

  if (!process.env.MAGIC_LINK_SECRET) {
    return res.status(500).json({ error: 'Server auth is not configured' })
  }

  const baseUrl = getBaseUrl(req)
  if (!baseUrl) {
    return res.status(500).json({ error: 'Could not determine app URL' })
  }

  try {
    const paid = await hasPaidAccess(email)
    if (!paid) {
      return res.status(404).json({ sent: false, error: 'No paid access found for this email.' })
    }

    const expiresAt = Date.now() + (20 * 60 * 1000)
    const token = signMagicToken(email, expiresAt, process.env.MAGIC_LINK_SECRET)
    const magicLink = `${baseUrl}?magic_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

    const sentResult = await sendMagicEmail({ to: email, magicLink })
    if (sentResult.sent) return res.status(200).json({ sent: true })

    return res.status(500).json({ sent: false, error: 'Email delivery is not configured yet.' })
  } catch (err) {
    console.error('Magic link request error:', err.message)
    return res.status(500).json({ sent: false, error: 'Failed to create sign-in link' })
  }
}
