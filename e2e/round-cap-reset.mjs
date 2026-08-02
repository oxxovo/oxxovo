#!/usr/bin/env node
/**
 * ⑪ Per-round generation caps -- does a round actually start a participant at
 * zero? Measured against the LIVE database, ★zero writes, ★zero fal spend.
 *
 * WHAT IT IS ACTUALLY CHECKING, because the mechanism is not what the phrase
 * "cap reset" suggests: nothing is reset. There is no counter and no reset job.
 * `countGenerationsForRound` splits `generation_jobs.created_at` at
 * `seasons.main_round_start_at` (lib/studio.ts) -- `generation_jobs` has NO
 * round column, so the round a clip belongs to is inferred from when it was
 * made. The cap "resets" only in the sense that the main-round query cannot see
 * application-round rows. That is worth testing precisely because it is
 * indirect: the correctness lives in a `.gte`/`.lt` pair and one season column,
 * and either can be wrong without anything raising an error.
 *
 * ★It calls the REAL functions. This repo has been bitten twice by harnesses
 * that re-implemented what they tested and kept passing after the code drifted.
 * The one thing computed here rather than imported is the expected PARTITION of
 * rows the harness already fetched -- one comparison against the same live
 * boundary -- because the thing under test is whether the *query* realises that
 * rule against the database (timezone handling, boundary inclusivity, filters),
 * not whether the comparison can be written twice.
 *
 * Run:
 *   npm run test:round-caps
 */
import { createClient } from '@supabase/supabase-js'
import {
  getSeasonStudioConfig,
  resolveEffectiveRound,
  isInEffectiveRound,
  countGenerationsForRound,
} from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) }
}
const note = (m) => console.log('  note', m)

// ---------------------------------------------------------------------------
// 1. The season columns the cap axis depends on
// ---------------------------------------------------------------------------
console.log('1. season config (live columns, not hardcoded)')
const cfg0 = await getSeasonStudioConfig('season_0')
const { data: raw0, error: rErr } = await admin
  .from('seasons')
  .select('studio_round, main_round_start_at, application_open_at, application_close_at, main_round_end_at, studio_max_image_generations_per_round, studio_max_draft_image_generations_per_round')
  .eq('id', 'season_0')
  .maybeSingle()
if (rErr) throw new Error('seasons: ' + rErr.message)

ok(cfg0.round === raw0.studio_round, `round from the row: ${cfg0.round}`)
ok(
  cfg0.maxImageGenerationsPerRound === raw0.studio_max_image_generations_per_round &&
    cfg0.maxDraftImageGenerationsPerRound === raw0.studio_max_draft_image_generations_per_round,
  `image caps read from seasons, not code: competition=${cfg0.maxImageGenerationsPerRound} draft=${cfg0.maxDraftImageGenerationsPerRound}`,
)
ok(cfg0.mainRoundStartAt === raw0.main_round_start_at, `main_round_start_at from the row: ${cfg0.mainRoundStartAt}`)

