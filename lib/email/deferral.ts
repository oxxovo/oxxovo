// Two rules for "not now", kept together because they answer the same question
// and are the only two answers that must NOT look like failure.
//
// A cron tick can decline to send for two reasons that have nothing to do with
// the recipient: the invocation is running out of time, or Resend is rate
// limiting. Both used to land in the same bucket as a bounced address --
// silently in the first case (the function was killed mid-loop and the report
// only counted what happened), and destructively in the second (a 'failed' row
// starts canSend's 15/30/60/120-minute backoff and gives up on the fifth).
//
// Pure and clock-injected so they can be tested without waiting.

// ── Resend rate limiting ────────────────────────────────────────────────────

/**
 * Is this Resend error the rate limit rather than a real rejection?
 *
 * ★Measured 2026-08-08 against the live account: the team limit is 10 requests
 * per second (`ratelimit-policy: 10;w=1`), and email-tick sends strictly
 * serially at 2-3 per second, so this should never fire. That is the reason to
 * write it rather than the reason to skip it -- the branch that never runs is
 * the one that is wrong when it finally does.
 *
 * Three checks because the error shape is not guaranteed: the SDK's typed error
 * carries `name`, a transport-level failure may carry only a status, and
 * anything in between may give only prose.
 */
export function isRateLimitError(error: {
  name?: string
  message?: string
  statusCode?: number
}): boolean {
  if (error.statusCode === 429) return true
  if (error.name === 'rate_limit_exceeded') return true
  return /rate.?limit|too many requests/i.test(error.message ?? '')
}

// ── the tick's send budget ──────────────────────────────────────────────────
//
// email-tick declares maxDuration = 300. The 11/8 12:00 finalist tick mails the
// whole cohort (around 450), and each send costs four Supabase round trips, one
// Resend POST and a React email render. At the round-trip times measured that
// is 180s-315s against the 300s ceiling -- so the tick is not comfortably
// inside it, and four other template passes share the same invocation.
//
// 60 of the 300 seconds are held back rather than spent. The slowest single
// Resend call measured was 3.9s, so the reserve covers a long tail many times
// over; that is why `budgetAllows` only has to fit ONE more average send
// instead of guessing at a worst case.
export const TICK_BUDGET_MS = 240_000

// ★Seeded at the slow end of what was measured, not at zero. An empty average
// would wave the first sends through on optimism, and the first sends are
// exactly the ones with no evidence behind them.
export const TICK_BUDGET_SEED_MS = 700

export type TickBudget = {
  readonly deadlineMs: number
  /** Running mean ms per ATTEMPTED send (skips excluded -- see budgetRecord). */
  avgMs: number
  attempts: number
}

export function makeTickBudget(startedAtMs: number): TickBudget {
  return {
    deadlineMs: startedAtMs + TICK_BUDGET_MS,
    avgMs: TICK_BUDGET_SEED_MS,
    attempts: 0,
  }
}

/** Room for one more send at the cost observed so far? */
export function budgetAllows(b: TickBudget, nowMs: number = Date.now()): boolean {
  return nowMs + b.avgMs <= b.deadlineMs
}

/**
 * Fold one send's real cost into the mean.
 *
 * ★Only real sends are recorded. A skip costs one query and no Resend call, so
 * feeding skips in would drag the average toward a number no send can achieve
 * and talk the budget into one more attempt it cannot afford -- and a batch that
 * is mostly skips (a re-run tick) is precisely where that would happen.
 */
export function budgetRecord(b: TickBudget, elapsedMs: number): void {
  b.attempts++
  // Plain running mean, not an EMA. An EMA reacts faster to a genuinely slow
  // patch, but it also reacts to one 3.9s spike by deferring a batch that was
  // fine -- and spikes are what the 60s reserve is for.
  b.avgMs += (elapsedMs - b.avgMs) / b.attempts
}
