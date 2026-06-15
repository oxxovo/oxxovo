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
import { isMembershipEnabled, type MembershipStatus } from '@/lib/membership'

type AdminClient = ReturnType<typeof createSupabaseAdmin>

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

// ─── P4c: webhook event handling ────────────────────────────────────────────
// The webhook is the source of truth for membership lifecycle. profiles writes
// here are absolute target states (status=X, expires_at=Y), so reprocessing a
// redelivered event is naturally idempotent; membership_events (event.id PK)
// additionally dedupes the common redelivery case.

export type WebhookHandleResult = {
  handled: boolean
  subscriptionId?: string | null
  userId?: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

// Stripe Subscription.current_period_end moved to the item level in recent API
// versions; read it from the first item.
function periodEndIso(sub: Stripe.Subscription): string | null {
  const sec = sub.items?.data?.[0]?.current_period_end
  return typeof sec === 'number' ? new Date(sec * 1000).toISOString() : null
}

function custId(
  c: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!c) return null
  return typeof c === 'string' ? c : c.id
}

// Map a Stripe subscription status to our membership_status enum.
function mapSubStatus(s: Stripe.Subscription.Status): MembershipStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    default:
      // canceled / unpaid / incomplete / incomplete_expired / paused
      return 'canceled'
  }
}

// Resolve the platform user for an event: prefer metadata.userId (set on the
// subscription at checkout), else look up by stored subscription / customer id.
async function resolveUserId(
  admin: AdminClient,
  args: { metadataUserId?: string | null; subscriptionId?: string | null; customerId?: string | null },
): Promise<string | null> {
  if (args.metadataUserId) return args.metadataUserId
  if (args.subscriptionId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', args.subscriptionId)
      .maybeSingle()
    if (data?.id) return data.id as string
  }
  if (args.customerId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', args.customerId)
      .maybeSingle()
    if (data?.id) return data.id as string
  }
  return null
}

// Invoice.subscription moved under parent.subscription_details in recent API
// versions; that block also carries a snapshot of the subscription metadata.
function invoiceSubInfo(inv: Stripe.Invoice): {
  subscriptionId: string | null
  metadataUserId: string | null
} {
  const sd = inv.parent?.subscription_details
  const sub = sd?.subscription
  const subscriptionId = sub == null ? null : typeof sub === 'string' ? sub : sub.id
  const metadataUserId = (sd?.metadata?.userId as string | undefined) ?? null
  return { subscriptionId, metadataUserId }
}

// Apply lifecycle state from a full subscription object (active/past_due/etc.).
async function applyFromSubscription(
  admin: AdminClient,
  userId: string,
  sub: Stripe.Subscription,
  opts: { resetNotice?: boolean } = {},
): Promise<void> {
  const update: Record<string, unknown> = {
    membership_status: mapSubStatus(sub.status),
    membership_expires_at: periodEndIso(sub),
    membership_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    updated_at: nowIso(),
  }
  if (opts.resetNotice) update.membership_renewal_notified_at = null
  await admin.from('profiles').update(update).eq('id', userId)
}

export async function handleMembershipWebhookEvent(
  event: Stripe.Event,
): Promise<WebhookHandleResult> {
  const admin = createSupabaseAdmin()
  const stripe = getStripe()

  switch (event.type) {
    // Initial activation (also covers founding_free -> paid conversion).
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // This endpoint also receives one-time (studio credit) sessions -- ignore
      // anything that is not a membership subscription.
      if (session.mode !== 'subscription' || session.metadata?.kind !== 'membership') {
        return { handled: false }
      }
      const userId = session.metadata?.userId ?? null
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null
      const customerId = custId(session.customer)
      if (!userId || !subscriptionId) return { handled: false, subscriptionId, userId }

      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      await admin
        .from('profiles')
        .update({
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          membership_tier: 'creator',
          membership_status: mapSubStatus(sub.status),
          membership_source: 'paid',
          membership_started_at: nowIso(),
          membership_expires_at: periodEndIso(sub),
          membership_cancel_at_period_end: sub.cancel_at_period_end ?? false,
          membership_renewal_notified_at: null,
          updated_at: nowIso(),
        })
        .eq('id', userId)
      return { handled: true, subscriptionId, userId }
    }

    // Status / cancel-at-period-end / period changes.
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = await resolveUserId(admin, {
        metadataUserId: sub.metadata?.userId,
        subscriptionId: sub.id,
        customerId: custId(sub.customer),
      })
      if (!userId) return { handled: false, subscriptionId: sub.id }
      await applyFromSubscription(admin, userId, sub)
      return { handled: true, subscriptionId: sub.id, userId }
    }

    // Subscription fully ended.
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = await resolveUserId(admin, {
        metadataUserId: sub.metadata?.userId,
        subscriptionId: sub.id,
        customerId: custId(sub.customer),
      })
      if (!userId) return { handled: false, subscriptionId: sub.id }
      await admin
        .from('profiles')
        .update({
          membership_status: 'canceled',
          membership_cancel_at_period_end: false,
          membership_expires_at: periodEndIso(sub),
          updated_at: nowIso(),
        })
        .eq('id', userId)
      return { handled: true, subscriptionId: sub.id, userId }
    }

    // Renewal payment failed -> dunning.
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      const { subscriptionId, metadataUserId } = invoiceSubInfo(inv)
      const userId = await resolveUserId(admin, {
        metadataUserId,
        subscriptionId,
        customerId: custId(inv.customer),
      })
      if (!userId) return { handled: false, subscriptionId }
      await admin
        .from('profiles')
        .update({ membership_status: 'past_due', updated_at: nowIso() })
        .eq('id', userId)
      return { handled: true, subscriptionId, userId }
    }

    // Renewal (or initial) payment succeeded -> active + advance the window.
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      const { subscriptionId, metadataUserId } = invoiceSubInfo(inv)
      if (!subscriptionId) return { handled: false }
      const userId = await resolveUserId(admin, {
        metadataUserId,
        subscriptionId,
        customerId: custId(inv.customer),
      })
      if (!userId) return { handled: false, subscriptionId }
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      await applyFromSubscription(admin, userId, sub, { resetNotice: true })
      return { handled: true, subscriptionId, userId }
    }

    default:
      return { handled: false }
  }
}
