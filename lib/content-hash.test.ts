// payload_hash is the idempotency contract for /api/contents/import: the same
// logical request must hash the same however it is spelled, and any real
// content difference must change it. Each "must differ" case below is the
// control for the "must match" case next to it -- a hash that ignored
// everything would pass every "match" test.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePayloadHash, canonicalizeImportPayload, HashInputError } from './content-hash'

const UUID_A = '3f2b8c1e-5a47-4d9e-9c0a-1b2c3d4e5f60'
const UUID_B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

function base(): Record<string, unknown> {
  return {
    spec_version: 1,
    source_ref: 'pn-1001',
    source_version: 1,
    kind: 'news',
    form: 'short',
    language: 'ko',
    rights_status: 'restricted',
    rights_reason: 'terms unconfirmed',
    title: 'Title',
    description: 'Desc',
    caption: 'Cap',
    upstream_approved_by: 'tk',
    upstream_approved_at: '2026-10-05T00:00:00.000Z',
    upstream_approval_id: UUID_A,
    allowed_platforms: ['youtube', 'instagram', 'tiktok'],
    ai_generated: true,
    assets: [
      { role: 'main_9x16', key: 'imports/news_desk/pn-1001/v1/main_9x16-abc', file_format: 'mp4', bytes: 100, duration_sec: 30.5, width: 1080, height: 1920, sha256: 'a'.repeat(64) },
      { role: 'thumbnail', key: 'imports/news_desk/pn-1001/v1/thumbnail-def', sha256: 'b'.repeat(64) },
    ],
  }
}

const h = (p: unknown) => computePayloadHash(p)

test('hash is a 64-char hex and stable across calls', () => {
  assert.match(h(base()), /^[0-9a-f]{64}$/)
  assert.equal(h(base()), h(base()))
})

test('MATCH: key order, platform order, asset order do not matter', () => {
  const a = base()
  const b: Record<string, unknown> = {}
  for (const k of Object.keys(a).reverse()) b[k] = a[k]
  b.allowed_platforms = ['tiktok', 'youtube', 'instagram']
  b.assets = [...(a.assets as unknown[])].reverse()
  assert.equal(h(a), h(b))
})

test('MATCH: asset field order does not matter', () => {
  const a = base()
  const b = base()
  b.assets = (b.assets as Record<string, unknown>[]).map((x) => Object.fromEntries(Object.entries(x).reverse()))
  assert.equal(h(a), h(b))
})

test('MATCH: null and absent are the same "not sent"', () => {
  const a = base()
  const b = base()
  delete a.description
  b.description = null
  assert.equal(h(a), h(b))
})

test('DIFFER: empty string is not absent (control for the null case)', () => {
  const a = base()
  const b = base()
  delete a.description
  b.description = ''
  assert.notEqual(h(a), h(b))
})

test('MATCH: timestamp offset spellings of one instant', () => {
  const a = base()
  const b = base()
  a.upstream_approved_at = '2026-10-05T09:00:00+09:00'
  b.upstream_approved_at = '2026-10-05T00:00:00Z'
  assert.equal(h(a), h(b))
})

test('DIFFER: a different instant', () => {
  const a = base()
  const b = base()
  b.upstream_approved_at = '2026-10-05T00:00:01Z'
  assert.notEqual(h(a), h(b))
})

test('MATCH: NFC vs NFD Hangul title', () => {
  const a = base()
  const b = base()
  a.title = '한글 제목'.normalize('NFC')
  b.title = '한글 제목'.normalize('NFD')
  assert.notEqual(a.title, b.title) // the test input really differs
  assert.equal(h(a), h(b))
})

test('DIFFER: whitespace is content (no trim)', () => {
  const a = base()
  const b = base()
  b.title = 'Title '
  assert.notEqual(h(a), h(b))
})

test('DIFFER: case is content', () => {
  const a = base()
  const b = base()
  b.caption = 'cap'
  assert.notEqual(h(a), h(b))
})

test('DIFFER: every hashed scalar changes the hash', () => {
  const baseHash = h(base())
  const changes: Record<string, unknown> = {
    spec_version: 2,
    source_ref: 'pn-1002',
    source_version: 2,
    kind: 'drama',
    form: 'long',
    language: 'en',
    rights_status: 'blocked',
    rights_reason: 'other reason',
    title: 'T2',
    description: 'D2',
    caption: 'C2',
    upstream_approved_by: 'someone',
    upstream_approved_at: '2026-10-06T00:00:00Z',
    upstream_approval_id: UUID_B,
    not_before: '2026-10-07T00:00:00Z',
    ai_generated: false,
  }
  for (const [k, v] of Object.entries(changes)) {
    const p = base()
    p[k] = v
    assert.notEqual(h(p), baseHash, `${k} must be part of the hash`)
  }
})

test('DIFFER: approval id alone changes the hash (HQ 2026-10-05: id-only resend is not idempotent)', () => {
  const a = base()
  const b = base()
  b.upstream_approval_id = UUID_B
  assert.notEqual(h(a), h(b))
})

