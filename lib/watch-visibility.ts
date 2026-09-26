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
// the test harness or by a plain server module. This file has no imports at all
// (isFixtureSeason below is imported from lib/season-fixture.ts, which is itself
// import-free for the same reason), which is the point: the rule is testable and
// reusable, and there is one of it.

import { isFixtureSeason } from './season-fixture'

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

// ── Season-level gate (Phase 0-B, HQ 2026-09-27) ────────────────────────────
//
// Orthogonal to isRowPublic: that decides whether ONE ROW is public within its
// own season; this decides whether the SEASON ITSELF may expose any rows to the
// public surface at all. A fixture/rehearsal season is excluded unless it
// carries the watch_fixture_visible escape hatch (HQ 2026-08-27) -- e.g. a
// rehearsal that deliberately opts one fixture season into being watchable so
// its own vote/reveal steps can be observed on /watch.
//
// ★WHY THIS EXISTS AS ITS OWN FUNCTION, not just inline logic repeated per
// caller: before this, lib/watch.ts's loadWatchVideos() (the /watch LIST) had
// this rule inline, but getWatchVideo() (the /watch/[id] DETAIL page) had no
// season-level check at all -- it only ran isRowPublic() on the row itself. A
// direct URL to a fixture season's video therefore bypassed the list's
// exclusion entirely. Reproduced live 2026-09-27: a season_test row (fixture,
// watch_fixture_visible=false) returned HTTP 200 on /watch/[id] despite being
// absent from /watch's grid. ONE function now, used by the list, the detail
// page, AND the public stats API (app/api/watch/stats/route.ts) -- so the three
// surfaces cannot drift into three different answers again.
export type FixtureVisibilityRow = {
  id: string
  season_number: number
  is_fixture?: boolean | null
  // Absent (undefined) on any read that cannot see the column at all -- e.g.
  // the seasons_public view, which does not carry watch_fixture_visible. undefined
  // must NEVER be treated as an exemption, or every fixture reached through a
  // column-limited read would default open. The `!== true` check below already
  // gives that: undefined !== true is false -> not exempt -> excluded, which is
  // the safe (fail-closed) direction.
  watch_fixture_visible?: boolean | null
}

export function isSeasonPublic(season: FixtureVisibilityRow): boolean {
  if (!isFixtureSeason(season)) return true
  return season.watch_fixture_visible === true
}
