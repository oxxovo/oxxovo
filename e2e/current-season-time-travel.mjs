// Reproduces the season_2 hijack WITHOUT waiting for 2026-10-12 and WITHOUT
// writing a row.
//
// The bug is time-triggered, not data-triggered: getCurrentSeason() (lib/seasons.ts:284)
// picks `max(application_open_at) WHERE application_open_at <= now` and never looks at
// `status`. So the only thing standing between today and the hijack is the wall clock.
// Feed the query a different `now` and the future is observable today.
//
// Read-only by construction: SELECT only, through the same fixed-anon client and the
// same view (seasons_public) the app uses. It must never insert a fixture season --
// Preview and production share one DB, and a fixture with a fresh open date would
// hijack the live site for the duration of the run. That is the whole bug.
//
// Usage:  npm run test:current-season
import { createClient } from '@supabase/supabase-js'
import test from 'node:test'
import assert from 'node:assert/strict'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) throw new Error('missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY')

// Same client shape as lib/supabase.ts: fixed anon, no session.
const pub = createClient(url, anon, { auth: { persistSession: false } })
const admin = createClient(url, service, { auth: { persistSession: false } })

// Byte-for-byte the query in lib/seasons.ts:297-303, with `now` as a parameter.
async function currentSeasonAt(nowIso) {
  const { data, error } = await pub
    .from('seasons_public')
    .select('*')
    .lte('application_open_at', nowIso)
    .order('application_open_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`seasons_public query failed: ${error.message}`)
  return data
}

const iso = (d) => new Date(d).toISOString()

test('the anon view exposes no status filter of its own', async () => {
  // If seasons_public filtered drafts, a DB fix would already be partly in place and
  // the app-side reasoning would change. Compare base table vs view, id by id.
  const { data: base, error: be } = await admin
    .from('seasons')
    .select('id, status, application_open_at')
    .order('season_number')
  assert.equal(be, null, be?.message)
  const { data: view, error: ve } = await pub
    .from('seasons_public')
    .select('id, status, application_open_at')
  assert.equal(ve, null, ve?.message)

  const baseIds = new Set((base ?? []).map((r) => r.id))
  const viewIds = new Set((view ?? []).map((r) => r.id))
  const missing = [...baseIds].filter((id) => !viewIds.has(id))
  console.log(`  base seasons=${baseIds.size}  view rows=${viewIds.size}  hidden by view=${missing.length}`)
  for (const r of base ?? []) {
    console.log(`    ${String(r.id).padEnd(14)} status=${String(r.status).padEnd(10)} open=${r.application_open_at ?? 'null'}${viewIds.has(r.id) ? '' : '   <-- not in view'}`)
  }
  assert.deepEqual(missing, [], 'seasons_public hides rows the base table has -- the view DOES filter; re-read this test')
})

test('drafts are eligible: status is not in the selection at all', async () => {
  const { data: view } = await pub.from('seasons_public').select('id, status, application_open_at')
  const openedDrafts = (view ?? []).filter(
    (r) => r.application_open_at && r.status === 'draft',
  )
  // Not an assertion about how many drafts exist -- an assertion that IF one is open,
  // nothing filters it. season_0 itself is a draft with a past open date today.
  console.log(`  seasons with an open date and status=draft: ${openedDrafts.map((r) => r.id).join(', ') || '(none)'}`)
  const picked = await currentSeasonAt(iso(Date.now()))
  console.log(`  getCurrentSeason() today -> ${picked?.id} (status=${picked?.status}, open=${picked?.application_open_at})`)
  assert.ok(picked, 'nothing is open today -- unexpected; season_0 opened 2026-07-25')
})

test('★the hijack: a later-opening season outranks the running one', async () => {
  const { data: view } = await pub
    .from('seasons_public')
    .select('id, status, application_open_at, application_close_at, awards_announcement_at')
  const rows = view ?? []
  const today = await currentSeasonAt(iso(Date.now()))
  assert.ok(today, 'no current season today')

  // Any season that opens AFTER today's pick takes over the moment its date lands,
  // regardless of whether today's pick is still mid-tournament.
  const laterOpens = rows
    .filter((r) => r.application_open_at && r.application_open_at > today.application_open_at)
    .sort((a, b) => a.application_open_at.localeCompare(b.application_open_at))

  if (!laterOpens.length) {
    console.log(`  no season opens after ${today.id} -- the prescription is in place (open dates NULL)`)
    return
  }

  for (const r of laterOpens) {
    const at = new Date(Date.parse(r.application_open_at) + 60_000) // one minute after it opens
    const picked = await currentSeasonAt(iso(at))
    const stillRunning =
      today.awards_announcement_at != null && at.toISOString() < today.awards_announcement_at
    console.log(
      `  at ${iso(at)} -> getCurrentSeason() = ${picked?.id} (status=${picked?.status})` +
        `   ${today.id} still running? ${stillRunning}`,
    )
    assert.equal(picked?.id, r.id, 'expected the later-opening season to win the ordering')
    assert.ok(
      !stillRunning,
      `HIJACK REPRODUCED: ${r.id} (status=${picked?.status}) takes over at ${iso(at)} while ` +
        `${today.id} is still running (awards ${today.awards_announcement_at}). ` +
        `Fix = clear ${r.id}.application_open_at.`,
    )
  }
})

test('the fallback branch also ignores status', async () => {
  // If every open date were cleared, the fallback (lib/seasons.ts:313-318) surfaces the
  // soonest UPCOMING season -- also without a status filter, and with NULLs sorting last
  // in PostgREST ascending order. Recorded so the DB fix is judged against both branches.
  const { data, error } = await pub
    .from('seasons_public')
    .select('id, status, application_open_at')
    .order('application_open_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  assert.equal(error, null, error?.message)
  console.log(`  fallback (soonest upcoming) -> ${data?.id} (status=${data?.status}, open=${data?.application_open_at ?? 'null'})`)
})
