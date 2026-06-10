// Stripe Checkout session creator for credit top-up. Gated by
// studio_purchase_enabled. Auth via oxxovo_token (same model as the rest of the
// public site). Test mode until STRIPE_SECRET_KEY is swapped to live.

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import { getStudioPurchaseConfig, creditsForUsd } from '@/lib/credits'
import { isSession6Enabled } from '@/lib/session6'

const APP_URL = process.env.APP_URL ?? 'https://oxxovo.com'

export async function POST(req: Request) {
  let body: { token?: string; usd?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // S-5: gate on the Studio master switch too, not only the purchase flag. When
  // session6 is off the whole feature (including top-ups) is unavailable.
  if (!(await isSession6Enabled())) return NextResponse.json({ error: 'disabled' }, { status: 403 })

  const cfg = await getStudioPurchaseConfig()
  if (!cfg.enabled) return NextResponse.json({ error: 'disabled' }, { status: 403 })

  const usd = Number(body.usd)
  if (!cfg.packUsd.includes(usd)) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })

  // Verify caller.
  const admin = createSupabaseAdmin()
  const { data: userData, error: authErr } = await admin.auth.getUser(body.token ?? '')
  if (authErr || !userData?.user?.email) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
  const user = userData.user
  const credits = creditsForUsd(usd, cfg.creditUsdValue)

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(usd * 100),
            product_data: { name: `${credits} OXXOVO Studio credits` },
          },
        },
      ],
      // The webhook is the source of truth for crediting; metadata carries what
      // it needs. session.id is the idempotency key.
      metadata: { userId: user.id, credits: String(credits), usd: String(usd) },
      success_url: `${APP_URL}/studio?purchase=success`,
      cancel_url: `${APP_URL}/studio?purchase=cancel`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'stripe_error' }, { status: 500 })
  }
}
