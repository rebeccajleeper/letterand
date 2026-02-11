import crypto from 'crypto'

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64')
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function signMagicToken(email, expiresAt, secret) {
  const payload = `${normalizeEmail(email)}|${String(expiresAt)}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest()
  return `${b64url(payload)}.${b64url(signature)}`
}

export function verifyMagicToken(email, token, secret) {
  const parts = String(token || '').split('.')
  if (parts.length !== 2) return { ok: false, error: 'Malformed token' }

  const payloadBuf = fromB64url(parts[0])
  const sigBuf = fromB64url(parts[1])
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadBuf).digest()

  if (sigBuf.length !== expectedSig.length) return { ok: false, error: 'Invalid signature' }
  if (!crypto.timingSafeEqual(sigBuf, expectedSig)) return { ok: false, error: 'Invalid signature' }

  const payload = payloadBuf.toString('utf8')
  const [tokenEmail, expiresAtRaw] = payload.split('|')
  const expiresAt = Number(expiresAtRaw)

  if (!tokenEmail || !Number.isFinite(expiresAt)) return { ok: false, error: 'Invalid payload' }
  if (normalizeEmail(tokenEmail) !== normalizeEmail(email)) return { ok: false, error: 'Email mismatch' }
  if (Date.now() > expiresAt) return { ok: false, error: 'Token expired' }

  return { ok: true }
}
