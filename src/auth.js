// Client-side access management for Word Mode paywall

const STORAGE_KEY = 'letterand_access'

function getStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
  } catch { return null }
}

function setStored(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Check if user has unlocked access (from localStorage cache) */
export function isUnlocked() {
  const stored = getStored()
  return stored?.access === true
}

/** Get stored email */
export function getEmail() {
  return getStored()?.email || null
}

/** Verify a Stripe Checkout session_id and store result */
export async function unlock(sessionId) {
  const res = await fetch('/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
  const data = await res.json()
  if (data.access) {
    setStored({ access: true, email: data.email })
  }
  return data
}

/** Check if an email has a completed purchase, or admin password */
export async function checkEmail(email, password) {
  const body = { email }
  if (password) body.password = password
  const res = await fetch('/api/check-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.access) {
    setStored({ access: true, email: data.admin ? 'admin' : email })
  }
  return data
}

/** Start the Stripe Checkout flow */
export async function startCheckout(email) {
  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  }
  return data
}

/** Clear stored access */
export function logout() {
  localStorage.removeItem(STORAGE_KEY)
}
