// The half of the scoring lease the worker cannot cover.
//
// oxxovo-scoring reclaims its own stale `in_progress` rows at the top of every
// batch. That closes the common case -- a worker that crashed and came back --
// and it is the right place for it, because reclaiming a row is only useful when
// a worker exists to re-score it.
//
// ★It cannot cover a fleet that stays down, and that case is worse, not better.
// A row stuck `in_progress` is invisible to every counter we have: pickPending
// treats it as done, countExhaustedFailed and countBlockingFailed both look for
// 'failed', and countUnfinished only stops the preliminary from finalizing --
// silently, with no alert. So the preliminary hangs and nobody is told.
//
// This does NOT reclaim. Writing to the worker's rows from the app would be a
// second author for one mechanism, and the CAS the worker relies on
// (judged_status + processing_attempts) exists precisely so one writer owns a
// claim at a time. The app's job here is to say the words out loud.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// ★Mirrors oxxovo-scoring's LEASE_STALE_MS (2 x ITEM_DEADLINE_MS = 46.3 min,
// derived there from the pipeline's declared timeouts). Deliberately a little
// higher: the worker must get its own reclaim in first, and an alert that beats
// the fix to the inbox is an alert people learn to ignore.
//
// ★Cross-repo constants cannot be imported, so this one is checked rather than
// assumed: scoringLeaseWatch reports the threshold it used, and the season-tick
// report carries it. If the worker's value moves, the two numbers disagree in
// the tick output instead of drifting in silence.
export const SCORING_LEASE_ALERT_MS = Math.max(
  60_000,
  Number(process.env.SCORING_LEASE_ALERT_MS ?? 3_600_000),
)

export type StuckScoringRow = {
  applicationId: string
  seasonId: string | null
  round: string
  attempts: number
  ageMinutes: number
}

export type ScoringLeaseWatchReport = {
  thresholdMinutes: number
  stuck: StuckScoringRow[]
  error?: string
}

type Row = {
  application_id: string
  season_id: string | null
  round: string
  processing_attempts: number | null
  started_at: string | null
}

/**
 * Which claimed rows are overdue. Pure, so the boundary can be tested without a
 * database and without waiting 46 minutes.
 *
 * ★A NULL started_at counts as overdue. The column is stamped on every claim
 * (startScoringRow writes it on both the INSERT and the UPDATE path), so a row
 * that is `in_progress` without one is a row we cannot age -- and "cannot tell"
 * has to surface as "look at this", not as "fine". Treating unknown as healthy
 * is the exact move that made screening_score nullable this morning.
 */
export function overdueRows(rows: Row[], nowMs: number, thresholdMs: number): StuckScoringRow[] {
  const out: StuckScoringRow[] = []
  for (const r of rows) {
    const startedMs = r.started_at ? new Date(r.started_at).getTime() : NaN
    const age = Number.isFinite(startedMs) ? nowMs - startedMs : Infinity
    if (age < thresholdMs) continue
    out.push({
      applicationId: r.application_id,
      seasonId: r.season_id,
      round: r.round,
      attempts: r.processing_attempts ?? 0,
      ageMinutes: Number.isFinite(age) ? Math.round(age / 60_000) : -1,
    })
  }
  // Oldest first: if the list is long, the top of it is the one that has been
  // waiting since the outage started.
  return out.sort((a, b) => b.ageMinutes - a.ageMinutes)
}

/** Human-readable body for the admin alert. Separate so it is testable too. */
export function stuckAlertHtml(report: ScoringLeaseWatchReport): string {
  const rows = report.stuck
    .map(
      (s) =>
        `<li><code>${s.applicationId}</code> — ${s.seasonId ?? '(no season)'} / ${s.round}, ` +
        `attempt ${s.attempts}, ${s.ageMinutes < 0 ? 'started_at is NULL' : `${s.ageMinutes} minutes`}</li>`,
    )
    .join('')
  return (
    `<p><strong>${report.stuck.length}</strong> scoring row(s) have been held ` +
    `<code>in_progress</code> for longer than ${report.thresholdMinutes} minutes.</p>` +
    `<p>The scoring worker reclaims its own stale claims at the start of every batch, ` +
    `so rows this old mean <strong>the worker is not running</strong> — not that a single ` +
    `scoring attempt is slow.</p>` +
    `<ul>${rows}</ul>` +
    `<p>Nothing else reports these. They are not <code>failed</code>, so the retry-exhausted ` +
    `counters do not see them, and <code>pickPending</code> skips them as already claimed. ` +
    `The preliminary will not finalize while any of them exist.</p>` +
    `<p>This is a system fault, not a participant one — no entrant may be rejected for it.</p>`
  )
}

/**
 * Look for scoring claims nobody is holding any more. Never throws: this runs
 * inside the season tick, and a watcher that takes the tick down with it costs
 * more than the thing it watches.
 */
export async function watchScoringLeases(
  now: Date = new Date(),
): Promise<ScoringLeaseWatchReport> {
  const thresholdMinutes = Math.round(SCORING_LEASE_ALERT_MS / 60_000)
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('scoring_results')
      .select('application_id, season_id, round, processing_attempts, started_at')
      .eq('judged_status', 'in_progress')
    if (error) return { thresholdMinutes, stuck: [], error: error.message }
    return {
      thresholdMinutes,
      stuck: overdueRows((data ?? []) as Row[], now.getTime(), SCORING_LEASE_ALERT_MS),
    }
  } catch (e) {
    return { thresholdMinutes, stuck: [], error: e instanceof Error ? e.message : String(e) }
  }
}
