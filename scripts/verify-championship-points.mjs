// TEMP verification script for lib/championship-points.ts (HQ 2026-08-18 deploy check).
// Uses season_test. NOTE (found by this script, not assumed): season_test is
// NOT empty -- it carries 41 pre-existing valid genesis_applications rows
// (the promo/demo fixtures from the 2026-08-17 Watch cleanup). All checks
// below are written to be correct regardless of that baseline -- they check
// THIS script's own test rows by id, never a raw total count. Cleans up its
// own test rows/ledger entries at the end (and the ENTIRE season_test ledger,
// since nothing legitimate should be in it yet).
// Run: node --import ./scripts/test-register.mjs scripts/verify-championship-points.mjs
import { createSupabaseAdmin } from '../lib/supabase-admin.ts'
import {
  creditParticipationForSeason,
  creditTop50ForApplications,
  syncAwardPoints,
} from '../lib/championship-points.ts'

const admin = createSupabaseAdmin()
const SEASON = 'season_test'

function line(s) { console.log(s) }
function hr() { console.log('-'.repeat(70)) }
let pass = 0, fail = 0
function check(label, ok, detail) {
  if (ok) { pass++; line(`  OK   ${label}`) }
  else { fail++; line(`  FAIL ${label}  ${detail ?? ''}`) }
}

async function cleanupLedger() {
  await admin.from('championship_points_ledger').delete().eq('season_id', SEASON)
}
async function cleanupApps() {
  await admin.from('genesis_applications').delete().eq('season_id', SEASON).like('email', 'cp-test-%@oxxovo-test.local')
}

await cleanupLedger()
await cleanupApps()

const { data: seasonBefore } = await admin.from('seasons').select('points_fee_basis_usd').eq('id', SEASON).single()
const originalBasis = seasonBefore?.points_fee_basis_usd ?? null
line(`season_test original points_fee_basis_usd = ${originalBasis}`)

const { count: baselineValid } = await admin
  .from('genesis_applications')
  .select('id', { count: 'exact', head: true })
  .eq('season_id', SEASON)
  .not('free_entry_url', 'is', null)
  .neq('status', 'flagged')
line(`season_test baseline valid-submitter count (pre-existing, not this script's rows): ${baselineValid}`)

hr()
line('6) basis NULL -- fail-closed + admin alert (test FIRST, before setting a basis)')
hr()
{
  await admin.from('seasons').update({ points_fee_basis_usd: null }).eq('id', SEASON)
  const result = await creditParticipationForSeason(SEASON)
  line(`  result: ${JSON.stringify(result)}`)
  check('skipped=basis_null', result.skipped === 'basis_null', JSON.stringify(result))
  check('credited=0', result.credited === 0, JSON.stringify(result))
  const { data: rows } = await admin.from('championship_points_ledger').select('id').eq('season_id', SEASON)
  check('no ledger rows written', (rows ?? []).length === 0, `${(rows ?? []).length} rows`)
  line('  (a real admin alert email was sent for this case -- expected, that IS the check)')
}

await admin.from('seasons').update({ points_fee_basis_usd: 50 }).eq('id', SEASON)

hr()
line('setup: 3 valid + 1 invalid (no video) + 1 invalid (flagged) test applications')
hr()
const testApps = [
  { name: 'cp-test-a', free_entry_url: 'https://example.com/a.mp4', status: 'eligible' },
  { name: 'cp-test-b', free_entry_url: 'https://example.com/b.mp4', status: 'eligible' },
  { name: 'cp-test-c', free_entry_url: 'https://example.com/c.mp4', status: 'eligible' },
  { name: 'cp-test-novideo', free_entry_url: null, status: 'pending' },
  { name: 'cp-test-flagged', free_entry_url: 'https://example.com/d.mp4', status: 'flagged' },
]
const inserted = []
for (const t of testApps) {
  const { data, error } = await admin
    .from('genesis_applications')
    .insert({
      season_id: SEASON,
      email: `${t.name}@oxxovo-test.local`,
      creator_name: t.name,
      free_entry_url: t.free_entry_url,
      status: t.status,
      agreed_to_rules: true,
      agreed_to_privacy: true,
      agreed_to_integrity_notice: true,
    })
    .select('id')
    .single()
  if (error) { console.error(`insert ${t.name} failed:`, error.message); process.exit(1) }
  inserted.push({ ...t, id: data.id })
}
const byName = (n) => inserted.find((a) => a.name === n)
line(`  inserted ${inserted.length} test applications`)

hr()
line('1+2) participation -- valid-only (checked by id, baseline-agnostic), headcount/multiplier frozen')
hr()
{
  const result = await creditParticipationForSeason(SEASON)
  line(`  result: attempted=${result.attempted} credited=${result.credited} errors=${result.errors.length}`)
  check('errors=0', result.errors.length === 0, JSON.stringify(result.errors))
  check(
    `attempted = baseline(${baselineValid}) + 3 new valid = ${baselineValid + 3}`,
    result.attempted === baselineValid + 3,
    `got ${result.attempted}`,
  )

  const { data: rows } = await admin
    .from('championship_points_ledger')
    .select('application_id, points_awarded, headcount, multiplier, basis_usd')
    .eq('season_id', SEASON)
    .eq('event_type', 'participation')
  const byAppId = new Map((rows ?? []).map((r) => [r.application_id, r]))
  check('cp-test-a credited', byAppId.has(byName('cp-test-a').id), '')
  check('cp-test-b credited', byAppId.has(byName('cp-test-b').id), '')
  check('cp-test-c credited', byAppId.has(byName('cp-test-c').id), '')
  check('cp-test-novideo NOT credited (free_entry_url NULL)', !byAppId.has(byName('cp-test-novideo').id), '')
  check('cp-test-flagged NOT credited (status=flagged)', !byAppId.has(byName('cp-test-flagged').id), '')
  const aRow = byAppId.get(byName('cp-test-a').id)
  check('points_awarded=50 flat', aRow?.points_awarded === 50, JSON.stringify(aRow))
  check('headcount frozen onto the row (not null)', aRow?.headcount != null, JSON.stringify(aRow))
  check('multiplier frozen onto the row (not null)', aRow?.multiplier != null, JSON.stringify(aRow))
  line(`  frozen on cp-test-a: headcount=${aRow?.headcount} multiplier=${aRow?.multiplier} basis=${aRow?.basis_usd}`)
}

