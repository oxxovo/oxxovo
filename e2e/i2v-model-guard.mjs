#!/usr/bin/env node
/**
 * ⑪ i2v model guard -- server-side, against the LIVE catalogue.
 *
 * Until 2026-08-02 the only thing keeping a plain text-to-video model out of the
 * AI-actor "shoot shots" path was one client-side filter
 * (`ActorMode.tsx`: `state.models.filter(m => m.acceptsI2v)`). The server checked
 * `mediaType === 'video'` and nothing else, so a hand-made call could send
 * start_image_url/elements/multi_prompt to a model whose schema has no such
 * fields: fal 422, participant charged, worker fails, credits refunded -- a
 * round trip for a request the server could have refused for free.
 *
 * ★NO WRITES. Not one row is created, and that is not a compromise -- it falls
 * out of the guard ordering. `createI2vGeneration` checks the model BEFORE it
 * looks up the character, so:
 *   - a t2v model + a character that does not exist -> the guard answers first
 *   - an i2v model + a character that does not exist -> the guard passed, and the
 *     character lookup answers instead
 * Two different refusals from two calls that touch nothing. (C7: live probes
 * during a competition window are for reading only; this one only ever reads.)
 *
 * Run:
 *   npm run test:i2v-guard
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { createGeneration, createI2vGeneration } from '../lib/studio.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// season_test only. Nothing is written, but the season id still travels into the
// character lookup, and it is not going to be a live one.
const SEASON = 'season_test'
const NOBODY = randomUUID() // a user id that owns nothing
const NO_CHARACTER = randomUUID()

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) }
}

// --- 0. the catalogue, as it actually is -----------------------------------
console.log('0. catalogue')
const { data: rows, error } = await admin
  .from('model_catalog')
  .select('id, active, tier, min_duration_seconds, max_duration_seconds, metadata')
if (error) throw new Error('model_catalog: ' + error.message)

const i2v = rows.filter((m) => m.metadata?.accepts_start_image === true)
const activeT2v = rows.filter(
  (m) => m.active === true && m.metadata?.accepts_start_image !== true && m.metadata?.media_type !== 'image',
)
console.log(`  i2v rows: ${i2v.map((m) => `${m.id}(active=${m.active})`).join(', ') || '(none)'}`)
console.log(`  active t2v rows: ${activeT2v.length}`)
ok(i2v.length > 0, `catalogue has at least one accepts_start_image model [${i2v.length}]`)
ok(activeT2v.length > 0, `catalogue has at least one active t2v model [${activeT2v.length}]`)

// ★A fact, recorded so its CHANGE is visible: no active model takes a start
// image today. That is why the picker filter added alongside this guard removes
// nothing right now -- and why it had to be added before ⑪ flips `active`,
// not after. When ⑪ lands this assertion is expected to flip, and the line
// below is the reminder of what else must be re-checked when it does.
const activeI2v = i2v.filter((m) => m.active === true)
ok(
  activeI2v.length === 0,
  `no ACTIVE i2v model yet [${activeI2v.map((m) => m.id).join(',') || 'none'}] ` +
    '-- when this fails, ⑪ has activated: re-verify the /studio picker excludes it',
)

// --- 1. a t2v model is refused on the actor path ---------------------------
console.log('1. t2v model on the actor path')
{
  const m = activeT2v[0]
  const res = await createI2vGeneration({
    userId: NOBODY,
    seasonId: SEASON,
    modelId: m.id,
    characterId: NO_CHARACTER,
    shots: [{ prompt: 'a test shot', durationSeconds: Math.max(1, m.min_duration_seconds ?? 5) }],
  })
  ok(res.ok === false && res.reason === 'not_i2v_model', `${m.id} refused: not_i2v_model [got ${res.reason}]`)
}

// --- 2. an i2v model gets PAST the guard ------------------------------------
// The refusal we want here is character_not_found: it can only be reached after
// the model checks passed, so it is the positive proof. A test that only ever
// saw rejections would pass just as well against a guard that refuses everything.
console.log('2. i2v model passes the guard')
{
  const m = i2v[0]
  const min = Number(m.min_duration_seconds ?? 5)
  const max = Number(m.max_duration_seconds ?? 15)
  // Two shots inside the model's own bounds -- multi-shot is the actual i2v shape.
  const per = Math.max(1, Math.floor(Math.min(max, Math.max(min, 10)) / 2))
  const total = per * 2
  const res = await createI2vGeneration({
    userId: NOBODY,
    seasonId: SEASON,
    modelId: m.id,
    characterId: NO_CHARACTER,
    shots: [
      { prompt: 'shot one', durationSeconds: per },
      { prompt: 'shot two', durationSeconds: per },
    ],
  })
  ok(
    res.ok === false && res.reason === 'character_not_found',
    `${m.id} (${total}s, bounds ${min}..${max}) reached the character lookup [got ${res.reason}${res.detail ? ' ' + res.detail : ''}]`,
  )
}

// --- 3. an i2v model is refused on the plain t2v path -----------------------
// ★HONEST LIMIT. createGeneration resolves through getActiveModels(), so an
// INACTIVE i2v row is refused as 'unknown_model' and the new `not_i2v_model`
// branch is never reached. With no active i2v model in the catalogue that branch
// is unreachable today -- so this asserts what is actually true now, and says
// what will prove the branch later rather than pretending it was proved.
console.log('3. i2v model on the plain t2v path')
{
  const m = i2v[0]
  const res = await createGeneration({
    userId: NOBODY,
    seasonId: SEASON,
    modelId: m.id,
    prompt: 'a test prompt',
    durationSeconds: Number(m.min_duration_seconds ?? 5),
  })
  const expected = m.active === true ? 'not_i2v_model' : 'unknown_model'
  ok(
    res.ok === false && res.reason === expected,
    `${m.id} refused on the t2v path: ${expected} [got ${res.reason}]` +
      (m.active === true ? '' : ' -- inactive, so the not_i2v_model branch is not exercised yet'),
  )
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
