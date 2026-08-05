// Where a season is in its life. ONE machine, PURE -- no DB, no env, no imports.
//
// Before this file there were six independent answers to "what phase is this
// season in", each with its own ordering and its own null policy:
//
//   getBannerStage        lib/watch.ts          awards -> vote -> main -> close
//   deriveLobbyMode       lib/lobby.ts          status -> (mainEnd ?? awards) -> open -> close
//   desiredStatus         season-tick/route.ts  awards -> close -> open
//   inMainRound           ArenaWatch + stats    now >= mainStart, NO upper bound (x2, copy-pasted)
//   resolveSeasonCta      lib/seasons.ts        open/close
//   isApplicationClosed   lib/seasons.ts        close, null = open
//
// They disagree, and the disagreements are visible to the audience:
//
//  - desiredStatus reads awards FIRST, so a season with open/close NULL and only
//    an awards date flips to 'completed' -- rank 4, which the forward-only guard
//    cannot walk back. season_1 was scheduled to do exactly that on 2026-10-13,
//    mid-season-0 (reports/season1_clear_stale_schedule_2026-08-04.sql).
//  - inMainRound has no upper bound, so the hero card says "Main Round" while the
//    banner says voting/results. ArenaWatch carries a named stopgap for this and
//    says it dissolves "once a canonical getSeasonPhase() unifies banner + card
//    + awards gate". This is that.
//  - null means three different things: lobby treats a null close as still
//    accepting, isApplicationClosed treats it as open, and the scoring gate
//    treats it as BLOCK. Same column, three policies.
//
// So the rules live here once, and every surface projects off the result.
//
// ★NOT wired into callers yet -- see reports/season_phase_unification_2026-08-04.md
// for the staged migration. Landing/lobby are mid-flight in another lane.

/**
 * Ordered. A season only ever moves forward through this list, so the index is
 * meaningful and comparisons like `phaseAtLeast(p, 'main_live')` are legal.
 */
export const SEASON_PHASES = [
  'draft', // no open date at all -- announced teaser, schedule TBD
  'upcoming', // open date set, not reached
  'accepting', // applications open
  'judging', // applications closed; processing buffer + scoring, no finalists yet
  'finalists_pending', // finalists chosen, main round not revealed
  'main_live', // main round revealed, voting not open
  'voting', // community vote window open
  // Main round and voting are over and NO winner has been recorded yet. This is
  // a real state, not a gap: award_rank is written by a manual admin approval,
  // so the interval between "voting closed" and "ranks approved" can be long.
  // It has to sort BEFORE results -- the clock reaches it first, and a phase
  // that can be reached earlier but sorts later makes the order a lie.
  'awaiting_results',
  'results', // winners actually recorded
] as const

export type SeasonPhase = (typeof SEASON_PHASES)[number]

export function phaseIndex(p: SeasonPhase): number {
  return SEASON_PHASES.indexOf(p)
}

export function phaseAtLeast(p: SeasonPhase, floor: SeasonPhase): boolean {
  return phaseIndex(p) >= phaseIndex(floor)
}

/**
 * Everything the machine is allowed to look at.
 *
 * Dates are the schedule. Counts are EVIDENCE -- they exist because a date
 * passing is not the same as the thing having happened. Awards are written by a
 * manual admin approval, and renders land asynchronously, so the calendar can be
 * ahead of reality and the audience must never be told otherwise.
 */
export type SeasonPhaseInput = {
  status: string | null
  applicationOpenAt: string | null
  applicationCloseAt: string | null
  /** End of the post-close processing buffer. Sub-phase only; see isProcessingBuffer. */
  scoringStartAt: string | null
  mainRoundStartAt: string | null
  mainRoundEndAt: string | null
  voteStartAt: string | null
  voteEndAt: string | null
  awardsAt: string | null
  /** Entries advanced to the main round. 0 = advancement has not happened yet. */
  finalistCount: number
  /** Entries carrying an award_rank. 0 = winners are NOT announced, whatever the date says. */
  winnerCount: number
}

