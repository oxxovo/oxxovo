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

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type PrelimHoldRelease = { released: number; error?: string }

// ★THE hold decision, in one place. Every stamp site calls this and none of them
// re-derives it from the switch alone.
//
// The switch is not enough on its own. A submission accepted before the deadline
// can be FINALIZED up to 24h later (the processing buffer), and finalize stamps
// the hold at publish time -- so a submission that lands after the cohort has
// been released was being put straight back under the hold. On the auto release
// the next hourly tick frees it; on the MANUAL release nobody does, and that
// entry stays invisible for the rest of the competition while every log reads
// normal. So the release, not the clock and not the switch, ends the hold.
export function holdDecision(
  season: { studio_prelim_hold_enabled?: boolean | null; prelim_released_at?: string | null } | null,
): boolean {
  if (!season?.studio_prelim_hold_enabled) return false
  return !season.prelim_released_at
}

// Read the two inputs for one season. Never throws.
//
// ★Read in TWO steps on purpose. PostgREST rejects an entire select for one
// unknown column, so a single query naming prelim_released_at returns NOTHING
// until the migration has run -- including the switch. Same shape as the music
// gate, and the same lesson as the 2026-08-03 finalize bug: one un-migrated
// column takes the whole statement with it.
//
// ★Fail CLOSED, in the direction that keeps a video hidden rather than
// published early: an unreadable release marker is treated as "not released".
// Holding is recoverable (the button, or the next tick); publishing a cohort
// early is not.
export async function shouldHoldPrelim(seasonId: string | null | undefined): Promise<boolean> {
  if (!seasonId) return false
  const admin = createSupabaseAdmin()
  const { data: sw, error: swErr } = await admin
    .from('seasons')
    .select('studio_prelim_hold_enabled')
    .eq('id', seasonId)
    .maybeSingle()
  if (swErr || !sw?.studio_prelim_hold_enabled) return false

  const { data: rel, error: relErr } = await admin
    .from('seasons')
    .select('prelim_released_at')
    .eq('id', seasonId)
    .maybeSingle()
  if (relErr) {
    console.warn(`[watch-hold] release marker unreadable for ${seasonId}, keeping the hold: ${relErr.message}`)
    return true
  }
  return holdDecision({ studio_prelim_hold_enabled: true, prelim_released_at: rel?.prelim_released_at ?? null })
}

// Clears watch_hold for every held entry in the season and returns how many were
// released. Idempotent: a second call matches no rows and releases 0, which is
// what makes the hourly cron safe to re-run.
export async function releasePrelimHoldCore(seasonId: string): Promise<PrelimHoldRelease> {
  const admin = createSupabaseAdmin()

  // ★MARK THE SEASON FIRST, then clear the rows. The two orders fail
  // differently: marked-but-not-cleared leaves entries hidden that an operator
  // can release again, while cleared-but-not-marked is the straggler bug back
  // again -- everything published, and the next finalize re-hides itself.
  // Only when it is still NULL, so the timestamp keeps saying when the cohort
  // actually went out rather than when the cron last ran.
  const { error: markErr } = await admin
    .from('seasons')
    .update({ prelim_released_at: new Date().toISOString() })
    .eq('id', seasonId)
    .is('prelim_released_at', null)
  if (markErr) {
    // Includes "column does not exist" before the migration runs. Not fatal to
    // the release itself -- the rows below still publish -- but it does mean a
    // late finalizer will be held again, so it is an error-level line.
    console.error(`[watch-hold] could not mark ${seasonId} as released (late finalizers will be re-held): ${markErr.message}`)
  }

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
    // ★The rows are already published at this point. A cache bust that throws
    // (revalidatePath outside a request scope -- a test harness, a script) must
    // not turn a completed release into a failure the caller reports as one.
    try {
      // ★Imported HERE, not at the top of the file. lib/studio.ts now depends on
      // this module for the hold decision, and a top-level `next/cache` import
      // would drag the whole Next cache runtime into every context that touches
      // a submission -- including the CLI harnesses, where it does not resolve
      // at all and turned every one of them into a module-not-found.
      const { revalidatePath } = await import('next/cache')
      const { revalidateWatchList } = await import('@/lib/watch-cache')
      revalidateWatchList()
      revalidatePath('/watch')
      revalidatePath('/admin/watch-videos')
    } catch (e) {
      console.warn(`[watch-hold] released ${released} but could not bust the cache: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { released }
}
