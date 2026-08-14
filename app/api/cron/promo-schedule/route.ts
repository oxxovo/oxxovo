// Vercel Cron entrypoint -- fires every 15 minutes from vercel.json.
//
// Publishes AT MOST ONE approved, not-yet-posted promo_videos row per tick,
// and only inside the configured weekly slot (platform_config
// promo_publish_weekdays/time/timezone). Empty weekdays = paused -- there is
// no separate on/off switch (HQ 2026-08-14, see
// reports/promo_auto_publish_design_2026-08-14.md SS0).
//
// The approval gate lives in lib/promo-publish.publishPromoVideo, not here --
// this route never reads or writes caption/channels/approved directly, so
// there is exactly one place that can flip a video from "approved" to
// "posted".
//
// Authentication: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`,
// same pattern as email-tick/season-tick.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getPlatformConfigMap } from '@/lib/partners'
import { parseCadence, isInPublishWindow } from '@/lib/promo-schedule'
import { publishPromoVideo } from '@/lib/promo-publish'

export const dynamic = 'force-dynamic'

// Matches the cron cadence in vercel.json (*/15) -- one tick's window, so a
// tick that lands right at the target minute and the next tick 15 minutes
// later never both think they're "in window" for two different slots.
const WINDOW_MINUTES = 15

export async function POST(request: NextRequest) {
  return handle(request)
}

// GET supported for manual pings, same as the other cron routes.
export async function GET(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured on the server.' },
      { status: 500 },
    )
  }
  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const configMap = await getPlatformConfigMap()
  const cadence = parseCadence(configMap)

  if (!isInPublishWindow(cadence, now, WINDOW_MINUTES)) {
    return NextResponse.json({ ok: true, ranAt: now.toISOString(), inWindow: false, published: null })
  }

  const admin = createSupabaseAdmin()
  // Oldest-approved-first, one at a time. approved_at ordering (not
  // created_at) so a video approved today doesn't jump ahead of one approved
  // last week and still waiting its turn.
  const { data: candidate, error } = await admin
    .from('promo_videos')
    .select('id')
    .eq('approved', true)
    .is('posted_at', null)
    .not('video_url', 'is', null)
    .order('approved_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!candidate) {
    // Honest "nothing to do" -- distinct from a paused cadence (inWindow
    // would be false above); this is "in window, but 0 approved videos
    // waiting", reported rather than silently swallowed.
    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      inWindow: true,
      published: null,
      reason: 'no_approved_unposted_video',
    })
  }

  const result = await publishPromoVideo(candidate.id as string, 'cron')
  return NextResponse.json({
    ok: result.ok,
    ranAt: now.toISOString(),
    inWindow: true,
    published: candidate.id,
    result,
  })
}