export type SeasonPhaseResult = {
  phase: SeasonPhase
  /**
   * Inside the post-close processing buffer (renders/finalize/email still
   * running, scoring has not started). A sub-flag rather than a phase: the
   * audience sees 'judging' either way, but operators and the "results soon"
   * copy should be able to tell the difference. Mirrors the worker's gate
   * (oxxovo-scoring src/gate.ts) -- if these two disagree, this one is wrong.
   */
  isProcessingBuffer: boolean
  /** Why this phase, in one line. For logs and admin screens, not for users. */
  reason: string
}

/** Epoch ms or null. Anything unparseable is null, never NaN. */
function ms(v: string | null): number | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/**
 * ★NULL POLICY, stated once for the whole codebase:
 *
 *   A null boundary means NOT SCHEDULED, and an unscheduled boundary NEVER
 *   advances the phase.
 *
 * The one exception is applicationOpenAt: a season with no open date is not
 * "open since forever", it is a teaser whose schedule is TBD -- 'draft'.
 *
 * This is the rule that season_1 broke. It had no open and no close but did have
 * an awards date, and the old ordering read awards first and declared it
 * finished. Under this policy a season cannot reach a late phase by carrying one
 * late date: it has to have walked through the earlier boundaries.
 */
export function getSeasonPhase(
  input: SeasonPhaseInput,
  now: Date = new Date(),
): SeasonPhaseResult {
  const t = now.getTime()
  const open = ms(input.applicationOpenAt)
  const close = ms(input.applicationCloseAt)
  const bufferEnd = ms(input.scoringStartAt)
  const mainStart = ms(input.mainRoundStartAt)
  const mainEnd = ms(input.mainRoundEndAt)
  const voteStart = ms(input.voteStartAt)
  const voteEnd = ms(input.voteEndAt)
  const awards = ms(input.awardsAt)

  const buffer = (phase: SeasonPhase, reason: string): SeasonPhaseResult => ({
    phase,
    isProcessingBuffer:
      phase === 'judging' && close != null && t >= close && bufferEnd != null && t < bufferEnd,
    reason,
  })

  // An admin (or the tick) having marked the season finished is authoritative and
  // terminal. Checked first because it is a decision, not a date.
  if (input.status === 'completed') {
    return buffer(
      input.winnerCount > 0 ? 'results' : 'awaiting_results',
      `status='completed' (winners=${input.winnerCount})`,
    )
  }

  // Teaser: announced with no schedule. Cannot be anywhere but the start, no
  // matter which downstream dates happen to carry values.
  if (open == null) {
    return buffer('draft', 'application_open_at is null (teaser, schedule TBD)')
  }
  if (t < open) {
    return buffer('upcoming', `now < application_open_at (${input.applicationOpenAt})`)
  }

  // Open with no close date stays open. A missing close is an unset boundary, not
  // an expired one -- the same reading the lobby already uses.
  if (close == null || t < close) {
    return buffer('accepting', close == null ? 'application_close_at is null (open-ended)' : 'open <= now < close')
  }

  // ---- past close ----------------------------------------------------------
  // From here the schedule alone is not enough. Each further step needs the
  // evidence that the step actually happened.

  // Winners recorded. The DATE IS NOT ENOUGH: award_rank is written by
  // approveTop3Awards, a manual approval, so awards_announcement_at can pass with
  // zero ranks. Claiming "the winners have been announced" over an empty podium
  // is the failure this gate exists to prevent.
  if (awards != null && t >= awards && input.winnerCount > 0) {
    return buffer('results', `awards passed and ${input.winnerCount} winners recorded`)
  }

  if (voteStart != null && voteEnd != null && t >= voteStart && t < voteEnd) {
    return buffer('voting', 'inside the community vote window')
  }

  // Main round live. Bounded on BOTH sides -- the unbounded version is what left
  // the hero card saying "Main Round" through voting and results.
  if (mainStart != null && t >= mainStart) {
    const over = (voteEnd != null && t >= voteEnd) || (mainEnd != null && t >= mainEnd && voteStart == null)
    if (!over) return buffer('main_live', 'main round revealed, voting not open yet')
    return buffer('awaiting_results', 'main round and vote window are over, no winners recorded')
  }

  // Advanced but not yet revealed.
  if (input.finalistCount > 0 && mainStart != null && t < mainStart) {
    return buffer('finalists_pending', `${input.finalistCount} finalists, reveal at ${input.mainRoundStartAt}`)
  }

  return buffer('judging', 'applications closed, no finalists yet')
}

