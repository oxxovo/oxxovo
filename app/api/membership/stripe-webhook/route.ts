// Membership subscription webhook -- the source of truth for the creator
// membership lifecycle. Verifies the signature (STRIPE_MEMBERSHIP_WEBHOOK_SECRET,
// a SEPARATE endpoint/secret from the studio credit webhook), dedupes by Stripe
// event.id via membership_events, then applies state to profiles.
//
// Configure in the Stripe dashboard (see reports/membership_p4c_stripe_setup_runbook):
//   POST {APP_URL}/api/membership/stripe-webhook
//   events: checkout.session.completed, customer.subscription.updated,
//           customer.subscription.deleted, invoice.payment_failed, invoice.paid

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { handleMembershipWebhookEvent } from '@/lib/membership-billing'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 })

  const raw = await req.text() // raw body required for signature verification
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch (e) {
    return NextResponse.json(
      { error: 'bad_signature: ' + (e instanceof Error ? e.message : '') },
      { status: 400 },
    )
  }

  const admin = createSupabaseAdmin()

  // Idempotency pre-check: if we have already processed this event id, ack and
  // stop. (The profiles writes are absolute-state UPDATEs, so even a missed
  // dedupe + reprocess is harmless -- this just avoids the extra work.)
  const { data: seen } = await admin
    .from('membership_events')
    .select('id')
    .eq('id', event.id)
    .limit(1)
  if (seen && seen.length > 0) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    const res = await handleMembershipWebhookEvent(event)
    // Record the processed event (after the state write). A concurrent
    // redelivery may race here -> 23505, which is fine (already recorded).
    const { error: logErr } = await admin.from('membership_events').insert({
      id: event.id,
      type: event.type,
      subscription_id: res.subscriptionId ?? null,
      user_id: res.userId ?? null,
    })
    if (logErr && logErr.code !== '23505') {
      console.error('[membership-webhook] event log insert failed:', logErr.message)
    }
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error(
      '[membership-webhook] handler error:',
      event.type,
      e instanceof Error ? e.message : e,
    )
    // 500 -> Stripe retries. The absolute-state UPDATEs make retry safe.
    return NextResponse.json({ error: 'handler_error' }, { status: 500 })
  }
}
