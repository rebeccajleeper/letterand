import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    // Enforce one-time purchase per email.
    const recentSessions = await stripe.checkout.sessions.list({ limit: 100 })
    const alreadyPaidSession = recentSessions.data.some((s) => (
      s.status === 'complete' &&
      s.payment_status === 'paid' &&
      (
        s.customer_email === email ||
        s.customer_details?.email === email
      )
    ))

    if (alreadyPaidSession) {
      return res.status(409).json({
        alreadyPurchased: true,
        error: 'Access already exists for this email. Use sign in/recovery.',
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Word Overlay Decoder Full Mode (One-Time)' },
          unit_amount: 499,
        },
        quantity: 1,
      }],
      success_url: `${req.headers.origin}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err.message)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
