import Stripe from 'stripe'
import { normalizeEmail } from './_auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function hasPaidAccess(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const sessions = await stripe.checkout.sessions.list({ limit: 100 })
  const fromSessions = sessions.data.some((s) => (
    s.status === 'complete' &&
    s.payment_status === 'paid' &&
    normalizeEmail(s.customer_email || s.customer_details?.email) === normalizedEmail
  ))
  if (fromSessions) return true

  const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 })
  if (customers.data.length === 0) return false

  const payments = await stripe.paymentIntents.list({
    customer: customers.data[0].id,
    limit: 20,
  })
  return payments.data.some((p) => p.status === 'succeeded')
}