test('DIFFER: platform set, asset key, asset sha256, asset bytes', () => {
  const baseHash = h(base())
  const p1 = base()
  p1.allowed_platforms = ['youtube']
  assert.notEqual(h(p1), baseHash)

  const p2 = base()
  ;(p2.assets as Record<string, unknown>[])[0].key = 'imports/news_desk/pn-1001/v1/main_9x16-zzz'
  assert.notEqual(h(p2), baseHash)

  const p3 = base()
  ;(p3.assets as Record<string, unknown>[])[0].sha256 = 'c'.repeat(64)
  assert.notEqual(h(p3), baseHash)

  const p4 = base()
  ;(p4.assets as Record<string, unknown>[])[0].bytes = 101
  assert.notEqual(h(p4), baseHash)
})

test('DIFFER: dropping an asset', () => {
  const p = base()
  p.assets = (p.assets as unknown[]).slice(0, 1)
  assert.notEqual(h(p), h(base()))
})

test('numbers: -0 equals 0, 30 equals 30.0, 30.5 differs from 30', () => {
  const a = base()
  const b = base()
  ;(a.assets as Record<string, unknown>[])[0].duration_sec = 0
  ;(b.assets as Record<string, unknown>[])[0].duration_sec = -0
  assert.equal(h(a), h(b))
  ;(a.assets as Record<string, unknown>[])[0].duration_sec = 30
  ;(b.assets as Record<string, unknown>[])[0].duration_sec = 30.0
  assert.equal(h(a), h(b))
  ;(b.assets as Record<string, unknown>[])[0].duration_sec = 30.5
  assert.notEqual(h(a), h(b))
})

test('canonical form is exactly key-sorted, whitespace-free (pins the rules)', () => {
  const c = canonicalizeImportPayload({
    source_version: 1,
    source_ref: 'x',
    allowed_platforms: ['tiktok', 'youtube'],
    assets: [{ role: 'thumbnail', key: 'k', sha256: 's' }, { role: 'main_16x9', key: 'm', bytes: 5 }],
  })
  assert.deepEqual(c.allowed_platforms, ['tiktok', 'youtube'])
  assert.deepEqual((c.assets as { role: string }[]).map((a) => a.role), ['main_16x9', 'thumbnail'])
})

test('GOLDEN: a fixed payload hashes to a fixed value (a rule change must be deliberate)', () => {
  const p = {
    spec_version: 1,
    source_ref: 'pn-1',
    source_version: 1,
    kind: 'news',
    form: 'short',
    language: 'ko',
    rights_status: 'cleared',
    title: 't',
    upstream_approved_by: 'tk',
    upstream_approved_at: '2026-10-05T00:00:00Z',
    upstream_approval_id: UUID_A,
    allowed_platforms: ['youtube'],
    ai_generated: true,
    assets: [{ role: 'main_16x9', key: 'k', sha256: 'a'.repeat(64) }],
  }
  assert.equal(h(p), 'c0be2e3ef41930ba57a055df774cbe079d98a8c2688da1d4ad6a687c6ba941a5')
})

test('THROWS: server-decided and unknown fields are not silently ignored', () => {
  for (const extra of ['source', 'status', 'publish_at', 'channels', 'late_for_slot', 'payload_hash', 'surprise']) {
    const p = base()
    p[extra] = 'x'
    assert.throws(() => h(p), (e: unknown) => e instanceof HashInputError && e.message === `unknown_field:${extra}`, extra)
  }
  const p = base()
  ;(p.assets as Record<string, unknown>[])[0].url = 'https://evil.invalid/x.mp4'
  assert.throws(() => h(p), /asset_unknown_field:url/)
})

test('THROWS: wrong types, bad numbers, bad timestamps, duplicates', () => {
  const t = (mutate: (p: Record<string, unknown>) => void, re: RegExp) => {
    const p = base()
    mutate(p)
    assert.throws(() => h(p), re)
  }
  t((p) => { p.title = 5 }, /title_not_string/)
  t((p) => { p.source_version = '1' }, /source_version_not_number/)
  t((p) => { p.source_version = NaN }, /source_version_not_number/)
  t((p) => { p.source_version = Infinity }, /source_version_not_number/)
  t((p) => { p.ai_generated = 'true' }, /ai_generated_not_boolean/)
  t((p) => { p.upstream_approved_at = 'yesterday' }, /upstream_approved_at_not_timestamp/)
  t((p) => { p.allowed_platforms = ['youtube', 'youtube'] }, /allowed_platforms_duplicate/)
  t((p) => { p.allowed_platforms = 'youtube' }, /allowed_platforms_not_array/)
  t((p) => { p.assets = [{ role: 'thumbnail' }, { role: 'thumbnail' }] }, /assets_duplicate_role/)
  t((p) => { p.assets = [{ key: 'k' }] }, /asset_role_required/)
  t((p) => { p.assets = 'x' }, /assets_not_array/)
  assert.throws(() => h(null), /payload_not_object/)
  assert.throws(() => h([]), /payload_not_object/)
})
