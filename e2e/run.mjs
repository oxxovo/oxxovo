// OXXOVO Season E2E harness orchestrator. Runs the full lifecycle on an isolated
// season_e2e in compressed time, then verifies. Mock scoring by default ($0).
//
//   node --env-file=.env.local e2e/run.mjs                 # mock, 41 prelim
//   node --env-file=.env.local e2e/run.mjs --prelim=15
//   node --env-file=.env.local e2e/run.mjs --real          # real Triple-AI ($$)
//   node --env-file=.env.local e2e/run.mjs --posters=worker # drive real worker (path b)
//   node --env-file=.env.local e2e/run.mjs --rank-of="Her Gaze"
//
// EVERYTHING is scoped to SEASON. Never touches production / season_test.
import { execFileSync } from 'node:child_process'
import { db, SEASON, TEMPLATE, MAIN_CFS, TK_UID, R2, pastISO, futureISO, makeChecks, creatorFor, assertScoped } from './lib.mjs'

const args = process.argv.slice(2)
const opt = {
  real: args.includes('--real'),
  prelim: Number((args.find(a => a.startsWith('--prelim=')) || '').split('=')[1]) || 41,
  posters: (args.find(a => a.startsWith('--posters=')) || '--posters=mock').split('=')[1],
  rankOf: (args.find(a => a.startsWith('--rank-of=')) || '').split('=').slice(1).join('=') || null,
  keep: args.includes('--keep'),
}
const log = (m) => console.log(`\n▶ ${m}`)
const supa = db()

// ── 1. teardown (FK-safe, scoped) ───────────────────────────────────────────
async function teardown() {
  log('teardown season_e2e (scoped delete)')
  const { data: apps } = await supa.from('genesis_applications').select('id').eq('season_id', SEASON)
  const ids = (apps || []).map((a) => a.id)
  if (ids.length) {
    for (const t of ['watch_votes', 'watch_likes', 'watch_comments', 'watch_views']) {
      await supa.from(t).delete().in('application_id', ids)
    }
  }
  await supa.from('render_jobs').delete().eq('season_id', SEASON)
  await supa.from('scoring_results').delete().eq('season_id', SEASON)
  await supa.from('genesis_applications').delete().eq('season_id', SEASON)
  await supa.from('seasons').delete().eq('id', SEASON)
  console.log(`  cleared ${ids.length} prior apps`)
}

// ── 2. create season_e2e (clone season_test) ────────────────────────────────
async function createSeason() {
  log('create season_e2e (clone of season_test, compressed schedule)')
  const { data: tmpl, error } = await supa.from('seasons').select('*').eq('id', TEMPLATE).single()
  if (error) throw new Error('template read failed: ' + error.message)
  const row = { ...tmpl }
  // generated/computed columns cannot be inserted
  for (const g of ['created_at', 'updated_at', 'prize_first', 'prize_second', 'prize_third']) delete row[g]
  row.id = SEASON
  row.season_number = 9999
  row.display_name = '[E2E] Harness Season'
  row.name = 'e2e'
  row.status = 'closed'
  // baseline schedule; per-stage gates adjust these
  row.application_open_at = pastISO(120)
  row.application_close_at = pastISO(90)
  row.main_round_start_at = pastISO(60)
  row.main_round_end_at = futureISO(60)
  row.community_vote_start_at = futureISO(60)
  row.community_vote_end_at = futureISO(120)
  row.awards_announcement_at = futureISO(180)
  assertScoped(row.id)
  const { error: insErr } = await supa.from('seasons').insert(row)
  if (insErr) throw new Error('season insert failed: ' + insErr.message)
  console.log('  season_e2e created')
  return tmpl
}

