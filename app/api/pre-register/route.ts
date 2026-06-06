import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSeasonId, getSeasonById } from '@/lib/seasons'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPreRegistered } from '@/lib/email/send'

// Public pre-registration ("notify me when applications open").
//
// Flow: email (+ UTM attribution) -> upsert into pre_registrations -> one
// confirmation email on first sign-up only. Replaces the orphaned /api/notify
// (email-only, no storage) and /api/waitlist (wrote to a table that does not
// exist). Mutations run through the service-role client per the server-side
// RLS rule — the anon/publishable key must never reach the browser.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Defensive caps so a crafted request can't store unbounded text.
const EMAIL_MAX = 254
const UTM_MAX = 200

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.slice(0, max)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const rawEmail = clean(body.email, EMAIL_MAX)
    if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 },
      )
    }
    // Stored lower-cased so the plain UNIQUE(email) gives global,
    // case-insensitive dedup.
    const email = rawEmail.toLowerCase()

    // Season the visitor is pre-registering FOR — always dynamic, never
    // hard-coded. Verify it exists so we don't violate the FK.
    const seasonId = getCurrentSeasonId()
    const season = await getSeasonById(seasonId)
    const seasonName = season?.display_name ?? 'OXXOVO Genesis'

    const admin = createSupabaseAdmin()
    const { error } = await admin.from('pre_registrations').insert({
      email,
      utm_source: clean(body.utm_source, UTM_MAX),
      utm_medium: clean(body.utm_medium, UTM_MAX),
      utm_campaign: clean(body.utm_campaign, UTM_MAX),
      referrer: clean(body.referrer, UTM_MAX),
      // Only attach a season_id we know exists; otherwise leave it null
      // rather than fail the whole sign-up on a stale env pin.
      season_id: season ? season.id : null,
    })

    if (error) {
      // 23505 = unique_violation: this email already pre-registered. Treat as
      // success (idempotent) and keep first-touch attribution untouched. No
      // second confirmation email goes out.
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, status: 'already_registered' })
      }
      console.error('[pre-register] insert failed:', error.message)
      return NextResponse.json(
        { error: 'Could not save your registration. Please try again.' },
        { status: 500 },
      )
    }

    // First-time registration confirmed -> fire the confirmation email. The
    // row is already persisted, so a Resend hiccup must not fail the request;
    // the send helper logs its own outcome into email_logs.
    sendPreRegistered({
      toEmail: email,
      country: null,
      seasonName,
      seasonId: season ? season.id : null,
    }).catch((e) =>
      console.error('[pre-register] sendPreRegistered error:', e),
    )

    return NextResponse.json({ ok: true, status: 'registered' })
  } catch (e) {
    console.error('[pre-register] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
