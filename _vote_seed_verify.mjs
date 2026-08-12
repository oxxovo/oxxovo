// Vote seeding + blending verification harness for season_test (TK 2026-07-12).
//
//   node --env-file=.env.local _vote_seed_verify.mjs --seed      (create + seed)
//   node --env-file=.env.local _vote_seed_verify.mjs --verify    (read-only ranking @ weight 0 vs 0.5)
//   node --env-file=.env.local _vote_seed_verify.mjs --cleanup   (remove everything)
//
// Why fake users: watch_votes.user_id has a FK to auth.users, so real accounts
// are required. --seed creates 20 (email votetest+N@oxxovo.test, email_confirm
// so no mail is sent); --cleanup finds them by that email prefix and deletes
// them (+ any profiles row a signup trigger created).
//
// What --seed does:
//   1. 20 fake auth users
//   2. dummy main-round film on each finalist (status -> main_round_submitted)
//   3. dummy round='main' scoring_results, verified_score 95..(desc) so there is
//      a clear AI ranking
//   4. votes distributed INVERSELY (most votes -> lowest AI scorer) so a 50/50
//      blend must reorder the top -- proves votes actually move the ranking
//   5. opens the vote window now (so the count shows on cards + TK can vote)
//
// season_test stays community_vote_weight = 0 (soak). --verify computes the
// ranking at BOTH weight 0 and 0.5 from the live seeded data using the SHIPPED
// formula (copied verbatim from lib/scoring.ts) -- it does not flip the DB.

import { createClient } from '@supabase/supabase-js'

const SEASON = 'season_test'
const N_USERS = 20
const EMAIL_PREFIX = 'votetest+'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const DUMMY_URL = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/watch_main/season_test/dummy.mp4'

// ── shipped formula (verbatim from lib/scoring.ts) ──────────────────────────
function computeCommunityScore(votes, maxVotes) {
  if (maxVotes <= 0) return null
  return (votes / maxVotes) * 100
}
function computeFinalScore(ai, community, s) {
  if (ai == null) return null
  if (s.community_vote_weight === 0) return ai * s.ai_score_weight
  if (community == null) return null
  return ai * s.ai_score_weight + community * s.community_vote_weight
}

async function finalists() {
  const { data } = await admin
    .from('genesis_applications')
    .select('id, creator_name, status')
    .eq('season_id', SEASON)
    .in('status', ['selected', 'main_round_submitted'])
    .order('id')
  return data ?? []
}

async function listFakeUsers() {
  const found = []
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const users = data?.users ?? []
    for (const u of users) if (u.email?.startsWith(EMAIL_PREFIX)) found.push(u)
    if (users.length < 200) break
  }
  return found
}

async function seed() {
  const fs = await finalists()
  if (fs.length === 0) return console.log('no finalists — nothing to seed')
  console.log(`${fs.length} finalists.`)

  // 1) users (reuse existing votetest users, create up to N_USERS)
  let users = await listFakeUsers()
  for (let i = users.length; i < N_USERS; i++) {
    const email = `${EMAIL_PREFIX}${i}@oxxovo.test`
    const { data, error } = await admin.auth.admin.createUser({
      email, email_confirm: true, password: `Vote!${i}${Math.floor(1e6)}xz`,
    })
    if (error) { console.error('createUser', email, error.message); continue }
    users.push(data.user)
  }
  users = users.slice(0, N_USERS)
  console.log(`${users.length} fake users ready.`)

  // 2+3) dummy film + main scoring. verified_score descending by finalist order.
  const scores = fs.map((_, i) => 95 - i * 3) // 95,92,...
  for (let i = 0; i < fs.length; i++) {
    await admin.from('genesis_applications').update({
      main_round_video_url: DUMMY_URL,
      main_round_submitted_at: new Date().toISOString(),
      status: 'main_round_submitted',
    }).eq('id', fs[i].id)
    // upsert scoring row (delete+insert to stay idempotent)
    await admin.from('scoring_results').delete().eq('application_id', fs[i].id).eq('round', 'main')
    const { error } = await admin.from('scoring_results').insert({
      application_id: fs[i].id, season_id: SEASON, round: 'main',
      judged_status: 'completed', verified_score: scores[i], grade: 'A', integrity_flag: false,
    })
    if (error) console.error('scoring insert', fs[i].id, error.message)
  }
  console.log('dummy films + main scoring seeded (verified_score 95..).')

  // 4) votes: inverse to AI. bottom finalist gets all 20, next 14, next 8.
  const byLowAi = [...fs].reverse() // lowest AI score first
  const targets = fs.map(() => 0)
  const idx = (f) => fs.findIndex((x) => x.id === f.id)
  if (byLowAi[0]) targets[idx(byLowAi[0])] = N_USERS       // 20
  if (byLowAi[1]) targets[idx(byLowAi[1])] = 14
  if (byLowAi[2]) targets[idx(byLowAi[2])] = 8
  // clear existing seeded votes first (idempotent)
  await admin.from('watch_votes').delete().eq('season_id', SEASON).eq('round', 'main').in('user_id', users.map((u) => u.id))
  let inserted = 0
  for (let i = 0; i < fs.length; i++) {
    for (let u = 0; u < targets[i]; u++) {
      const { error } = await admin.from('watch_votes').insert({
        application_id: fs[i].id, season_id: SEASON, round: 'main', user_id: users[u].id,
      })
      if (error) console.error('vote', fs[i].creator_name, u, error.message)
      else inserted++
    }
  }
  console.log(`${inserted} votes seeded (inverse to AI).`)

  // 5) open the vote window now
  await admin.from('seasons').update({
    community_vote_start_at: new Date(Date.now() - 3600e3).toISOString(),
    community_vote_end_at: new Date(Date.now() + 7 * 86400e3).toISOString(),
  }).eq('id', SEASON)
  console.log('vote window opened (now .. +7d). season weight stays 0. Run --verify next.')
}

