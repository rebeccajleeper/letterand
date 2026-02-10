import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id } = req.body
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status === 'paid') {
      return res.status(200).json({ access: true, email: session.customer_email })
    }

    return res.status(200).json({ access: false })
  } catch (err) {
    console.error('Stripe verify error:', err.message)
    return res.status(500).json({ error: 'Failed to verify payment' })
  }
}
