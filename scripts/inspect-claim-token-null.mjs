// READ-ONLY: can a row tell us WHICH worker build finished it?
//
// WHY. Two worker services ran against the same DB and bucket:
//   trustworthy-enchantment  2069b8d (2026-08-02) -- claim-token CAS on renders
//   just-vibrancy            0350b51 (2026-07-31) -- no CAS, no per-attempt R2 key
// The 7/31 build is the one the CAS exists to make harmless. Rows it finished
// carry the risk the CAS removes: a stalled lane overwriting the row (and the
// CryptoBind signature) of the lane that finished. So: find those rows.
//
// ★WHAT THE DISCRIMINATOR ACTUALLY COVERS (verified against BOTH builds' source
// on 2026-08-07, not assumed):
//
//   render_jobs      claim_token WORKS as a discriminator.
//                    2069b8d claimNextRender() stamps it and never clears it;
//                    every later write is CAS'd on it. 0350b51 has no
//                    claim_token in its render lane at all.
//
//   generation_jobs  claim_token DOES NOT discriminate. The column exists, but
//                    NEITHER deployed build writes it -- tokens reach the
//                    generation lane in 40fca7f, which is not deployed. r2_key
//                    does not discriminate either: attemptToken is plumbed into
//                    uploadVideo only from the RENDER path (worker.ts:799,818),
//                    so both builds write seasons/{season}/{user}/{jobId}.mp4.
//
//   studio_music_assets  no claim_token column at all.
//
// So this script answers the question for renders and, for the other two lanes,
// reports that it CANNOT -- rather than printing a zero that reads like a clean
// bill of health. A count of 0 from a discriminator that does not exist is not
// evidence of anything.
//
// ★FALSE POSITIVE, excluded: the APP clears claim_token on requeue
// (lib/studio.ts:2436, lib/studio-lease.ts:349) -- but both also set status back
// to 'queued'. A 'queued' row with a NULL token is normal and is filtered out.
//
// ★CONTROL GROUP: rows that DO carry a token are counted too. A zero-finding run
// only means something if the column is populated somewhere; otherwise the
// finding is "cannot distinguish", not "nothing happened".
//
// Writes: none.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('SUPABASE env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

// The CAS landed 2026-08-02. Start before it so the transition is visible rather
// than assumed -- if nothing at all falls in the window, that is itself the
// finding.
const SINCE = process.env.SINCE ?? '2026-07-30T00:00:00Z'

// 'queued' excluded on purpose -- see the false-positive note above.
const TERMINAL = ['ready', 'failed', 'rendering', 'uploading', 'submitted', 'finalized']

function row(r) {
  return [
    r.id.slice(0, 8),
    String(r.season_id ?? '-').padEnd(14),
    String(r.status ?? '-').padEnd(10),
    `att=${r.attempts ?? '-'}`,
    `fin=${r.worker_finished_at ? r.worker_finished_at.slice(0, 19) : '-'}`,
    r.cryptobind_final_hash || r.cryptobind_content_signature ? 'signed' : 'unsigned',
    r.r2_key ?? '-',
  ].join('  ')
}

async function renders() {
  console.log('=== render_jobs (claim_token IS a valid discriminator here) ===')

  const { count: total, error: cErr } = await db
    .from('render_jobs')
    .select('id', { count: 'exact', head: true })
  if (cErr) throw new Error('render_jobs count: ' + cErr.message)

  const { data, error } = await db
    .from('render_jobs')
    .select('id, season_id, status, claim_token, claimed_at, worker_finished_at, attempts, r2_key, cryptobind_final_hash, created_at, updated_at')
    .gte('updated_at', SINCE)
    .in('status', TERMINAL)
    .order('updated_at', { ascending: false })
  if (error) throw new Error('render_jobs: ' + error.message)

  const rows = data ?? []
  const tokenless = rows.filter((r) => r.claim_token == null)
  const tokened = rows.filter((r) => r.claim_token != null)

  console.log(`  table total       ${total}`)
  console.log(`  terminal in window ${rows.length}   (updated_at >= ${SINCE})`)
  console.log(`  CONTROL  token     ${tokened.length}`)
  console.log(`  ★SUSPECT no token  ${tokenless.length}`)

  if (rows.length === 0) {
    console.log('\n  ★NO RENDER ACTIVITY IN THE WINDOW. Two readings, both true:')
    console.log('    - there are no rows for the 7/31 build to have damaged, and')
    console.log('    - the CAS build has never processed a render in production either,')
    console.log('      so the fix is UNEXERCISED, not proven.')
    console.log('    A "lease lost" line in the worker log with no surviving row points at')
    console.log('    the E2E harness (e2e/requeue-recovery.mjs deliberately stales a claim,')
    console.log('    then cleans up) rather than at a live collision. Settle it with the')
    console.log('    render id in the log line: harness seasons are season_e2e / zz_*.')
    return
  }

  if (tokened.length === 0) {
    console.log('\n  ★CONTROL EMPTY: no row in the window carries a token, so the NULLs below')
    console.log('    cannot be attributed. Read as "cannot distinguish".')
  }
  if (tokenless.length) {
    console.log('\n  --- suspect rows ---')
    for (const r of tokenless) console.log('    ' + row(r))
    const signed = tokenless.filter((r) => r.cryptobind_final_hash)
    console.log(`\n  ${signed.length} of them carry a final CryptoBind hash. ★Those are the`)
    console.log('  verification targets: signed by a build with no CAS, so nothing proves the')
    console.log('  bytes at r2_key are the bytes that were signed.')
  }
}

async function generations() {
  console.log('\n=== generation_jobs (claim_token does NOT discriminate -- see header) ===')

  const { count: tokened } = await db
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .not('claim_token', 'is', null)
  const { count: total } = await db
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })

  const { data, error } = await db
    .from('generation_jobs')
    .select('id, season_id, status, claim_token, worker_started_at, worker_finished_at, attempts, r2_key, cryptobind_content_signature')
    .gte('worker_started_at', SINCE)
    .order('worker_started_at', { ascending: false })
  if (error) throw new Error('generation_jobs: ' + error.message)

  console.log(`  CONTROL: rows with a non-null claim_token, table-wide: ${tokened} / ${total}`)
  if (tokened === 0) {
    console.log('  → the column is written by NOBODY. Neither build can be identified from a row.')
  }
  console.log(`  worker_started_at >= ${SINCE}: ${(data ?? []).length} rows`)
  for (const r of data ?? []) console.log('    ' + row(r))
  if ((data ?? []).length) {
    console.log('\n  ★These ran while both services were up. Which build handled them cannot be')
    console.log('  answered from the row. The worker-side log (service + timestamp) is the only')
    console.log('  remaining evidence.')
  }
}

async function music() {
  const { count } = await db
    .from('studio_music_assets')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', SINCE)
  console.log(`\n=== studio_music_assets ===\n  ${count} rows in window. No claim_token column -- not examined.`)
}

async function main() {
  console.log(`project: ${url}`)
  console.log(`window : ${SINCE}\n`)
  await renders()
  await generations()
  await music()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
