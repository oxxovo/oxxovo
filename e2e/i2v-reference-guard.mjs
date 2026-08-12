#!/usr/bin/env node
/**
 * ⑪ i2v reference guard -- an actor with no reference angle must be refused
 * BEFORE the charge, because fal refuses it after.
 *
 * WHY THIS EXISTS. `createI2vGeneration` builds
 * `elements[0].reference_image_urls` from the character's reference list, and
 * fal's schema documents that field as "1-3 images supported". Measured
 * 2026-08-07 on two real calls that differ in nothing else:
 *     649ed536  reference_image_urls: []      -> Unprocessable Entity, $0 billed
 *     dd118b00  reference_image_urls: [2]     -> ready       (SAME 3 x 5s shots)
 * Without the guard the participant is charged, the worker fails the job,
 * refundFailedJob returns the credits, and they read "generation failed" for a
 * request that could never have worked.
 *
 * ★WHY IT IS NOT IN e2e/i2v-model-guard.mjs. That harness states, at the top, that
 * it writes NOTHING, and that property is load-bearing (it is safe to run during a
 * competition window). The reference guard sits AFTER the character lookup, so it
 * is unreachable without a character row. Rather than quietly spend that file's
 * invariant, the write lives here.
 *
 * ★WHY ONE IMAGE ROW AND NO CHARGE. The guard fires before loadOwnedReadyImages,
 * so nothing dereferences `frontal_image_job_id` -- but the COLUMN has a foreign
 * key to generation_jobs (measured: studio_characters_frontal_image_job_id_fkey),
 * so a made-up uuid is rejected by the database before the code is reached. So:
 * one placeholder image row, two character rows, and nothing else. No credits, no
 * fal call, $0. Scoped to the dedicated e2e user (never the demo account, never
 * real data) and deleted at the end by user_id.
 *
 * The reference LIST is a plain uuid[] with no FK, which is why case 2 can point at
 * a non-existent id and get parent_not_found from the next gate.
 *
 * ★BOTH DIRECTIONS. A guard that refuses everything passes a refusal-only test,
 * so the second case proves it lets a referenced actor through: it comes back with
 * a DIFFERENT refusal (parent_not_found, from the next gate), which can only be
 * reached if the reference check passed.
 *
 * Run:
 *   npm run test:i2v-ref-guard
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createI2vGeneration } from '../lib/studio.ts'
// ★The REAL signer, not a mirror of it. generation_jobs.cryptobind_pid is NOT NULL
// (measured), so the placeholder row needs a bind; re-implementing the canonical
// here would be a second copy that can drift from the one under test.
import { buildImageBind } from '../lib/cryptobind.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const SEASON = 'season_test'
const E2E_EMAIL = 'e2e-studio@oxxovo-e2e.test'

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) }
}

async function e2eUserId() {
  for (let page = 1; page <= 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === E2E_EMAIL)
    if (hit) return hit.id
    if (data.users.length < 200) break
  }
  return null
}

const uid = await e2eUserId()
if (!uid) {
  console.error(`e2e user ${E2E_EMAIL} not found -- run e2e/stage3.mjs once to create it.`)
  process.exit(1)
}

// ★Refuse to run against an account that has state, so a bad cleanup can never
// look like a pass and this can never delete someone's work.
const { count: existing } = await admin
  .from('studio_characters')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', uid)
if (existing) {
  console.error(`e2e user already has ${existing} character row(s) -- refusing to seed over them.`)
  process.exit(1)
}

const noRefId = randomUUID()
const withRefId = randomUUID()
const i2vModel = 'kling-v3-pro-i2v'

// Two shots x 2s, the ⑪B shape, inside the model's 1..15 bounds.
const shots = [
  { prompt: 'reference guard probe, shot one', durationSeconds: 2 },
  { prompt: 'reference guard probe, shot two', durationSeconds: 2 },
]

const frontalJobId = randomUUID()

try {
  // The FK target. A ready image row with no cost and no signature: the guard and
  // the next gate both answer before anything reads either.
  {
    const { error } = await admin.from('generation_jobs').insert({
      id: frontalJobId,
      user_id: uid,
      season_id: SEASON,
      model_id: 'nano-banana-pro',
      tier: 'standard',
      media_type: 'image',
      prompt: 'e2e reference-guard placeholder',
      status: 'ready',
      image_url: 'https://example.invalid/e2e-refguard.png',
      estimated_cost_usd: 0,
      credits_charged: 0,
      ...buildImageBind({
        jobId: frontalJobId,
        pid: uid,
        tid: SEASON,
        modelId: 'nano-banana-pro',
        generatedAt: new Date(),
      }),
    })
    if (error) throw new Error(`seed image: ${error.message}`)
  }

  const seed = async (id, refs) => {
    const { error } = await admin.from('studio_characters').insert({
      id,
      user_id: uid,
      season_id: SEASON,
      name: `E2E_REFGUARD_${refs.length}`,
      status: 'ready',
      frontal_image_job_id: frontalJobId,
      reference_image_job_ids: refs,
    })
    if (error) throw new Error(`seed ${id}: ${error.message}`)
  }

  console.log('1. an actor with NO reference cut is refused, before any charge')
  await seed(noRefId, [])
  const a = await createI2vGeneration({ userId: uid, seasonId: SEASON, modelId: i2vModel, characterId: noRefId, shots })
  ok(
    a.ok === false && a.reason === 'character_no_reference',
    `refs: [] -> character_no_reference [got ${a.reason}${a.detail ? ' / ' + a.detail : ''}]`,
  )

  console.log('2. an actor WITH a reference cut gets past the guard')
  await seed(withRefId, [randomUUID()])
  const b = await createI2vGeneration({ userId: uid, seasonId: SEASON, modelId: i2vModel, characterId: withRefId, shots })
  ok(
    b.ok === false && b.reason !== 'character_no_reference',
    `refs: [1] -> a DIFFERENT refusal, i.e. the guard passed [got ${b.reason}]`,
  )
  ok(
    b.ok === false && b.reason === 'parent_not_found',
    `and it is the next gate that answered: parent_not_found [got ${b.reason}]`,
  )

  console.log('3. nothing was charged (the guard is before the ledger write)')
  const { data: txs } = await admin.from('credit_transactions').select('id').eq('user_id', uid)
  const { data: vids } = await admin.from('generation_jobs').select('id').eq('user_id', uid).eq('media_type', 'video')
  ok((txs ?? []).length === 0, `0 credit_transactions for the e2e user [${(txs ?? []).length}]`)
  ok((vids ?? []).length === 0, `0 video jobs enqueued [${(vids ?? []).length}]`)
} finally {
  // Characters first: they hold the FK to the image row.
  const e1 = (await admin.from('studio_characters').delete().eq('user_id', uid)).error
  const e2 = (await admin.from('generation_jobs').delete().eq('user_id', uid)).error
  console.log(e1 || e2 ? `\n  ★CLEANUP FAILED: ${(e1 ?? e2).message}` : '\n  cleaned up (studio_characters + generation_jobs, by user_id)')
  const { count: chLeft } = await admin.from('studio_characters').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  const { count: jbLeft } = await admin.from('generation_jobs').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  ok(chLeft === 0 && jbLeft === 0, `cleanup verified: 0 characters + 0 jobs left for the e2e user [${chLeft}/${jbLeft}]`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
