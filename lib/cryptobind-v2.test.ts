// EDL v2 canonical / hash KAT + determinism (Genesis effects in the auth chain).
// Run: node --import ./scripts/test-register.mjs --test lib/cryptobind-v2.test.ts
//
// The render signature is recomputed from edlCanonicalString in BOTH repos
// (oxxovo + oxxovo-studio), so the v2 string+hash MUST be byte-identical across
// them. The GOLDEN values below are the cross-repo KAT: oxxovo-studio's mirror
// test asserts the same hash. computeEdlHash is secret-free (plain sha256 of the
// canonical string), so the KAT is stable regardless of STUDIO_CRYPTOBIND_SECRET.
process.env.STUDIO_CRYPTOBIND_SECRET = 'kat-secret'

import test from 'node:test'
import assert from 'node:assert/strict'
import { edlCanonicalString, computeEdlHash, type ComposeEdl } from './cryptobind.ts'

// ---- GOLDEN (must match oxxovo-studio/src/cryptobind KAT) ------------------
const GOLDEN_CANON =
  'edl2||clipA:0:5000;fx=exposure=10,saturation=-20,lut=teal-orange,grain=15|clipB:1000:6000;fx=glow=30||T:crossfade@0:500||G:temperature=5'
const GOLDEN_HASH = '79be71070473797216b0619367dce276415f9ef86226bfeacb0de2f6ef6e07c4'

const sample: ComposeEdl = {
  version: 2,
  segments: [
    { jobId: 'clipA', startMs: 0, endMs: 5000, speed: 1, effects: { exposure: 10, contrast: 0, saturation: -20, lut: 'teal-orange', grain: 15 } },
    { jobId: 'clipB', startMs: 1000, endMs: 6000, effects: { glow: 30 } },
  ],
  transitions: [{ afterIndex: 0, type: 'crossfade', durationMs: 500 }],
  global: { temperature: 5, saturation: 0 },
}

test('KAT: v2 canonical string is stable (cross-repo byte-mirror)', () => {
  assert.equal(edlCanonicalString(sample), GOLDEN_CANON)
})

test('KAT: v2 hash is stable (cross-repo byte-mirror)', () => {
  assert.equal(computeEdlHash(sample), GOLDEN_HASH)
})

test('determinism: neutral (0) params == absent (never signature-visible)', () => {
  const stripped: ComposeEdl = {
    version: 2,
    segments: [
      { jobId: 'clipA', startMs: 0, endMs: 5000, effects: { exposure: 10, saturation: -20, lut: 'teal-orange', grain: 15 } }, // speed:1 + contrast:0 dropped
      { jobId: 'clipB', startMs: 1000, endMs: 6000, effects: { glow: 30 } },
    ],
    transitions: [{ afterIndex: 0, type: 'crossfade', durationMs: 500 }],
    global: { temperature: 5 }, // saturation:0 dropped
  }
  assert.equal(computeEdlHash(stripped), GOLDEN_HASH)
})

test('effect KEY ORDER is canonical (insertion order does not matter)', () => {
  const shuffled: ComposeEdl = {
    version: 2,
    segments: [
      { jobId: 'clipA', startMs: 0, endMs: 5000, effects: { grain: 15, lut: 'teal-orange', saturation: -20, exposure: 10 } },
      { jobId: 'clipB', startMs: 1000, endMs: 6000, effects: { glow: 30 } },
    ],
    transitions: [{ afterIndex: 0, type: 'crossfade', durationMs: 500 }],
    global: { temperature: 5 },
  }
  assert.equal(computeEdlHash(shuffled), GOLDEN_HASH)
})

test('transitions are order-independent (sorted by afterIndex)', () => {
  const a: ComposeEdl = { version: 2, segments: [{ jobId: 'x', startMs: 0, endMs: 1000 }], transitions: [{ afterIndex: 2, type: 'wipe', durationMs: 300 }, { afterIndex: 0, type: 'crossfade', durationMs: 500 }] }
  const b: ComposeEdl = { version: 2, segments: [{ jobId: 'x', startMs: 0, endMs: 1000 }], transitions: [{ afterIndex: 0, type: 'crossfade', durationMs: 500 }, { afterIndex: 2, type: 'wipe', durationMs: 300 }] }
  assert.equal(computeEdlHash(a), computeEdlHash(b))
})

test('TAMPER: changing any effect value changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(sample))
  tampered.segments[0].effects!.exposure = 11 // 10 -> 11
  assert.notEqual(computeEdlHash(tampered), GOLDEN_HASH)
})

test('TAMPER: adding a transition changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(sample))
  tampered.transitions!.push({ afterIndex: 1, type: 'dip', durationMs: 200 })
  assert.notEqual(computeEdlHash(tampered), GOLDEN_HASH)
})

test('backward compat: v1 array still uses the edl1 prefix', () => {
  const v1 = edlCanonicalString([{ jobId: 'clipA', startMs: 0, endMs: 5000 }])
  assert.ok(v1.startsWith('edl1|'))
  assert.notEqual(computeEdlHash([{ jobId: 'clipA', startMs: 0, endMs: 5000 }]), GOLDEN_HASH)
})