async function verify() {
  const { data: season } = await admin.from('seasons').select('ai_score_weight, community_vote_weight').eq('id', SEASON).single()
  const fs = await finalists()
  const { data: sc } = await admin.from('scoring_results').select('application_id, verified_score, judged_status').eq('season_id', SEASON).eq('round', 'main')
  const scoreOf = new Map((sc ?? []).map((s) => [s.application_id, s.judged_status === 'completed' ? s.verified_score : null]))
  const { data: votes } = await admin.from('watch_votes').select('application_id').eq('season_id', SEASON).eq('round', 'main')
  const tally = new Map()
  for (const v of votes ?? []) tally.set(v.application_id, (tally.get(v.application_id) ?? 0) + 1)
  const maxVotes = tally.size ? Math.max(...tally.values()) : 0

  const rank = (weight) => {
    const s = { ai_score_weight: 1 - weight, community_vote_weight: weight }
    return fs.map((f) => {
      const ai = scoreOf.get(f.id) ?? null
      const cs = computeCommunityScore(tally.get(f.id) ?? 0, maxVotes)
      return { name: f.creator_name, id: f.id.slice(0, 8), ai, votes: tally.get(f.id) ?? 0, cs, final: computeFinalScore(ai, cs, s) }
    }).filter((r) => r.final != null).sort((a, b) => b.final - a.final)
  }
  const print = (label, rows) => {
    console.log(`\n== ${label} ==`)
    rows.forEach((r, i) => console.log(`  #${i + 1} ${r.name.padEnd(16)} AI=${r.ai} votes=${r.votes} community=${r.cs == null ? 'null' : r.cs.toFixed(0)} final=${r.final?.toFixed(2)}`))
    return rows.map((r) => r.id)
  }
  console.log(`season_test live weight: ai=${season.ai_score_weight} community=${season.community_vote_weight}, total votes=${(votes ?? []).length}, maxVotes=${maxVotes}`)
  const o0 = print('weight 0 (AI only — soak, season0 reality)', rank(0))
  const o5 = print('weight 0.5 (AI 50 + community 50 — season1 reality)', rank(0.5))
  const flipped = o0.join() !== o5.join()
  console.log(`\nranking changed by votes: ${flipped ? 'YES — order differs (votes move the result)' : 'NO — identical order'}`)
  console.log(`  #1 @0: ${o0[0]}   #1 @0.5: ${o5[0]}`)
}

async function cleanup() {
  const users = await listFakeUsers()
  const ids = users.map((u) => u.id)
  if (ids.length) {
    await admin.from('watch_votes').delete().eq('season_id', SEASON).eq('round', 'main').in('user_id', ids)
    await admin.from('profiles').delete().in('id', ids)
    for (const id of ids) { const { error } = await admin.auth.admin.deleteUser(id); if (error) console.error('deleteUser', id, error.message) }
  }
  console.log(`removed ${ids.length} fake users + their votes/profiles.`)
  const fs = await finalists()
  for (const f of fs) {
    await admin.from('scoring_results').delete().eq('application_id', f.id).eq('round', 'main')
    await admin.from('genesis_applications').update({ main_round_video_url: null, main_round_submitted_at: null, status: 'selected' }).eq('id', f.id)
  }
  // revert schedule to TK's confirmed window + weight 0 (soak)
  await admin.from('seasons').update({
    community_vote_start_at: '2026-07-15T07:00:00+00:00',
    community_vote_end_at: '2026-07-16T07:00:00+00:00',
    community_vote_weight: 0, ai_score_weight: 1,
  }).eq('id', SEASON)
  console.log('reverted finalists + dummy scoring + vote window (7/15-7/16) + weight 0.')
}

const mode = process.argv.find((a) => ['--seed', '--verify', '--cleanup'].includes(a))
if (mode === '--seed') await seed()
else if (mode === '--verify') await verify()
else if (mode === '--cleanup') await cleanup()
else console.log('pass --seed | --verify | --cleanup')
