export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Parse body if it's a string
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  if (!body) body = {}

  const { email, password } = body
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  // Admin login check — no Stripe needed
  if (password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ access: true, admin: true })
  }

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const sessions = await stripe.checkout.sessions.list({
      customer_details: { email },
      status: 'complete',
      limit: 1,
    })

    if (sessions.data.length > 0) {
      return res.status(200).json({ access: true })
    }

    const customers = await stripe.customers.list({ email, limit: 1 })
    if (customers.data.length > 0) {
      const payments = await stripe.paymentIntents.list({
        customer: customers.data[0].id,
        limit: 10,
      })
      const hasPaid = payments.data.some(p => p.status === 'succeeded')
      if (hasPaid) {
        return res.status(200).json({ access: true })
      }
    }

    return res.status(200).json({ access: false })
  } catch (err) {
    console.error('Stripe access check error:', err.message)
    return res.status(500).json({ error: 'Failed to check access' })
  }
}
