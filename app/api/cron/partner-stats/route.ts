// Weekly partner-stats correction cron (vercel.json). Recomputes every linked
// user's cumulative_top50 / cumulative_wins / partner_tier from
// genesis_applications and auto-promotes none -> auto_eligible when thresholds
// (platform_config) are met. The per-action hooks in
// app/admin/applications/actions.ts keep stats fresh in real time; this cron is
// the backstop that repairs any missed event (e.g. a late user_id backfill).
//
// Recompute is idempotent (source-of-truth, not +1) so re-running is safe.
//
// Auth: same as /api/cron/email-tick — `Authorization: Bearer ${CRON_SECRET}`.

import { NextRequest, NextResponse } from 'next/server'
import { recomputeAllPartnerStats } from '@/lib/partners'
import { isMemberHostedEnabled } from '@/lib/member-hosted'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handle(request)
}

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

  const ranAt = new Date().toISOString()

  // M-2: the partner program is a member-hosted surface. While the master
  // switch is off the cron is a no-op (the row stays in vercel.json so enabling
  // the switch needs no redeploy). recomputeAllPartnerStats is also guarded
  // per-user, but skipping here avoids the whole table scan for nothing.
  if (!(await isMemberHostedEnabled())) {
    return NextResponse.json({ ok: true, ranAt, processed: 0, skipped: 'member_hosted_disabled' })
  }

  const { processed } = await recomputeAllPartnerStats()
  return NextResponse.json({ ok: true, ranAt, processed })
}
