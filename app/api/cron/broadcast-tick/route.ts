// Admin recipient-console cron (vercel.json). Fires the broadcast send loop
// (lib/email/broadcast-tick.ts) -- separate from /api/cron/email-tick on
// purpose: email-tick's own comment already says its 300s ceiling is not
// comfortably inside what its five existing template passes cost, and this
// route can carry a few hundred recipients across several ticks. Sharing the
// invocation would let a broadcast campaign delay time-sensitive
// transactional mail (deadline reminders, results). Scheduled 7 minutes off
// email-tick's :00/:15/:30/:45 so the two never fire in the same minute.
//
// Auth: same as /api/cron/email-tick -- `Authorization: Bearer ${CRON_SECRET}`.

import { NextRequest, NextResponse } from 'next/server'
import { runBroadcastTick } from '@/lib/email/broadcast-tick'

export const dynamic = 'force-dynamic'
// Same ceiling as email-tick -- the Node runtime's Pro limit, and
// lib/email/deferral.ts's TICK_BUDGET_MS is sized against it.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  return handle(request)
}

// GET is supported only so the route is convenient to ping manually during
// development. Vercel Cron itself uses GET.
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

  const report = await runBroadcastTick(Date.now())
  return NextResponse.json({ ok: true, ...report })
}
