// Vercel Cron entrypoint -- every 5 minutes (vercel.json). Content dispatch
// (design SS5-1): its own route, deliberately NOT merged into the */15 handlers
// (one failing must not take the other down).
//
// All behaviour lives in lib/content-dispatch.ts; this file only authenticates
// and wires the real dependencies.
//
// Authentication: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
import { NextRequest, NextResponse } from 'next/server'
import { runDispatchTick } from '@/lib/content-dispatch'
import { realDispatchDeps } from '@/lib/content-dispatch-admin'

export const dynamic = 'force-dynamic'
// ★DECLARED. Must stay a literal (Next reads it statically) and must equal
// DISPATCH_MAX_DURATION_SEC in lib/content-dispatch.ts -- the sweep threshold
// and the time budget are computed from that constant. lib/content-dispatch.test.ts
// fails if the two differ.
export const maxDuration = 300

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
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured on the server.' }, { status: 500 })
  }
  if ((request.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runDispatchTick(realDispatchDeps())
    // One summary line per tick. A cron's response body is not kept by Vercel,
    // so without this "which stage did the tick end in" is unobservable (the
    // closed-switch state leaves no other trace). No ids, no content text.
    console.log(
      '[content-dispatch] ' +
        JSON.stringify({
          stage: report.stage,
          processed: report.processed,
          swept: report.swept,
          alerted: report.alerted,
          stopped: report.stopped,
          warnings: report.warnings,
        }),
    )
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[content-dispatch] tick crashed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