hr()
line('4) idempotent -- running participation again credits nothing new')
hr()
{
  const { count: beforeCount } = await admin
    .from('championship_points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', SEASON)
    .eq('event_type', 'participation')
  const result2 = await creditParticipationForSeason(SEASON)
  check('skipped=already_ran_for_season', result2.skipped === 'already_ran_for_season', JSON.stringify(result2))
  check('credited=0 on second run', result2.credited === 0, JSON.stringify(result2))
  const { count: afterCount } = await admin
    .from('championship_points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', SEASON)
    .eq('event_type', 'participation')
  check(`row count unchanged (${beforeCount} before, ${afterCount} after)`, beforeCount === afterCount, '')
}

hr()
line('3) top50 -- reads the FROZEN headcount/multiplier, does not recompute')
hr()
{
  // Add a late valid application AFTER participation already froze -- if
  // top50 recomputed headcount it would see baseline+4, not the frozen value.
  const { data: lateApp } = await admin
    .from('genesis_applications')
    .insert({
      season_id: SEASON,
      email: 'cp-test-late@oxxovo-test.local',
      creator_name: 'cp-test-late',
      free_entry_url: 'https://example.com/late.mp4',
      status: 'eligible',
      agreed_to_rules: true,
      agreed_to_privacy: true,
      agreed_to_integrity_notice: true,
    })
    .select('id')
    .single()
  inserted.push({ name: 'cp-test-late', id: lateApp.id })

  const top50Targets = [
    { id: byName('cp-test-a').id, user_id: null },
    { id: byName('cp-test-b').id, user_id: null },
  ]
  const result = await creditTop50ForApplications(SEASON, top50Targets)
  check('credited=2', result.credited === 2, JSON.stringify(result))

  const { data: participationRow } = await admin
    .from('championship_points_ledger')
    .select('headcount, multiplier')
    .eq('season_id', SEASON)
    .eq('event_type', 'participation')
    .eq('application_id', byName('cp-test-a').id)
    .single()
  const { data: top50Rows } = await admin
    .from('championship_points_ledger')
    .select('application_id, headcount, multiplier, points_awarded')
    .eq('season_id', SEASON)
    .eq('event_type', 'top50')
  const matchesFrozen = (top50Rows ?? []).every(
    (r) => r.headcount === participationRow.headcount && r.multiplier === participationRow.multiplier,
  )
  check(
    `top50 rows use the FROZEN headcount=${participationRow?.headcount} (late 4th applicant not counted in it)`,
    matchesFrozen,
    JSON.stringify(top50Rows),
  )
  const expectedPoints = 200 * (50 / 50) * participationRow.multiplier
  check(
    `points = 200 * (basis/50) * frozen multiplier = ${expectedPoints}`,
    (top50Rows ?? []).every((r) => Number(r.points_awarded) === expectedPoints),
    JSON.stringify(top50Rows),
  )
}

hr()
line('5) award -- credit, reverse (disqualify), re-credit -- chain does not hit the unique index')
hr()
{
  const appId = byName('cp-test-a').id
  const r1 = await syncAwardPoints({
    applicationId: appId, seasonId: SEASON, userId: null, newRank: 2,
    reason: 'initial award', actor: 'test:verify-script',
  })
  check('first credit ok, action=credited', r1.ok === true && r1.action === 'credited', JSON.stringify(r1))

  const r2 = await syncAwardPoints({
    applicationId: appId, seasonId: SEASON, userId: null, newRank: null,
    reason: 'disqualified -- integrity violation', actor: 'test:verify-script',
  })
  check('reversal ok, action=reversed', r2.ok === true && r2.action === 'reversed', JSON.stringify(r2))

  const r3 = await syncAwardPoints({
    applicationId: appId, seasonId: SEASON, userId: null, newRank: 1,
    reason: 'reinstated at a different rank after review', actor: 'test:verify-script',
  })
  check('RE-CREDIT DID NOT HIT THE UNIQUE INDEX (the important one)', r3.ok === true, JSON.stringify(r3))

  const { data: chain } = await admin
    .from('championship_points_ledger')
    .select('event_type, award_rank, points_awarded, reverses_id, reason')
    .eq('application_id', appId)
    .eq('event_type', 'award')
    .order('created_at', { ascending: true })
  line(`  full chain:\n${JSON.stringify(chain, null, 2)}`)
  check('chain has exactly 3 rows (credit, reversal, re-credit)', (chain ?? []).length === 3, `${(chain ?? []).length}`)
  check(
    'net sum > 0 (currently awarded at the new rank)',
    (chain ?? []).reduce((s, r) => s + Number(r.points_awarded), 0) > 0,
    '',
  )
}

// ── cleanup ──────────────────────────────────────────────────────────────────
await cleanupLedger()
await cleanupApps()
await admin.from('seasons').update({ points_fee_basis_usd: originalBasis }).eq('id', SEASON)
line(`\ncleanup done, points_fee_basis_usd restored to ${originalBasis}`)

hr()
line(`RESULT: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
