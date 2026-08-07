// v1actor signature: does the edit boundary /admin/actors claims actually hold?
//
// The claim the admin screen is built on is that the SIGNATURE decides what may
// be edited -- slug / canonical_frontal_url / reference_urls / provenance are
// sealed, while display_name / status / kind are not. Two of the tests below are
// the ones that make that a measured statement instead of an assertion:
//   - reference_urls reordered still verifies (the canonical form sorts them, so
//     array order coming back from Postgres cannot matter)
//   - display_name changed still verifies (it is not in the canonical string at
//     all, which is exactly why it needed a SEPARATE, policy-shaped lock)
// Without those two, "the signature defines the boundary" is just a comment.
//
// Fixture-based, not DB-based: the secret is set here the way the other
// cryptobind tests do it, so this runs in CI with no database and no real secret.
process.env.STUDIO_CRYPTOBIND_SECRET = 'actor-test-secret-not-for-prod'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import {
  actorCanonicalString,
  verifyActorBind,
  ACTOR_CANON_VERSION,
  shortHex,
} from './studio-official-actors.ts'

const SECRET = process.env.STUDIO_CRYPTOBIND_SECRET!
const R2 = 'https://example.invalid'
const SLUG = 'actor-test-fixture'

// Shaped like the real row: provenance with nested objects and unsorted keys, so
// the stable-stringify path is genuinely exercised.
const PROVENANCE = {
  synthetic: true,
  base_face: { model: 'fal-ai/flux/dev', type: 'text-to-image' },
  gates: { provenance: 'TK pass', sheet: 'TK pass' },
  conclusion: 'Fully synthetic.',
}

const REFS = [
  `${R2}/frontal.jpg`,
  `${R2}/three_quarter_left.jpg`,
  `${R2}/three_quarter_right.jpg`,
  `${R2}/profile.jpg`,
]

function signed(overrides: Partial<Parameters<typeof verifyActorBind>[0]> = {}) {
  const base = {
    slug: SLUG,
    canonical_frontal_url: `${R2}/frontal.jpg`,
    reference_urls: REFS,
    provenance: PROVENANCE as unknown,
  }
  const canonical = actorCanonicalString(base)
  return {
    ...base,
    cryptobind_hash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    cryptobind_signature: createHmac('sha256', SECRET).update(canonical, 'utf8').digest('hex'),
    ...overrides,
  }
}

test('the canonical string is the v1actor shape, with references sorted', () => {
  const c = actorCanonicalString({
    slug: SLUG,
    canonical_frontal_url: `${R2}/frontal.jpg`,
    reference_urls: REFS,
    provenance: PROVENANCE,
  })
  const parts = c.split('|')
  assert.equal(parts[0], ACTOR_CANON_VERSION)
  assert.equal(parts[1], SLUG)
  assert.equal(parts[2], `${R2}/frontal.jpg`)
  assert.equal(parts[3], [...REFS].sort().join(','), 'references must be sorted into the canonical form')
  assert.match(parts[4], /^[0-9a-f]{64}$/, 'provenance must reduce to a sha256 hex')
})

// (a)
test('a correctly signed row verifies', () => {
  const v = verifyActorBind(signed())
  assert.deepEqual(v, { ok: true, hashMatches: true })
})

// (b) -- the seal that matters: provenance is the "fully synthetic" evidence.
test('altering one provenance key breaks it', () => {
  const row = signed()
  const v = verifyActorBind({
    ...row,
    provenance: { ...PROVENANCE, conclusion: 'Derived from a real person.' },
  })
  assert.equal(v.ok, false)
  assert.equal(v.ok === false && v.reason, 'hash', 'content change must fail at the hash, before the HMAC')
})

test('a nested provenance change breaks it too', () => {
  const row = signed()
  const v = verifyActorBind({
    ...row,
    provenance: { ...PROVENANCE, gates: { provenance: 'TK pass', sheet: 'FORGED' } },
  })
  assert.equal(v.ok, false)
  assert.equal(v.ok === false && v.reason, 'hash')
})

// (c) ★ the boundary claim: order is not content.
test('reference_urls in a different order still verifies', () => {
  const row = signed()
  const shuffled = [REFS[2], REFS[0], REFS[3], REFS[1]]
  assert.notDeepEqual(shuffled, REFS, 'the fixture must actually be reordered')
  const v = verifyActorBind({ ...row, reference_urls: shuffled })
  assert.equal(v.ok, true, 'Postgres does not promise array order; the canonical form sorts, so this must hold')
})

test('but adding or removing a reference does NOT verify', () => {
  const row = signed()
  assert.equal(verifyActorBind({ ...row, reference_urls: REFS.slice(0, 3) }).ok, false)
  assert.equal(verifyActorBind({ ...row, reference_urls: [...REFS, `${R2}/extra.jpg`] }).ok, false)
})

// (d) ★ the other half of the boundary: display_name is NOT sealed, which is why
// the UI locks it for a policy reason and says so in different words.
test('display_name is not part of the signature, so changing it cannot break verification', () => {
  const row = signed()
  // The verifier does not even accept display_name -- it is not in the canonical
  // string. Passing a row that carries one must still verify.
  const withName = { ...row, display_name: 'RIN' } as typeof row & { display_name: string }
  assert.equal(verifyActorBind(withName).ok, true)
  const renamed = { ...row, display_name: 'SOMETHING ELSE' } as typeof row & { display_name: string }
  assert.equal(verifyActorBind(renamed).ok, true)
})

test('status and kind are likewise outside the signature', () => {
  const row = signed()
  const changed = { ...row, status: 'active', kind: 'anime' } as typeof row & { status: string; kind: string }
  assert.equal(verifyActorBind(changed).ok, true)
})

// slug and the canonical frontal ARE sealed.
test('slug and canonical_frontal_url are sealed', () => {
  const row = signed()
  assert.equal(verifyActorBind({ ...row, slug: 'actor-other' }).ok, false)
  assert.equal(verifyActorBind({ ...row, canonical_frontal_url: `${R2}/other.jpg` }).ok, false)
})

test('a wrong secret fails at the signature, not the hash', () => {
  const row = signed()
  const prev = process.env.STUDIO_CRYPTOBIND_SECRET
  process.env.STUDIO_CRYPTOBIND_SECRET = 'a-different-secret'
  try {
    const v = verifyActorBind(row)
    assert.equal(v.ok, false)
    assert.equal(v.ok === false && v.reason, 'signature')
    assert.equal(v.hashMatches, true, 'the row is intact; only the secret differs -- these must be distinguishable')
  } finally {
    process.env.STUDIO_CRYPTOBIND_SECRET = prev
  }
})

test('missing signature columns are reported as missing, not as a mismatch', () => {
  const row = signed()
  assert.equal(verifyActorBind({ ...row, cryptobind_signature: null }).reason, 'missing')
  assert.equal(verifyActorBind({ ...row, cryptobind_hash: null }).reason, 'missing')
})

test('a hash of the wrong length is rejected rather than throwing', () => {
  const row = signed()
  const v = verifyActorBind({ ...row, cryptobind_hash: 'abc' })
  assert.equal(v.ok, false)
  assert.equal(v.ok === false && v.reason, 'hash')
})

test('shortHex truncates without revealing the tail', () => {
  assert.equal(shortHex(null), '-')
  assert.equal(shortHex('a'.repeat(64)), `${'a'.repeat(16)}…`)
  assert.equal(shortHex('abcd', 16), 'abcd')
})