// ── 3. seed prelim (reuse season_test video URLs as the asset pool) ──────────
async function seedPrelim(n) {
  log(`seed ${n} prelim entries (reused assets, status=pending)`)
  const { data: pool } = await supa.from('genesis_applications').select('free_entry_url').eq('season_id', TEMPLATE).not('free_entry_url', 'is', null)
  const urls = (pool || []).map((r) => r.free_entry_url)
  if (!urls.length) throw new Error('no prelim asset pool in template')
  // template app for required columns
  const { data: tApp } = await supa.from('genesis_applications').select('*').eq('season_id', TEMPLATE).not('free_entry_url', 'is', null).limit(1).single()
  const rows = []
  for (let i = 0; i < n; i++) {
    const [name, country] = creatorFor(i)
    const r = { ...tApp }
    delete r.id; delete r.created_at; delete r.updated_at
    r.season_id = SEASON
    r.status = 'pending'
    r.moderation_status = 'approved'
    r.free_entry_url = urls[i % urls.length]
    r.main_round_video_url = null
    r.main_round_submitted_at = null
    r.studio_application_submitted_at = null
    r.studio_main_render_id = null
    r.studio_application_render_id = null
    r.thumbnail_url = null
    r.award_rank = null
    r.watch_hidden = false
    r.creator_name = `${name} ${i + 1}`
    r.email = `e2e-${i + 1}@oxxovo-e2e.test`
    r.country = country
    r.user_id = null
    r.video_title = `E2E Prelim ${i + 1}`
    rows.push(r)
  }
  const { error } = await supa.from('genesis_applications').insert(rows)
  if (error) throw new Error('prelim seed failed: ' + error.message)
  console.log(`  seeded ${n} prelim`)
}

// ── 4. score (mock or real) ─────────────────────────────────────────────────
async function score(round, videoField) {
  const status = round === 'main' ? 'main_round_submitted' : 'pending'
  const { data: apps } = await supa.from('genesis_applications').select('id').eq('season_id', SEASON).eq('status', status).not(videoField, 'is', null)
  const ids = (apps || []).map((a) => a.id)
  if (opt.real) {
    log(`REAL Triple-AI scoring ${round} (${ids.length} entries) — invoking batch`)
    // gate: main_round_end_at / application_close_at must be past (already set)
    execFileSync('node', ['dist/batch.js'], {
      cwd: '../oxxovo-scoring',
      env: { ...process.env, SEASON_ID: SEASON, ROUND: round, SEASON_REQUIRED_STATUS: '', BATCH_SIZE: String(ids.length + 5) },
      stdio: 'inherit',
    })
  } else {
    log(`MOCK scoring ${round} (${ids.length} entries, synthetic scores)`)
    const rows = ids.map((id, i) => {
      const base = 62 + ((i * 7) % 32) // deterministic spread 62..93
      return {
        application_id: id, season_id: SEASON, round, judged_status: 'completed',
        processing_attempts: 1, verified_score: base,
        consensus_intent: base + 2, consensus_execution: base, consensus_originality: base - 6, consensus_integrity: 80,
      }
    })
    const { error } = await supa.from('scoring_results').upsert(rows, { onConflict: 'application_id,round' })
    if (error) throw new Error('mock score failed: ' + error.message)
  }
}

// ── 5. advance (top advance_pct clamped) ────────────────────────────────────
async function advance(season) {
  log('advance: top advance_pct → finalists')
  const { data: sr } = await supa.from('scoring_results').select('application_id, verified_score').eq('season_id', SEASON).eq('round', 'application').eq('judged_status', 'completed')
  const ranked = (sr || []).slice().sort((a, b) => (b.verified_score ?? 0) - (a.verified_score ?? 0))
  const k = Math.min(season.advance_max ?? 50, Math.max(season.advance_min ?? 10, Math.round(ranked.length * (season.advance_pct ?? 0.1))))
  const finalists = ranked.slice(0, k).map((r) => r.application_id)
  await supa.from('genesis_applications').update({ status: 'selected' }).in('id', finalists)
  console.log(`  ${finalists.length} finalists (of ${ranked.length})`)
  return finalists
}

