// Stripe webhook -- the source of truth for crediting a purchase. Verifies the
// signature, then on checkout.session.completed grants credits idempotently
// (keyed by the Stripe session id). Configure the endpoint + signing secret in
// the Stripe dashboard: POST {APP_URL}/api/studio/stripe-webhook -> whsec_...

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { grantPurchasedCredits } from '@/lib/credits'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 })

  const raw = await req.text() // raw body required for signature verification
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch (e) {
    return NextResponse.json({ error: 'bad_signature: ' + (e instanceof Error ? e.message : '') }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    const credits = Number(session.metadata?.credits)
    const usd = Number(session.metadata?.usd)
    if (userId && Number.isFinite(credits) && credits > 0) {
      const res = await grantPurchasedCredits({ userId, usd, credits, stripeSessionId: session.id })
      if (!res.ok) {
        // 500 so Stripe retries.
        return NextResponse.json({ error: res.errorMessage ?? 'grant_failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
