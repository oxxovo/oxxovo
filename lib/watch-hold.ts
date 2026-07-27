// Prelim fairness hold -- the shared release mutation.
//
// Held prelim entries (watch_hold=true) are invisible to everyone until the
// whole cohort is released together, so an early submitter's video cannot be
// copied by a later entrant ([[project-prelim-load-structure]]). Two callers
// share this one mutation:
//   MANUAL: admin clicks "예선 전체 공개" (app/watch/actions.ts publishPrelim).
//   AUTO:   season-tick cron, when studio_prelim_auto_publish is on and
//           now >= application_close_at.
//
// It lives here rather than in app/watch/actions.ts because that file is a
// 'use server' module -- a client-callable action boundary. The cron route is
// neither a client nor an action, so the mutation itself belongs in a plain
// server module both can import.
//
// Visibility only -- never touches status/scoring/score columns
// ([[project-scoring-integrity-rules]]). Prelim only; the main round has its own
// main_round_start_at reveal.

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateWatchList } from '@/lib/watch-cache'

export type PrelimHoldRelease = { released: number; error?: string }

// Clears watch_hold for every held entry in the season and returns how many were
// released. Idempotent: a second call matches no rows and releases 0, which is
// what makes the hourly cron safe to re-run.
export async function releasePrelimHoldCore(seasonId: string): Promise<PrelimHoldRelease> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('genesis_applications')
    .update({ watch_hold: false, watch_hold_released_at: new Date().toISOString() })
    .eq('season_id', seasonId)
    .eq('watch_hold', true)
    .select('id')
  if (error) return { released: 0, error: error.message }

  const released = data?.length ?? 0
  // Only bust the cache when something actually changed -- the cron calls this
  // every hour long after the release, and dropping the cached list each time
  // would leave /watch permanently uncached at exactly the wrong moment.
  if (released > 0) {
    revalidateWatchList()
    revalidatePath('/watch')
    revalidatePath('/admin/watch-videos')
  }
  return { released }
}