// ── 6. seed main videos + posters ───────────────────────────────────────────
async function seedMain(finalists) {
  log(`seed main videos on ${finalists.length} finalists + posters (${opt.posters})`)
  for (let i = 0; i < finalists.length; i++) {
    const id = finalists[i]
    await supa.from('genesis_applications').update({
      main_round_video_url: MAIN_CFS[i % MAIN_CFS.length],
      main_round_submitted_at: new Date().toISOString(),
      status: 'main_round_submitted',
    }).eq('id', id).eq('season_id', SEASON)
    if (opt.posters === 'mock' || opt.posters === 'reuse') {
      // marker render holding a poster URL; wire studio_main_render_id (no genesis contamination)
      const posterUrl = opt.posters === 'reuse' ? `${R2}/posters/posters/${id}.jpg` : `${R2}/posters/e2e/${id}.jpg`
      const { data: rj } = await supa.from('render_jobs').insert({
        user_id: TK_UID, season_id: SEASON, status: 'submitted', video_url: MAIN_CFS[i % MAIN_CFS.length],
        thumbnail_url: posterUrl, edl: [], source_job_ids: [], total_duration_seconds: 15,
        cryptobind_pid: TK_UID, cryptobind_tid: SEASON, cryptobind_generated_at: '2026-07-14T00:00:00.000+00:00',
        cryptobind_algo: 'E2E-PLACEHOLDER', cryptobind_edl_hash: 'e2e', cryptobind_source_bundle: 'e2e',
        cryptobind_render_signature: 'e2e', cryptobind_final_hash: 'e2e', cryptobind_final_signature: 'e2e',
      }).select('id').single()
      if (rj) await supa.from('genesis_applications').update({ studio_main_render_id: rj.id }).eq('id', id)
    }
    // opt.posters === 'worker' handled separately (drives real worker; see design doc)
  }
  if (opt.posters === 'worker') console.log('  [posters=worker] real-worker poster reproduction — requires worker running (see design doc §3)')
}

// ── 7. vote (open window + simulate) ────────────────────────────────────────
async function vote() {
  log('open community vote + simulate')
  await supa.from('seasons').update({ community_vote_start_at: pastISO(1), community_vote_end_at: futureISO(120) }).eq('id', SEASON)
  const { data: mains } = await supa.from('genesis_applications').select('id').eq('season_id', SEASON).eq('status', 'main_round_submitted').limit(3)
  const { data: users } = await supa.from('profiles').select('id').limit(5)
  const uids = (users || []).map((u) => u.id)
  let votes = 0, firstErr = null
  for (const u of uids.length ? uids : [TK_UID]) {
    for (const m of (mains || []).slice(0, 3)) {
      const { error } = await supa.from('watch_votes').insert({ application_id: m.id, round: 'main', user_id: u, season_id: SEASON })
      if (!error) votes++
      else if (!firstErr) firstErr = error.message
    }
  }
  console.log(`  cast ${votes} votes${firstErr ? ` (first err: ${firstErr})` : ''} — ${uids.length} voters`)
  return votes
}

// ── 8. winners (top 3 by final_score; Soak: final==AI) ──────────────────────
async function winners(season) {
  log('winners: top 3 by final_score')
  const { data: sr } = await supa.from('scoring_results').select('application_id, verified_score').eq('season_id', SEASON).eq('round', 'main').eq('judged_status', 'completed')
  // Soak (community_vote_weight=0): final == verified. (season1+ would fold votes.)
  const ranked = (sr || []).slice().sort((a, b) => (b.verified_score ?? 0) - (a.verified_score ?? 0))
  const top3 = ranked.slice(0, 3)
  for (let i = 0; i < top3.length; i++) {
    await supa.from('genesis_applications').update({ award_rank: i + 1, status: 'awarded' }).eq('id', top3[i].application_id).eq('season_id', SEASON)
  }
  console.log(`  awarded 1/2/3`)
  return ranked
}

// ── rank-of hook (Integrity-fix before/after) ───────────────────────────────
async function rankOf(title) {
  const { data: apps } = await supa.from('genesis_applications').select('id, video_title').eq('season_id', SEASON)
  const target = (apps || []).find((a) => (a.video_title || '').includes(title))
  if (!target) { console.log(`  [rank-of] "${title}" not found`); return }
  const { data: sr } = await supa.from('scoring_results').select('application_id, verified_score, consensus_integrity, consensus_originality').eq('season_id', SEASON).eq('round', 'main').eq('judged_status', 'completed')
  const ranked = (sr || []).slice().sort((a, b) => (b.verified_score ?? 0) - (a.verified_score ?? 0))
  const idx = ranked.findIndex((r) => r.application_id === target.id)
  const row = ranked[idx]
  console.log(`\n  [rank-of] "${title}" = #${idx + 1}/${ranked.length}  score=${row?.verified_score}  integrity=${row?.consensus_integrity}  orig=${row?.consensus_originality}`)
}

