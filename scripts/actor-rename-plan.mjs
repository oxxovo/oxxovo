#!/usr/bin/env node
/**
 * READ-ONLY. Plan the official_actors slug rename (actor-3-beauty-cf -> rin).
 * Writes nothing to the database and nothing to R2. It:
 *   1. reads the live row,
 *   2. RE-VERIFIES the signature currently stored on it, which proves this
 *      machine holds the secret the row was signed with -- without that proof a
 *      re-sign would just overwrite a real signature with an unrelated one,
 *   3. recomputes the v1actor canonical + signature for the new slug,
 *   4. prints the exact UPDATE for reports/hq_actor_slug_2026-08-08.sql.
 *
 * The canonical string is
 *   v1actor|<slug>|<canonical_frontal_url>|<sorted refs, comma-joined>|<provHash>
 * so the slug AND the four URLs are inside the signature. Renaming the slug in
 * the database alone does not just leave the R2 paths leaking -- it invalidates
 * the signature, which is the thing that proves the actor's canonical set was
 * not altered.
 *
 *   node --env-file=.env.local scripts/actor-rename-plan.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, createHmac } from 'node:crypto'

// Overridable so the same script can re-verify AFTER the rename, by reading the
// row at its new slug. Re-verification is the whole point of section 2 and it
// has to work on the renamed row too, or the check only ever runs before the
// change it is meant to validate.
const OLD_SLUG = process.env.OLD_ACTOR_SLUG ?? 'actor-3-beauty-cf'
const NEW_SLUG = process.env.NEW_ACTOR_SLUG ?? 'rin'
const R2 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev'
const ANGLES = ['frontal.jpg', 'three_quarter_left.jpg', 'three_quarter_right.jpg', 'profile.jpg']

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET
if (!URL_ || !KEY) throw new Error('missing SUPABASE env')
if (!SECRET) throw new Error('missing STUDIO_CRYPTOBIND_SECRET')

// Byte-identical to scripts/onboard-actor-insert.mjs. Postgres jsonb does not
// preserve key order, so the provenance hash has to be taken over a recursively
// key-sorted serialization or it will not re-verify after a round trip.
const stableStringify = (v) =>
  Array.isArray(v)
    ? '[' + v.map(stableStringify).join(',') + ']'
    : v && typeof v === 'object'
      ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
      : JSON.stringify(v)

const sign = (slug, frontal, refs, provHash) => {
  const canonical = ['v1actor', slug, frontal, [...refs].sort().join(','), provHash].join('|')
  return {
    canonical,
    hash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    signature: createHmac('sha256', SECRET).update(canonical, 'utf8').digest('hex'),
  }
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } })
const { data: row, error } = await db.from('official_actors').select('*').eq('slug', OLD_SLUG).maybeSingle()
if (error) throw new Error('read failed: ' + error.message)
if (!row) throw new Error(`no official_actors row with slug=${OLD_SLUG}`)

const provHash = createHash('sha256').update(stableStringify(row.provenance), 'utf8').digest('hex')
const before = sign(OLD_SLUG, row.canonical_frontal_url, row.reference_urls, provHash)

console.log('== 1. the row as it stands ==')
console.log('   id                    ', row.id)
console.log('   slug                  ', row.slug)
console.log('   display_name          ', row.display_name)
console.log('   status                ', row.status)
console.log('   cryptobind_algo       ', row.cryptobind_algo)

console.log('\n== 2. does the STORED signature re-verify with this secret? ==')
const hashOk = before.hash === row.cryptobind_hash
const sigOk = before.signature === row.cryptobind_signature
console.log('   cryptobind_hash match      ', hashOk)
console.log('   cryptobind_signature match ', sigOk)
if (!hashOk || !sigOk) {
  console.log('\n   ** STOP. The stored signature does not reproduce.')
  console.log('   Either this machine has the wrong STUDIO_CRYPTOBIND_SECRET, or the row was')
  console.log('   altered after signing. Re-signing now would erase the evidence of which.')
  process.exit(2)
}

const newFrontal = `${R2}/official_actors/${NEW_SLUG}/frontal.jpg`
const newRefs = ANGLES.map((a) => `${R2}/official_actors/${NEW_SLUG}/${a}`)
const after = sign(NEW_SLUG, newFrontal, newRefs, provHash)

console.log('\n== 3. what actually carries the theme, measured ==')
const leakWords = ['beauty', 'cosmetic', 'lipstick', 'campaign', 'advertis', 'cf']
const hit = (s) => leakWords.filter((w) => String(s).toLowerCase().includes(w))
console.log('   slug                    ', hit(row.slug).join(',') || '(clean)')
console.log('   canonical_frontal_url   ', hit(row.canonical_frontal_url).join(',') || '(clean)')
console.log('   reference_urls (4)      ', hit(JSON.stringify(row.reference_urls)).join(',') || '(clean)')
console.log('   provenance (jsonb)      ', hit(JSON.stringify(row.provenance)).join(',') || '(clean)')
console.log('   display_name            ', hit(row.display_name).join(',') || '(clean)')
console.log('   -> R2 object keys carry the same string; the bucket is public (measured: HEAD 200).')

console.log('\n== 4. the UPDATE, with the recomputed signature ==')
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
console.log(`UPDATE public.official_actors
   SET slug                  = ${q(NEW_SLUG)},
       canonical_frontal_url = ${q(newFrontal)},
       reference_urls        = ARRAY[
         ${newRefs.map(q).join(',\n         ')}
       ],
       cryptobind_hash       = ${q(after.hash)},
       cryptobind_signature  = ${q(after.signature)},
       updated_at            = now()
 WHERE id = ${q(row.id)}
   AND slug = ${q(OLD_SLUG)}
RETURNING id, slug, display_name, status, canonical_frontal_url, cryptobind_algo;`)

console.log('\n== 5. R2 objects that must exist BEFORE the UPDATE ==')
for (const a of [...ANGLES, 'consistency_i2v.mp4']) {
  const oldUrl = `${R2}/official_actors/${OLD_SLUG}/${a}`
  const newUrl = `${R2}/official_actors/${NEW_SLUG}/${a}`
  const [o, n] = await Promise.all([
    fetch(oldUrl, { method: 'HEAD' }).then((r) => r.status),
    fetch(newUrl, { method: 'HEAD' }).then((r) => r.status),
  ])
  console.log(`   ${a.padEnd(26)} old=${o}  new=${n}`)
}
console.log('\n   provenance.motion_consistency.clip also names the old path and is INSIDE the')
console.log('   signed provenance hash. It is an archival record of how the actor was made;')
console.log('   rewriting it to hide a word would be falsifying provenance, so it is left')
console.log('   alone and the mp4 stays server-side. Only the four public angles move.')