// ★The one schedule fact the cap axis OWNS. Everything else about the calendar
// belongs to head office; this does not. If main_round_start_at ever lands
// before application_close_at on a 'both' season, then clips made during the
// application window are counted as main-round clips and the application cap
// stops applying -- silently, with no error anywhere. That inversion has been
// live before (season_0, found 2026-07-27).
{
  const close = Date.parse(raw0.application_close_at ?? '')
  const mainStart = Date.parse(raw0.main_round_start_at ?? '')
  ok(
    Number.isFinite(mainStart),
    `a 'both' season has a boundary at all [${raw0.main_round_start_at}] -- without one there is ONE pool for the whole season`,
  )
  if (Number.isFinite(close) && Number.isFinite(mainStart)) {
    ok(
      mainStart > close,
      `boundary is after the application close (${raw0.application_close_at} -> ${raw0.main_round_start_at})`,
    )
    const gapDays = (mainStart - close) / 86_400_000
    if (gapDays > 0.5) {
      // Not an assertion -- the calendar is head office's. Recorded because the
      // cap axis calls this dead time 'application', which is a defensible
      // answer for a window where nothing can be submitted anyway, but it is
      // the kind of thing better read here than discovered during a season.
      note(`${gapDays.toFixed(1)} day gap between application close and main start; the cap axis calls that window 'application'`)
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Which round is 'now', and the boundary's own instant
// ---------------------------------------------------------------------------
console.log('2. round resolution around the live boundary')
{
  const b = Date.parse(cfg0.mainRoundStartAt ?? '')
  if (!Number.isFinite(b)) {
    ok(false, 'no boundary to test round resolution against')
  } else {
    // Instants derived from the LIVE column, never written down here.
    ok(resolveEffectiveRound(cfg0, new Date(b - 1)) === 'application', 'one ms before the boundary -> application')
    ok(resolveEffectiveRound(cfg0, new Date(b)) === 'main', 'exactly at the boundary -> main')
    ok(resolveEffectiveRound(cfg0, new Date(b + 1)) === 'main', 'one ms after the boundary -> main')

    // ★The counting split and the picker split must agree at the boundary
    // instant, or a clip is visible in one round and charged to the other.
    const atBoundary = new Date(b).toISOString()
    ok(
      isInEffectiveRound(atBoundary, cfg0, 'main') === true &&
        isInEffectiveRound(atBoundary, cfg0, 'application') === false,
      'a clip created exactly at the boundary belongs to main in BOTH splits',
    )
    note(`now resolves to '${resolveEffectiveRound(cfg0)}' for season_0`)
  }
}

// ---------------------------------------------------------------------------
// 3. The actual reset, on real rows
// ---------------------------------------------------------------------------
// Find a (user, season, media_type, tier-class) group that has rows on BOTH
// sides of its season's boundary. Without one, a "the main count excludes
// application rows" assertion is vacuous -- it would pass against a query that
// excluded everything.
console.log('3. the split, on rows that exist on both sides')
const { data: seasons, error: sErr } = await admin.from('seasons').select('id, studio_round, main_round_start_at')
if (sErr) throw new Error('seasons list: ' + sErr.message)
const boundaryOf = new Map(seasons.map((s) => [s.id, Date.parse(s.main_round_start_at ?? '')]))
const roundOf = new Map(seasons.map((s) => [s.id, s.studio_round]))

const { data: jobs, error: jErr } = await admin
  .from('generation_jobs')
  .select('user_id, season_id, media_type, tier, created_at')
if (jErr) throw new Error('generation_jobs: ' + jErr.message)

const groups = new Map()
for (const j of jobs) {
  const b = boundaryOf.get(j.season_id)
  if (!Number.isFinite(b) || roundOf.get(j.season_id) !== 'both') continue
  const kind = j.tier === 'draft' ? 'draft' : 'competition'
  const key = `${j.user_id}|${j.season_id}|${j.media_type}|${kind}`
  const g = groups.get(key) ?? { application: 0, main: 0 }
  if (Date.parse(j.created_at) >= b) g.main++
  else g.application++
  groups.set(key, g)
}

const twoSided = [...groups.entries()].filter(([, g]) => g.application > 0 && g.main > 0)
ok(twoSided.length > 0, `at least one group has rows on both sides of a boundary [${twoSided.length}]`)

for (const [key, expect] of twoSided) {
  const [userId, seasonId, mediaType, kind] = key.split('|')
  const cfg = await getSeasonStudioConfig(seasonId)
  const gotApp = await countGenerationsForRound(userId, seasonId, cfg, 'application', kind, mediaType)
  const gotMain = await countGenerationsForRound(userId, seasonId, cfg, 'main', kind, mediaType)
  const label = `${seasonId}/${mediaType}/${kind} (user ${userId.slice(0, 8)})`

  ok(gotApp === expect.application, `${label}: application count ${gotApp} == rows before the boundary ${expect.application}`)
  ok(gotMain === expect.main, `${label}: main count ${gotMain} == rows at/after the boundary ${expect.main}`)
  // ★THE RESET, stated as the property that matters: the main round does not see
  // what the application round spent. Non-vacuous because both sides are > 0.
  ok(
    gotMain < expect.application + expect.main,
    `${label}: main round starts clean -- ${expect.application} application row(s) excluded from a total of ${expect.application + expect.main}`,
  )
  // Exhaustive + disjoint. A row lost by both filters, or counted by both, breaks
  // this without breaking either count in isolation.
  ok(
    gotApp + gotMain === expect.application + expect.main,
    `${label}: the two rounds partition the rows exactly (${gotApp} + ${gotMain} = ${expect.application + expect.main})`,
  )
}

// ---------------------------------------------------------------------------
// 4. Independence of the caps that share a table
// ---------------------------------------------------------------------------
// image/video and draft/competition are separate ceilings over ONE table, so the
// filters have to be exclusive. Checked as a total, per season: summing the four
// counts for every user must equal the row count for that season.
console.log('4. image/video and draft/competition do not leak into each other')
for (const seasonId of [...new Set(jobs.map((j) => j.season_id))]) {
  if (roundOf.get(seasonId) !== 'both') continue
  const cfg = await getSeasonStudioConfig(seasonId)
  const users = [...new Set(jobs.filter((j) => j.season_id === seasonId).map((j) => j.user_id))]
  let summed = 0
  for (const u of users) {
    for (const mt of ['video', 'image']) {
      for (const k of ['competition', 'draft']) {
        summed += await countGenerationsForRound(u, seasonId, cfg, 'application', k, mt)
        summed += await countGenerationsForRound(u, seasonId, cfg, 'main', k, mt)
      }
    }
  }
  const actual = jobs.filter((j) => j.season_id === seasonId).length
  ok(summed === actual, `${seasonId}: 4 caps x 2 rounds sum to the row count (${summed} == ${actual})`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