// ---------------------------------------------------------------------------
// Projections. Every surface reads the phase and maps; nobody re-derives.
// ---------------------------------------------------------------------------

/** Home TOURNAMENTS card state (today: lib/lobby.ts deriveLobbyMode). */
export type LobbyMode = 'upcoming' | 'accepting' | 'live' | 'ended'

export function toLobbyMode(phase: SeasonPhase): LobbyMode {
  switch (phase) {
    case 'draft':
    case 'upcoming':
      return 'upcoming'
    case 'accepting':
      return 'accepting'
    case 'results':
      return 'ended'
    // awaiting_results is NOT 'ended': nothing has been announced, so the card
    // must not present the season as finished business.
    default:
      return 'live'
  }
}

/**
 * seasons.status the tick should move toward (today: desiredStatus).
 *
 * ★'draft' here is what stops a dateless season from declaring itself finished:
 * getSeasonPhase pins an open-less season at 'draft', so the forward-only guard
 * sees rank 0 and leaves it alone. The old ordering read awards first and
 * produced 'completed', rank 4, which nothing could undo.
 */
export function toDbStatus(phase: SeasonPhase): 'draft' | 'active' | 'closed' | 'completed' {
  switch (phase) {
    case 'draft':
    case 'upcoming':
      return 'draft'
    case 'accepting':
      return 'active'
    case 'results':
      return 'completed'
    // ★awaiting_results maps to 'closed', NOT 'completed'. Today desiredStatus
    // flips to completed the moment awards_announcement_at passes, whether or
    // not a single rank was written -- and then the banner (which does check)
    // says something else. Holding at 'closed' until winners exist makes the DB
    // status and the screen agree, and forward-only means it can still only
    // move on.
    default:
      return 'closed'
  }
}

/** Watch banner stage (today: getBannerStage). 1:1 apart from the pre-open half. */
export function toBannerStage(
  phase: SeasonPhase,
): 'accepting' | 'judging' | 'finalists_pending' | 'main_live' | 'voting' | 'results' {
  switch (phase) {
    case 'draft':
    case 'upcoming':
    case 'accepting':
      return 'accepting'
    case 'awaiting_results':
      // ★LOSSY, deliberately. The 6-stage banner enum has no "voting closed,
      // winners not announced yet" stage -- a gap this unification exposed. Of
      // the six, 'judging' is the only one that does not claim an event that has
      // not happened, so it is the conservative landing spot until the banner
      // gains a stage of its own (see the migration report).
      return 'judging'
    default:
      return phase
  }
}

/** Hero card round label (today: the inMainRound copy-paste + the cardRoundName stopgap). */
export function toRoundName(phase: SeasonPhase): string {
  switch (phase) {
    case 'results':
      return 'Results'
    case 'voting':
      return 'Community Vote'
    case 'main_live':
    case 'finalists_pending':
      return 'Main Round'
    case 'awaiting_results':
    case 'judging':
      return 'Judging Complete'
    default:
      return 'Preliminary'
  }
}

/** Whether the scorer should be looking at the main round rather than the prelim. */
export function scoringRoundFor(phase: SeasonPhase): 'application' | 'main' {
  return phaseAtLeast(phase, 'main_live') ? 'main' : 'application'
}

/** Server-side apply gate (today: isBeforeApplicationOpen + isApplicationClosed). */
export function canApply(phase: SeasonPhase): boolean {
  return phase === 'accepting'
}