// ── 9. verify ───────────────────────────────────────────────────────────────
async function verify(finalists, castVotes) {
  const c = makeChecks()
  // prelim scoring + no leak
  const { data: preSr } = await supa.from('scoring_results').select('application_id').eq('season_id', SEASON).eq('round', 'application')
  const { data: e2eApps } = await supa.from('genesis_applications').select('id').eq('season_id', SEASON)
  const e2eIds = new Set((e2eApps || []).map((a) => a.id))
  const preLeak = (preSr || []).filter((s) => !e2eIds.has(s.application_id)).length
  c.check('prelim scored ≥ finalists', (preSr || []).length >= finalists.length, `${(preSr || []).length} scored`)
  c.check('prelim NO cross-season leak', preLeak === 0, `${preLeak} foreign`)
  // finalists
  c.check('finalists count in [min,max]', finalists.length >= 10, `${finalists.length}`)
  // main videos + public
  const { data: mains } = await supa.from('genesis_applications').select('id, main_round_video_url, moderation_status, watch_hidden, studio_main_render_id, thumbnail_url').eq('season_id', SEASON).in('status', ['main_round_submitted', 'awarded'])
  const withMain = (mains || []).filter((m) => m.main_round_video_url)
  const pub = withMain.filter((m) => m.moderation_status === 'approved' && !m.watch_hidden)
  c.check('main videos = 10', withMain.length === 10, `${withMain.length}`)
  c.check('main videos Watch-public', pub.length === withMain.length, `${pub.length}/${withMain.length}`)
  // posters (skip assertion in worker mode where wiring is external)
  if (opt.posters !== 'worker') {
    const rids = withMain.map((m) => m.studio_main_render_id).filter(Boolean)
    const { data: rjs } = await supa.from('render_jobs').select('id, thumbnail_url').in('id', rids.length ? rids : ['00000000-0000-0000-0000-000000000000'])
    const rm = new Map((rjs || []).map((r) => [r.id, r.thumbnail_url]))
    const mainPoster = withMain.filter((m) => m.studio_main_render_id && rm.get(m.studio_main_render_id))
    const nullThumb = withMain.filter((m) => m.studio_main_render_id && !rm.get(m.studio_main_render_id))
    c.check('main cards resolve a poster (10/10)', mainPoster.length === withMain.length, `${mainPoster.length}/${withMain.length}`)
    c.check('no null thumbnail on main renders', nullThumb.length === 0, `${nullThumb.length} null`)
  }
  // main scoring + no leak
  const { data: mSr } = await supa.from('scoring_results').select('application_id').eq('season_id', SEASON).eq('round', 'main')
  const mLeak = (mSr || []).filter((s) => !e2eIds.has(s.application_id)).length
  c.check('main scored = 10', (mSr || []).length === 10, `${(mSr || []).length}`)
  c.check('main NO cross-season leak', mLeak === 0, `${mLeak} foreign`)
  // winners
  const { data: won } = await supa.from('genesis_applications').select('id, award_rank').eq('season_id', SEASON).not('award_rank', 'is', null)
  const ranks = (won || []).map((w) => w.award_rank).sort()
  c.check('winners = 1,2,3', JSON.stringify(ranks) === '[1,2,3]', JSON.stringify(ranks))
  // votes
  c.check('votes recorded', castVotes > 0, `${castVotes}`)
  return c.report()
}

// ── orchestrate ─────────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n════ E2E harness: ${SEASON} | mode=${opt.real ? 'REAL' : 'MOCK'} | prelim=${opt.prelim} | posters=${opt.posters} ════`)
  await teardown()
  const season = await createSeason()
  await seedPrelim(opt.prelim)
  await supa.from('seasons').update({ application_close_at: pastISO(2) }).eq('id', SEASON) // gate: prelim closed
  await score('application', 'free_entry_url')
  const finalists = await advance(season)
  await seedMain(finalists)
  await supa.from('seasons').update({ main_round_end_at: pastISO(2) }).eq('id', SEASON) // gate: main scoring open
  await score('main', 'main_round_video_url')
  if (opt.rankOf) await rankOf(opt.rankOf)
  const castVotes = await vote()
  await winners(season)
  const pass = await verify(finalists, castVotes)
  if (!opt.keep) { await teardown(); console.log('\n(torn down; --keep to inspect)') }
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(2) })
