// ★THE rule for "is this entry visible to the public", with no database and no
// Next runtime in the way.
//
// It used to live inside lib/watch.ts as a private helper. That was fine while
// /watch was the only reader, but it is not: the growth-engine email ("your film
// is live") must fire on exactly the moment this predicate flips to true, and an
// email that ships its own copy of the rule is a second answer to the question --
// the shape of bug this repo has already paid for twice (the /apply allow list
// vs the season column, deriveLobbyMode vs toLobbyMode).
//
// lib/watch.ts imports 'server-only' and next/cache, so it cannot be imported by
// the test harness or by a plain server module. This file has no imports at all,
// which is the point: the rule is testable and reusable, and there is one of it.

// Competition statuses that hide an entry outright. 'flagged' is a moderation
// verdict on the entry, not a scoring one -- see [[project-system-error-not-user-rejection]]
// for why a failed system step must never be folded in here.
const HIDDEN_STATUSES = new Set(['flagged'])

export type VisibilityRow = {
  status: string
  watch_hidden: boolean | null
  moderation_status: string | null
  watch_hold: boolean | null
}

// A video is PUBLIC only when: competition status isn't hidden, an admin hasn't
// hidden it (watch_hidden), the fairness hold has been released, AND AI
// pre-moderation approved it. New submissions start moderation_status='pending'
// (not public) until the scan passes -- the content-safety gate (TK 2026-06-28,
// Patent 3). Existing rows default 'approved' so nothing already present
// disappears.
export function isRowPublic(row: VisibilityRow): boolean {
  if (HIDDEN_STATUSES.has(row.status)) return false
  if (row.watch_hidden) return false
  // Fairness hold (anti-copy): held prelim entries are invisible to EVERYONE until
  // the cohort is released (manual admin or scheduled auto). Orthogonal to the
  // bad-content hide (watch_hidden) and the safety scan (moderation_status).
  if (row.watch_hold) return false
  if (row.moderation_status !== 'approved') return false
  return true
}
