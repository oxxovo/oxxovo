// Pure fixture-detection helpers, split out of lib/lobby.ts (2026-08-27, HQ
// build-break fix). No imports -- that is the point: lib/seasons.ts is
// reachable from a Client Component (app/admin/seasons/SeasonForm.tsx), and
// lib/lobby.ts carries a dynamic `import('./supabase-admin')` elsewhere in
// the file. Once lib/seasons.ts started asking isFixtureSeason (c86a4a9),
// importing it from './lobby' pulled lib/lobby.ts's whole module graph --
// dynamic import included -- into the client bundle, and 'server-only'
// (inside supabase-admin.ts) fails the build the moment it is reachable from
// any client-tagged module. lib/lobby.ts re-exports both names below so every
// existing '@/lib/lobby' import (season-tick, email-tick, host/new/actions,
// lib/lobby.test.ts) keeps working unchanged; only lib/seasons.ts now imports
// straight from here.

/** Ids we control by written convention. Each entry is a rule someone must follow, not a guess. */
const FIXTURE_ID_PREFIXES = [
  'zz_', // one-shot probe rows -- MANDATED by the go-live checklist C7
  'season_test', // pipeline seasons -- e2e/lib.mjs treats these as untouchable (TK 2026-07-14)
  'season_e2e', // the E2E harness season -- e2e/lib.mjs SEASON
  'season_loadtest', // load-test fixtures
] as const

// ★Everything at or above this is a fixture, and the number is chosen to be
// absurd rather than tight. season_0 runs about two months end to end (public
// 9/9 -> winner 11/16), so even at a monthly cadence -- far faster than anything
// planned -- 900 seasons is ~75 years. It is not "900 weeks": that reading was
// wrong when this rule was first drafted and is corrected here, because a
// comment carrying a false justification is how the next person talks themselves
// into lowering the threshold.
//
// It has to cover 997: e2e/zz-season.mjs deliberately picks 997 to sit BELOW the
// existing 1006 so it is not the newest season. A 998 cut would have leaked it.
const FIXTURE_SEASON_NUMBER_MIN = 900

/**
 * A rehearsal / test / harness season rather than a competition we run in public.
 *
 * Two clauses because the fixtures do not share one marker: the id-prefix clause
 * catches the conventions that are actually written down and enforced, and the
 * number clause catches season_1000..1006, which follow no id convention at all.
 *
 * ★NO LONGER THE LOBBY'S GATE (2026-08-09). It is the FALLBACK: the lobby asks
 * isFixtureSeason, which prefers the is_fixture column and only lands here when
 * the column did not travel on that particular read. Kept, and kept exported,
 * because a read with a narrow select list is still a real case -- and because
 * email-tick uses it directly on rows it fetches for other reasons.
 *
 * ★ITS LIMITATION IS THEREFORE STILL LIVE, just no longer load-bearing on the
 * home page: a rehearsal season numbered below 900 with an id matching none of
 * the prefixes is invisible to this function. Nothing at season creation enforces
 * either convention -- app/host/new/actions.ts derives season_number as max+1
 * (1007 today), so the band is polluted by the fixtures themselves and drifts up.
 * That is exactly why the column exists and why this is now second in line.
 */
export function isRehearsalFixture(s: { id: string; season_number: number }): boolean {
  if (FIXTURE_ID_PREFIXES.some((p) => s.id.startsWith(p))) return true
  return Number.isFinite(s.season_number) && s.season_number >= FIXTURE_SEASON_NUMBER_MIN
}

/**
 * Is this season test data? The COLUMN when the read could see one, the old
 * heuristic when it could not.
 *
 * ★The two branches are not a fallback chain, they are two different questions
 * being answered by whatever evidence the caller actually has:
 *   - `is_fixture` is a boolean a human wrote. It is the truth, and it is
 *     fail-closed (DB default true), so a season nobody vouched for is a
 *     fixture rather than a leak.
 *   - `undefined` does NOT mean false. It means THIS READ could not see the
 *     column, and guessing `false` there would publish every rehearsal season.
 *     ★What that means changed on 2026-08-09: seasons_public was redefined from
 *     66 columns to 68 and now carries is_fixture, so the view is no longer a
 *     reason the column goes missing. What remains is narrower and permanent --
 *     a select list that simply does not name it. That is why this stays
 *     optional rather than becoming a required boolean.
 * So `undefined` falls back to the name/number heuristic. The lobby's own read
 * names the column, so on the home page the column decides.
 */
export function isFixtureSeason(s: {
  id: string
  season_number: number
  is_fixture?: boolean | null
}): boolean {
  if (typeof s.is_fixture === 'boolean') return s.is_fixture
  return isRehearsalFixture(s)
}
