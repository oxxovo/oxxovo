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
import {
  edlCanonicalString,
  computeEdlHash,
  computeSourceBundle,
  buildMusicAssetBind,
  verifyMusicAssetBind,
  musicAssetCanonicalString,
  type ComposeEdl,
} from './cryptobind.ts'

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

// ---- text overlay KAT (append-only TX section) ----------------------------
const GOLDEN_TEXT_CANON =
  'edl2||clipA:0:5000||T:||G:||TX:Bloom%20Beauty:pretendard:80:#ffffff::0:center:500:800:0:3000:300:300|%EC%A7%80%EA%B8%88%20%EB%A7%8C%EB%82%98%EB%B3%B4%EC%84%B8%EC%9A%94:noto-serif-kr:50:#ff88cc:#000000:60:center:500:900:3000:6000:0:0'
const GOLDEN_TEXT_HASH = '5e45a1ceeec0c2908019a9e415081348e10c82e31c544e22f84a34539effea0f'

const textSample: ComposeEdl = {
  version: 2,
  segments: [{ jobId: 'clipA', startMs: 0, endMs: 5000 }],
  texts: [
    { content: 'Bloom Beauty', font: 'pretendard', sizePct: 8, color: '#ffffff', align: 'center', xNorm: 0.5, yNorm: 0.8, startMs: 0, endMs: 3000, fadeInMs: 300, fadeOutMs: 300 },
    { content: '지금 만나보세요', font: 'noto-serif-kr', sizePct: 5, color: '#ff88cc', strokeColor: '#000000', strokePct: 6, align: 'center', xNorm: 0.5, yNorm: 0.9, startMs: 3000, endMs: 6000 },
  ],
}

test('KAT: text overlay canonical string is stable (cross-repo byte-mirror)', () => {
  assert.equal(edlCanonicalString(textSample), GOLDEN_TEXT_CANON)
})

test('KAT: text overlay hash is stable (cross-repo byte-mirror)', () => {
  assert.equal(computeEdlHash(textSample), GOLDEN_TEXT_HASH)
})

test('append-only: adding texts does NOT change a text-free EDL hash', () => {
  // The same `sample` (no texts) must still hash to the original GOLDEN_HASH --
  // proves the TX section is emitted ONLY when texts exist (no signature drift).
  assert.equal(computeEdlHash(sample), GOLDEN_HASH)
})

test('text layers are order-independent (sorted by startMs)', () => {
  const reversed: ComposeEdl = { ...textSample, texts: [textSample.texts![1], textSample.texts![0]] }
  assert.equal(computeEdlHash(reversed), GOLDEN_TEXT_HASH)
})

test('TAMPER: editing text content changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(textSample))
  tampered.texts![0].content = 'Bloom Beautx'
  assert.notEqual(computeEdlHash(tampered), GOLDEN_TEXT_HASH)
})

test('TAMPER: moving a text position changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(textSample))
  tampered.texts![0].xNorm = 0.51
  assert.notEqual(computeEdlHash(tampered), GOLDEN_TEXT_HASH)
})

// ---- music bed KAT (append-only MU section) -------------------------------
const GOLDEN_MUSIC_CANON =
  'edl2||clipA:0:5000||T:||G:||MU:lib_elegant_01:library:70:40:0:5000:500:800'
const GOLDEN_MUSIC_HASH = '94ed3ca926c848d849c7ac9debc6a586ec04ed98c7bd7ea4263517bf049d60ca'

const musicSample: ComposeEdl = {
  version: 2,
  segments: [{ jobId: 'clipA', startMs: 0, endMs: 5000 }],
  music: { assetId: 'lib_elegant_01', source: 'library', volume: 70, clipVolume: 40, startMs: 0, endMs: 5000, fadeInMs: 500, fadeOutMs: 800 },
}

test('KAT: music canonical string is stable (cross-repo byte-mirror)', () => {
  assert.equal(edlCanonicalString(musicSample), GOLDEN_MUSIC_CANON)
})

test('KAT: music hash is stable (cross-repo byte-mirror)', () => {
  assert.equal(computeEdlHash(musicSample), GOLDEN_MUSIC_HASH)
})

test('append-only: adding music does NOT change a music-free EDL hash', () => {
  assert.equal(computeEdlHash(sample), GOLDEN_HASH)
})

test('TAMPER: changing music volume changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(musicSample))
  tampered.music!.volume = 71
  assert.notEqual(computeEdlHash(tampered), GOLDEN_MUSIC_HASH)
})

test('TAMPER: swapping the music asset changes the hash', () => {
  const tampered: ComposeEdl = JSON.parse(JSON.stringify(musicSample))
  tampered.music!.assetId = 'lib_elegant_02'
  assert.notEqual(computeEdlHash(tampered), GOLDEN_MUSIC_HASH)
})

