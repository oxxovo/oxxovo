// Whether "Approve Top 3 Awards" may run. PURE -- no DB, no env.
//
// Today the only gate on approveTop3Awards is requireAdmin(). Everything else it
// needs to be true, it assumes:
//
//   - rankMainRound filters `finalScore != null`, so an entry whose main-round
//     scoring has not finished is silently DROPPED from the ranking rather than
//     blocking it. Press the button mid-scoring and the podium is whoever
//     happened to be judged first.
//   - the community score is normalised against the current maximum vote count
//     (computeCommunityScore), so pressing mid-vote ranks on a partial tally.
//   - nothing checks the calendar at all, so it can be pressed the day
//     applications close.
//
// None of those fail loudly. They produce a plausible podium, write award_rank,
// flip status to 'awarded', and fire the prize-payout email -- and the email is
// the part that cannot be taken back. So the three assumptions become three
// gates, stated here and asserted by tests.
//
// The escape hatch already exists and is deliberately narrower: saveAwardOverride
// sets one rank at a time and REQUIRES a written reason, which lands in
// award_override_reason as audit evidence. Blocking the bulk button does not
// leave an operator stuck; it makes the exceptional path look exceptional.

import { getSeasonPhase, type SeasonPhase, type SeasonPhaseInput } from './season-phase'

export type AwardsGateBlock =
  /** The season has not reached the point where a podium exists yet. */
  | 'schedule_not_reached'
  /** Winners are already recorded. Use the per-entry override instead. */
  | 'already_awarded'
  /** No main-round submissions to rank. */
  | 'nothing_submitted'
  /** Some submitted entries are still unscored -- the ranking would be partial. */
  | 'scoring_incomplete'
  /** Votes count this season, but the vote window is unscheduled or still open. */
  | 'vote_window_open'

export type AwardsGateInput = {
  season: SeasonPhaseInput
  /** Entries with main_round_submitted_at set. */
  submittedCount: number
  /** Of those, entries with a completed round='main' scoring_results row. */
  scoredCount: number
  /** seasons.community_vote_weight. 0 = votes do not enter the final score. */
  communityVoteWeight: number
  /** seasons.community_vote_end_at. */
  voteEndAt: string | null
}

export type AwardsGateResult = {
  ok: boolean
  blocked: AwardsGateBlock | null
  phase: SeasonPhase
  /** Per-gate outcome, so the admin screen can show which one is holding. */
  checks: {
    schedule: 'pass' | 'fail'
    scoring: 'pass' | 'fail'
    /** not_applicable when community_vote_weight is 0 -- the gate is vacuous, not skipped. */
    vote: 'pass' | 'fail' | 'not_applicable'
  }
  /** One line for logs and the admin screen. Never shown to entrants. */
  detail: string
}

function ms(v: string | null): number | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

export function evaluateAwardsGate(
  input: AwardsGateInput,
  now: Date = new Date(),
): AwardsGateResult {
  const { phase } = getSeasonPhase(input.season, now)

  // ---- Gate 0: idempotency -------------------------------------------------
  // ★Counted directly, NOT inferred from the phase. Approval writes award_rank
  // and fires the payout email; the audience-facing 'results' phase only starts
  // at awards_announcement_at. Between those two the ranks exist but the phase is
  // still 'awaiting_results' -- so keying idempotency off the phase would let the
  // button be pressed a second time in exactly that window, re-firing the email.
  // "too early" and "already done" are opposite problems; they get separate
  // answers so the operator knows which one they hit.
  if (input.season.winnerCount > 0) {
    return {
      ok: false,
      blocked: 'already_awarded',
      phase,
      checks: { schedule: 'pass', scoring: 'pass', vote: 'pass' },
      detail: `${input.season.winnerCount} winners are already recorded — use the per-entry override to change a rank`,
    }
  }

  // ---- Gate 1: schedule ----------------------------------------------------
  // 'awaiting_results' is exactly the window this button is for: the main round
  // and the vote are over, and no rank has been written yet. It exists as its own
  // phase precisely because award_rank is a manual approval, so the gap between
  // "voting closed" and "ranks approved" is real (see lib/season-phase.ts).
  if (phase !== 'awaiting_results') {
    return {
      ok: false,
      blocked: 'schedule_not_reached',
      phase,
      checks: { schedule: 'fail', scoring: 'fail', vote: 'fail' },
      detail: `season is in '${phase}' — approval opens at 'awaiting_results'`,
    }
  }

  // ---- Gate 2: scoring completeness ---------------------------------------
  // ★Counted, not sampled. rankMainRound drops unscored entries instead of
  // failing, so "the list looks fine" is not evidence that the list is complete.
  if (input.submittedCount <= 0) {
    return {
      ok: false,
      blocked: 'nothing_submitted',
      phase,
      checks: { schedule: 'pass', scoring: 'fail', vote: 'fail' },
      detail: 'no main-round submissions to rank',
    }
  }
  if (input.scoredCount < input.submittedCount) {
    return {
      ok: false,
      blocked: 'scoring_incomplete',
      phase,
      checks: { schedule: 'pass', scoring: 'fail', vote: 'fail' },
      detail: `${input.scoredCount}/${input.submittedCount} main-round entries scored — the podium would be drawn from a partial set`,
    }
  }

  // ---- Gate 3: vote completeness ------------------------------------------
  // ★Dynamic, never hardcoded to season 0. When community_vote_weight is 0 the
  // votes do not enter the final score at all, so there is nothing to wait for --
  // reported as not_applicable rather than silently passing, so the admin screen
  // can say WHY it did not apply.
  const voteApplies = input.communityVoteWeight > 0
  if (voteApplies) {
    const voteEnd = ms(input.voteEndAt)
    if (voteEnd == null || now.getTime() < voteEnd) {
      return {
        ok: false,
        blocked: 'vote_window_open',
        phase,
        checks: { schedule: 'pass', scoring: 'pass', vote: 'fail' },
        detail:
          voteEnd == null
            ? `community_vote_weight=${input.communityVoteWeight} but community_vote_end_at is not set — the window can never close`
            : 'community voting is still open — the tally would be partial',
      }
    }
  }

  return {
    ok: true,
    blocked: null,
    phase,
    checks: {
      schedule: 'pass',
      scoring: 'pass',
      vote: voteApplies ? 'pass' : 'not_applicable',
    },
    detail: voteApplies
      ? `all three gates pass (${input.scoredCount}/${input.submittedCount} scored, vote closed)`
      : `schedule + scoring pass (${input.scoredCount}/${input.submittedCount} scored); votes do not count this season (weight=0)`,
  }
}
