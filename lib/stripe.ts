// Stripe client -- SERVER ONLY. Test mode now (sk_test_...); the live key is a
// drop-in swap of STRIPE_SECRET_KEY after TK's Stripe approval. No code change
// needed to go live.

import 'server-only'
import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cached = new Stripe(key)
  return cached
}

export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')
}
