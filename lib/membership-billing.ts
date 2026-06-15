// Membership subscription billing (Stripe) -- SERVER ONLY.
//
// Subscription-mode Checkout for the creator membership. Mirrors the one-time
// studio checkout pattern (inline price_data, metadata-driven, webhook is the
// source of truth) but with mode:'subscription' + a recurring price + a
// persistent Stripe Customer. Price/interval/product all come from
// platform_config -- never hardcoded. The webhook (P4c) applies the resulting
// state to profiles; this file only opens the checkout.

import 'server-only'
import type Stripe from 'stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import { getPlatformConfigMap } from '@/lib/partners'
import { isMembershipEnabled } from '@/lib/membership'

const APP_URL = process.env.APP_URL ?? 'https://oxxovo.com'

const VALID_INTERVALS = ['day', 'week', 'month', 'year'] as const
type BillingInterval = (typeof VALID_INTERVALS)[number]

export type MembershipCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'disabled' | 'not_configured' | 'stripe_error' }

// Get the user's Stripe Customer id, creating one on first use. The id is stored
// on profiles.stripe_customer_id (P0 column) and reused for every later
// subscription action. (A rare concurrent first-checkout could create two
// customers; the webhook reconciles on subscription id, and a later cleanup can
// merge -- acceptable for launch.)
async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  const existing = (data?.stripe_customer_id as string | null | undefined) ?? null
  if (existing) return existing

  const stripe = getStripe()
  const customer = await stripe.customers.create({ email, metadata: { userId } })
  await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .is('stripe_customer_id', null) // don't clobber a value a concurrent call set
  return customer.id
}

// Open a subscription Checkout session for the creator membership. Fails closed
// (disabled / not_configured) so a missing switch, price, interval, or Stripe
// Product never produces a half-formed checkout.
export async function createMembershipCheckoutSession(
  userId: string,
  email: string,
): Promise<MembershipCheckoutResult> {
  if (!(await isMembershipEnabled())) return { ok: false, reason: 'disabled' }

  const cfg = await getPlatformConfigMap()
  const price = Number(cfg.get('membership_creator_price_usd') ?? 0)
  const interval = String(cfg.get('membership_billing_interval') ?? '')
  const productId = String(cfg.get('membership_stripe_product_id') ?? '')
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !(VALID_INTERVALS as readonly string[]).includes(interval) ||
    !productId
  ) {
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const customer = await getOrCreateStripeCustomer(userId, email)
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(price * 100),
            recurring: { interval: interval as BillingInterval },
            product: productId,
          },
        },
      ],
      // userId on BOTH the session and the subscription so every later
      // customer.subscription.* / invoice.* event (P4c) can resolve the user
      // without a customer lookup.
      metadata: { userId, kind: 'membership' },
      subscription_data: { metadata: { userId, kind: 'membership' } },
      success_url: `${APP_URL}/apply?membership=success`,
      cancel_url: `${APP_URL}/apply?membership=cancel`,
    } satisfies Stripe.Checkout.SessionCreateParams)
    if (!session.url) return { ok: false, reason: 'stripe_error' }
    return { ok: true, url: session.url }
  } catch (e) {
    console.error('[membership-billing] checkout failed:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'stripe_error' }
  }
}