// ---- music ASSET binding KAT (v1m) + anti-swap bundle fold-in --------------
// The asset signature is content-hash based and MUST be byte-identical across
// repos (worker seeds/signs, main app verifies). Golden: sign('kat-secret',
// 'v1m|lib_elegant_01|library|' + 'ab'.repeat(32)).
const GOLDEN_V1M_CANON = 'v1m|lib_elegant_01|library|' + 'ab'.repeat(32)
const GOLDEN_V1M_SIG = '3e95a4ab57fbbb5611f6c3a81ea6859b1732ac6ed7901f175e60dfacdb995b73'
const CH = 'ab'.repeat(32)

test('KAT: v1m canonical string is stable (cross-repo byte-mirror)', () => {
  assert.equal(musicAssetCanonicalString({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH }), GOLDEN_V1M_CANON)
})

test('KAT: v1m signature is stable (cross-repo byte-mirror)', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date('2026-01-01T00:00:00.000Z') })
  assert.equal(b.cryptobind_signature, GOLDEN_V1M_SIG)
})

test('v1m: genuine asset verifies (request time: stored hash)', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  const row = { id: 'lib_elegant_01', source: 'library', cryptobind_content_hash: CH, cryptobind_signature: b.cryptobind_signature, cryptobind_algo: b.cryptobind_algo }
  assert.deepEqual(verifyMusicAssetBind(row), { ok: true })
})

test('v1m: worker re-hash of intact bytes verifies', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  const row = { id: 'lib_elegant_01', source: 'library', cryptobind_content_hash: CH, cryptobind_signature: b.cryptobind_signature, cryptobind_algo: b.cryptobind_algo }
  // fresh hash of the downloaded bytes == stored hash -> ok
  assert.deepEqual(verifyMusicAssetBind(row, CH), { ok: true })
})

test('v1m TAMPER: repointed r2_key (different audio bytes) rejects at the worker', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  const row = { id: 'lib_elegant_01', source: 'library', cryptobind_content_hash: CH, cryptobind_signature: b.cryptobind_signature, cryptobind_algo: b.cryptobind_algo }
  const differentBytesHash = 'cd'.repeat(32)
  const r = verifyMusicAssetBind(row, differentBytesHash)
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'signature_mismatch')
})

test('v1m TAMPER: swapped assetId (forged row) fails the signature', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  // attacker points the EDL at a different id but keeps the old signature
  const row = { id: 'lib_elegant_99', source: 'library', cryptobind_content_hash: CH, cryptobind_signature: b.cryptobind_signature, cryptobind_algo: b.cryptobind_algo }
  const r = verifyMusicAssetBind(row)
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'signature_mismatch')
})

test('v1m TAMPER: unsupported algo rejects', () => {
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  const r = verifyMusicAssetBind({ id: 'lib_elegant_01', source: 'library', cryptobind_content_hash: CH, cryptobind_signature: b.cryptobind_signature, cryptobind_algo: 'MD5' })
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'unsupported_algo')
})

test('v1m: missing hash/signature rejects (content_missing)', () => {
  const r = verifyMusicAssetBind({ id: 'lib_elegant_01', source: 'library', cryptobind_content_hash: null, cryptobind_signature: null, cryptobind_algo: 'HMAC-SHA256' })
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, 'content_missing')
})

test('anti-swap: folding the music sig into the source bundle changes it (append-only)', () => {
  const clipSigs = ['sigA', 'sigB']
  const bundleNoMusic = computeSourceBundle(clipSigs)
  const b = buildMusicAssetBind({ assetId: 'lib_elegant_01', source: 'library', contentHash: CH, generatedAt: new Date() })
  const bundleWithMusic = computeSourceBundle([...clipSigs, b.cryptobind_signature])
  assert.notEqual(bundleNoMusic, bundleWithMusic)
  // swapping to a different bed yields a different bundle -> render_sig_mismatch
  const b2 = buildMusicAssetBind({ assetId: 'lib_elegant_02', source: 'library', contentHash: CH, generatedAt: new Date() })
  const bundleSwapped = computeSourceBundle([...clipSigs, b2.cryptobind_signature])
  assert.notEqual(bundleWithMusic, bundleSwapped)
})

test('backward compat: v1 array still uses the edl1 prefix', () => {
  const v1 = edlCanonicalString([{ jobId: 'clipA', startMs: 0, endMs: 5000 }])
  assert.ok(v1.startsWith('edl1|'))
  assert.notEqual(computeEdlHash([{ jobId: 'clipA', startMs: 0, endMs: 5000 }]), GOLDEN_HASH)
})
