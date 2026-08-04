// Shared helpers for the time-compressed launch rehearsal on season_test.
// SERVICE ROLE. Every script is keyed strictly to SEASON='season_test' -- the
// real season_0 is never referenced. See reports/rehearsal_runbook_2026-07.md.
import { createClient } from '@supabase/supabase-js'

export const SEASON = 'season_test'

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Missing SUPABASE env (run with --env-file=.env.local)'); process.exit(1) }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ISO timestamp `mins` minutes from now (negative = past).
export function iso(mins) { return new Date(Date.now() + mins * 60_000).toISOString() }

// Ping the REAL deployed season-tick cron so the rehearsal exercises the actual
// production automation (not a re-implementation). Idempotent + self-gating, so
// hammering it is safe. Base defaults to prod canonical; override with
// REHEARSAL_CRON_BASE (e.g. http://localhost:3000 if a dev server is running).
export async function pingCron() {
  const base = process.env.REHEARSAL_CRON_BASE ?? 'https://www.oxxovo.ai'
  const secret = process.env.CRON_SECRET
  if (!secret) { console.error('Missing CRON_SECRET'); process.exit(1) }
  const url = `${base}/api/cron/season-tick`
  console.log(`\n-> pinging season-tick: ${url}`)
  let res
  try {
    res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
  } catch (e) { console.error('   ping failed (network):', e.message); return null }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) { console.error(`   ping HTTP ${res.status}:`, JSON.stringify(body)); return body }
  const only = (arr) => (arr ?? []).filter((x) => String(x.id).includes('season_test') || String(x.id).includes('season_0') || true)
  console.log('   transitions:', JSON.stringify(only(body.transitions)))
  if (body.advancements?.length) console.log('   advancements:', JSON.stringify(body.advancements))
  if (body.deferrals?.length) console.log('   deferrals:', JSON.stringify(body.deferrals))
  if (body.errors?.length) console.log('   errors:', JSON.stringify(body.errors))
  return body
}

// Compact dashboard of season_test: season dates, derived stage, per-app rows.
export async function printState(db) {
  const { data: s } = await db.from('seasons').select(
    'id,status,application_open_at,application_close_at,scoring_start_at,scoring_complete_at,main_round_start_at,main_round_end_at,community_vote_start_at,community_vote_end_at,awards_announcement_at,advance_pct,advance_min,advance_max,min_participants'
  ).eq('id', SEASON).maybeSingle()
  const now = Date.now()
  const past = (v) => (v ? (Date.parse(v) <= now ? 'PAST' : 'future') : 'null')
  console.log(`\n== ${SEASON}  status=${s?.status}  (now=${new Date().toISOString()}) ==`)
  console.log(`  open=${past(s?.application_open_at)}  close=${past(s?.application_close_at)}  scoringStart=${past(s?.scoring_start_at)}  scoringComplete=${past(s?.scoring_complete_at)}`)
  // The prelim worker gates on scoring_start_at. If it is future or null the
  // worker exits with 0 processed and no error -- say so here rather than let
  // the operator hunt for it.
  if (s?.scoring_start_at == null) {
    console.log('  !! scoring_start_at=null -> PRELIM WORKER BLOCKED (run stage `buffer-done`)')
  } else if (Date.parse(s.scoring_start_at) > now) {
    console.log(`  !! processing buffer still running until ${s.scoring_start_at} -> PRELIM WORKER BLOCKED`)
  }
  console.log(`  mainStart=${past(s?.main_round_start_at)}  mainEnd=${past(s?.main_round_end_at)}  voteStart=${past(s?.community_vote_start_at)}  voteEnd=${past(s?.community_vote_end_at)}  awards=${past(s?.awards_announcement_at)}`)
  console.log(`  advance: pct=${s?.advance_pct} min=${s?.advance_min} max=${s?.advance_max}  min_participants=${s?.min_participants}`)

  const { data: apps } = await db.from('genesis_applications')
    .select('id, creator_name, status, award_rank, free_entry_url, main_round_video_url, main_round_submitted_at').eq('season_id', SEASON)
  const { data: sr } = await db.from('scoring_results').select('application_id, round, judged_status, verified_score').eq('season_id', SEASON)
  const score = {}
  for (const r of sr ?? []) score[`${r.application_id}:${r.round}`] = `${r.judged_status === 'completed' ? Math.round(r.verified_score) : r.judged_status}`
  const { data: votes } = await db.from('watch_votes').select('application_id').eq('season_id', SEASON)
  const vc = {}
  for (const v of votes ?? []) vc[v.application_id] = (vc[v.application_id] ?? 0) + 1

  const byStatus = {}
  for (const a of apps ?? []) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
  console.log('  app status tally:', JSON.stringify(byStatus))
  const sorted = (apps ?? []).sort((a, b) => (a.award_rank ?? 9) - (b.award_rank ?? 9) || String(a.creator_name).localeCompare(b.creator_name))
  console.log('  ' + 'name'.padEnd(20) + 'status'.padEnd(22) + 'rank  prelim  main   submitted  votes')
  for (const a of sorted) {
    console.log('  ' + String(a.creator_name).padEnd(20) + String(a.status).padEnd(22) +
      String(a.award_rank ?? '-').padEnd(6) + String(score[`${a.id}:application`] ?? '-').padEnd(8) +
      String(score[`${a.id}:main`] ?? '-').padEnd(7) + String(a.main_round_submitted_at ? 'Y' : '-').padEnd(11) + String(vc[a.id] ?? 0))
  }
}
