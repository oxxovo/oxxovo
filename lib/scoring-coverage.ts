// ⑥G 갭 1 -- "how many entries have no judgment attached", which is the one
// number the preliminary judging day turns on. Pure; no database.
//
// ★THE DEFECT THIS EXISTS FOR. The dashboard counts completed / in_progress /
// failed, and all three are counts of ROWS IN scoring_results. An entry that was
// never enqueued has no row at all, so it is not failed and it is not pending --
// it is in none of the three. The panel therefore reads identically whether
// every entry is covered or a hundred are missing, and the missing ones are the
// only ones an operator can still do something about on 11/7.
//
// A denominator fixes it, but only if it is the SAME denominator the scorer
// uses. `free_entry_url IS NOT NULL` is what makes an entry scorable, so that is
// what "scorable" means here -- not "submitted", not "not rejected".

// ★What "the scorer is supposed to cover" means, in one place. The dashboard
// expresses it as a PostgREST filter (`.not('free_entry_url','is',null)`) because
// it counts server-side, and the applications list expresses it as this
// predicate because it filters rows already in the browser. Those are two
// spellings of one rule and they must not drift, so the rule is named here and
// both sites point at it.
export function isScorable(row: { free_entry_url: string | null }): boolean {
  return !!row.free_entry_url?.trim()
}

// An entry the scorer never received: it has a film, and there is no scoring row
// of any status. ★Not the same as `judged_status === null` on its own -- an
// applicant who never submitted a film is also null there, and counting them as
// a coverage gap would bury the real ones in noise.
export function isUnjudged(row: {
  free_entry_url: string | null
  judged_status: string | null
}): boolean {
  return isScorable(row) && row.judged_status === null
}

export type ScoringCoverage = {
  // Entries with a preliminary film: the set the scorer is supposed to cover.
  scorable: number
  // Of those, how many have a scoring_results row of any status.
  judged: number
  // ★Of those, how many have NO row. Not pending -- absent.
  unjudged: number
}

export function scoringCoverage(
  scorableIds: readonly string[],
  judgedIds: readonly string[],
): ScoringCoverage {
  const scorable = new Set(scorableIds)
  const judged = new Set(judgedIds)
  let covered = 0
  for (const id of scorable) if (judged.has(id)) covered++
  return {
    scorable: scorable.size,
    judged: covered,
    unjudged: scorable.size - covered,
  }
}

// ★Counted by INTERSECTION, not by subtracting one total from the other.
//
// Subtraction assumes every scoring row belongs to a scorable entry, and that is
// not guaranteed: a row can outlive the film it scored (an admin clears a URL, an
// entry is withdrawn), and one stray row would then hide a genuinely unjudged
// entry by cancelling it out. The failure would be silent and in the safe-looking
// direction, which is the direction that gets shipped.

// ⑥G gap 3 -- oxxovo-scoring/src/recommendations.ts:countBlockingFailed (landed
// 2026-08-08, PR #3) holds preliminary Top N finalization when a row exhausts
// its retries: judged_status='failed' AND processing_attempts >= MAX_RETRIES.
// It fires one admin email when it first blocks and then goes silent -- nothing
// in the app re-derives that state, so an operator checking this screen a day
// later, or who missed the email, sees the same empty "not yet completed"
// message a still-scoring season shows. Same failure as gap 1: the number that
// answers the actual question fell out of the count.
//
// ★MAX_RETRIES cannot be imported across repos (same reason
// SCORING_LEASE_ALERT_MS in lib/scoring-lease-watch.ts is its own constant, not
// a shared one) -- SCORING_MAX_RETRIES mirrors the worker's env var under a
// distinct name so the two cannot collide, and is reported alongside the count
// rather than assumed equal.
export const SCORING_MAX_RETRIES = Math.max(1, Number(process.env.SCORING_MAX_RETRIES ?? 3))

// Retries exhausted, full stop -- what the worker's countExhaustedFailed reports
// (season-wide, for the admin email). Does not know about withdrawal/rejection.
export function isExhaustedFailed(
  row: { judged_status: string | null; processing_attempts: number | null },
  maxRetries: number,
): boolean {
  return row.judged_status === 'failed' && (row.processing_attempts ?? 0) >= maxRetries
}

// ★Same status exclusion countBlockingFailed applies before it counts a row
// against the gate: an entry already out of the running (rejected / withdrawn /
// waitlist) cannot block a finalization it is not part of. Resolving one of
// these -- explicitly rejecting/withdrawing it, or resetting processing_attempts
// for a rescoring attempt -- is exactly what lets the count (and the gate) drop.
const OUT_OF_RUNNING = new Set(['rejected', 'withdrawn', 'waitlist'])

export function isBlockingFailed(
  row: { judged_status: string | null; processing_attempts: number | null; status: string },
  maxRetries: number,
): boolean {
  return isExhaustedFailed(row, maxRetries) && !OUT_OF_RUNNING.has(row.status)
}
