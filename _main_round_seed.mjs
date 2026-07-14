// Main-round video seed for season_test finalists (지수3 CF 9편 + TK 1편).
//
//   DRY-RUN (default, no writes):   node --env-file=.env.local _main_round_seed.mjs
//   APPLY (writes):                 node --env-file=.env.local _main_round_seed.mjs --apply
//
// Fill MAPPING with { appId, url } once the CF videos are ready. URLs are R2
// direct links (pub-...r2.dev/.../xxx.mp4). Seeding via the service role
// bypasses the self-submit form's platform allowlist, and the Watch player
// renders R2 direct URLs (proven by the watch_demo gallery).
//
// Each finalist is transitioned:
//   status              selected -> main_round_submitted
//   main_round_video_url  <- url
//   main_round_submitted_at <- now()  (satisfies main_round_submission_consistency_chk)
//
// Scoring is a SEPARATE step (TK 2026-07-12): seed first, then run the main
// Triple-AI pass so scoring_results(round='main') -> final_score -> winners.
//
// Safety: only touches rows that are CURRENTLY finalists (status selected or
// main_round_submitted) in season_test. Idempotent (re-apply overwrites URL).

import { createClient } from '@supabase/supabase-js'

const SEASON_ID = 'season_test'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// ── FILL THIS (10 entries) ──────────────────────────────────────────────────
// Finalist appIds (season_test, status=selected) for reference:
//   028e6ab2...  Creator547F
//   1421a690...  Frame & Muse
//   75173f4c...  Frame & Muse
//   bb5d2ab6...  Green Gables
//   138f7056...  Green Gables
//   1b31d7fe...  Halo Pictures
//   72f5386a...  Kiln & Clay
//   6b474425...  Orbit Diary
//   789ba39b...  Vela Motion
//   ee72af6f...  Zero-G Studio
// Use the FULL appId (8-char prefixes above are only a hint).
// 지수3 CF v3 (final). cf/ and cf/v2/ are OLD -- do NOT use. TK's own entry
// (028e6ab2 Creator547F, uid 9b5ceed5) is intentionally LEFT OUT -- add it as the
// 10th when TK's CF is ready, then --apply all 10 at once.
const V3 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/cf/v3/'
const MAPPING = [
  // Her Gaze (lowest prelim 80.58) — Kling cf_01_lumea REPLACED with 제니3's Seedance
  // 2.0 lumea (hand+cream-application physics breakthrough), 720p/15s/portrait/no-audio.
  // Deliberate quality-gap probe: does Triple-AI rank the clearly-better film #1? (TK 2026-07-13)
  { appId: '75173f4c-961c-419c-981d-8d7011743ec1', url: 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/seedance/seedance_t2v_720p_15s_lumea15c_s1.mp4' },   // Frame & Muse (Seedance 2.0)
  { appId: '1421a690-645e-4751-a435-e82ce355af52', url: V3 + 'cf_02_aurelie_premium.mp4' },  // Frame & Muse
  { appId: '138f7056-f7c5-4151-a8da-25bf75746df7', url: V3 + 'cf_03_novya_pop.mp4' },         // Green Gables
  { appId: 'bb5d2ab6-1cb3-48c5-a8b9-60905fc19faf', url: V3 + 'cf_08_soira_premium.mp4' },     // Green Gables (was cf_04; swapped per TK)
  { appId: '1b31d7fe-b068-4ee5-ba8f-429b64aaae7b', url: V3 + 'cf_05_aquelle_cool.mp4' },      // Halo Pictures
  { appId: '72f5386a-cbb9-47b8-a705-e0ff85523e53', url: V3 + 'cf_06_noira_premium.mp4' },     // Kiln & Clay
  { appId: '6b474425-0c0b-4e01-9e14-6d45edbdbc15', url: V3 + 'cf_07_eclare_premium.mp4' },    // Orbit Diary
  { appId: '789ba39b-076d-4a75-a691-b08787a053dd', url: V3 + 'cf_04_bloomix_pop.mp4' },        // Vela Motion (TK: cf_04 here)
  { appId: 'ee72af6f-3f96-4aea-841f-d0fbe8d01e80', url: V3 + 'cf_09_velix_pop.mp4' },          // Zero-G Studio
  // { appId: '028e6ab2-2d27-4db9-8ab3-5b32b969af3e', url: V3 + 'cf_10_<TK>.mp4' },  // Creator547F (TK) -- add when ready
]
// ────────────────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes('--apply')

async function main() {
  // Current finalists = the valid seed targets.
  const { data: finalists, error: fErr } = await admin
    .from('genesis_applications')
    .select('id, creator_name, status, main_round_video_url')
    .eq('season_id', SEASON_ID)
    .in('status', ['selected', 'main_round_submitted'])
  if (fErr) {
    console.error('load finalists failed:', fErr.message)
    process.exit(1)
  }
  const byId = new Map(finalists.map((f) => [f.id, f]))

  if (MAPPING.length === 0) {
    console.log('MAPPING is empty. Fill it with { appId, url } (10 entries) then re-run.')
    console.log(`Current finalists (${finalists.length}):`)
    for (const f of finalists) {
      console.log(`  ${f.id}  ${f.creator_name.padEnd(20)}  main:${f.main_round_video_url ? 'SET' : 'null'}`)
    }
    return
  }

  // Validate every entry before writing anything.
  const problems = []
  const seen = new Set()
  for (const m of MAPPING) {
    if (!m.appId || !m.url?.trim()) problems.push(`missing appId/url: ${JSON.stringify(m)}`)
    else if (!byId.has(m.appId)) problems.push(`not a current finalist: ${m.appId}`)
    else if (seen.has(m.appId)) problems.push(`duplicate appId: ${m.appId}`)
    seen.add(m.appId)
  }
  if (problems.length) {
    console.error('VALIDATION FAILED:')
    problems.forEach((p) => console.error('  - ' + p))
    process.exit(1)
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${MAPPING.length} finalist(s):`)
  for (const m of MAPPING) {
    const f = byId.get(m.appId)
    console.log(`  ${f.creator_name.padEnd(20)} ${f.status} -> main_round_submitted | ${m.url}`)
  }
  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write.')
    return
  }

  const now = new Date().toISOString()
  let ok = 0
  for (const m of MAPPING) {
    const { error } = await admin
      .from('genesis_applications')
      .update({
        main_round_video_url: m.url.trim(),
        main_round_submitted_at: now,
        status: 'main_round_submitted',
      })
      .eq('id', m.appId)
      .eq('season_id', SEASON_ID)
    if (error) console.error(`  FAIL ${m.appId}: ${error.message}`)
    else ok++
  }
  console.log(`\nseeded ${ok}/${MAPPING.length}. Next: run the main Triple-AI scoring pass.`)
}

main()
