import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateImportRequest, buildImportRpcPayload, assetKeyPrefix } from './content-import'

const UUID = '3f2b8c1e-5a47-4d9e-9c0a-1b2c3d4e5f60'

function news(): Record<string, unknown> {
  const pre = (role: string) => assetKeyPrefix('news_desk', 'pn-1001', 1, role) + 'abc123'
  return {
    spec_version: 1, source_ref: 'pn-1001', source_version: 1, kind: 'news', form: 'short', language: 'ko',
    rights_status: 'restricted', rights_reason: 'terms unconfirmed',
    title: 'T', description: 'D', caption: 'C',
    upstream_approved_by: 'tk', upstream_approved_at: '2026-10-05T00:00:00Z', upstream_approval_id: UUID,
    allowed_platforms: ['youtube', 'instagram', 'tiktok', 'x'], ai_generated: true,
    assets: [
      { role: 'main_9x16', key: pre('main_9x16'), file_format: 'mp4', bytes: 1000, duration_sec: 30, width: 1080, height: 1920, sha256: 'a'.repeat(64) },
      { role: 'thumbnail', key: pre('thumbnail'), bytes: 10, sha256: 'b'.repeat(64) },
    ],
  }
}

function film(): Record<string, unknown> {
  const b = news()
  const pre = (role: string) => assetKeyPrefix('production_os', 'pn-1001', 1, role) + 'abc123'
  return {
    ...b, kind: 'film', form: 'trailer', not_before: '2026-10-06T00:00:00Z',
    assets: [{ role: 'main_16x9', key: pre('main_16x9'), bytes: 1000, width: 1920, height: 1080, sha256: 'a'.repeat(64) }],
  }
}

type Src = 'news_desk' | 'production_os'
const code = (src: Src, body: unknown) => {
  const r = validateImportRequest(src, body)
  return r.ok ? 'OK' : r.code
}
const mut = (base: Record<string, unknown>, f: (o: Record<string, unknown>) => void) => {
  const o = structuredClone(base)
  f(o)
  return o
}
const asset = (o: Record<string, unknown>, i = 0) => (o.assets as Record<string, unknown>[])[i]

test('happy paths: news and entertainment', () => {
  assert.equal(code('news_desk', news()), 'OK')
  assert.equal(code('production_os', film()), 'OK')
})

test('wrong source for the kind, both directions', () => {
  assert.equal(code('production_os', news()), 'kind_not_allowed_for_source')
  assert.equal(code('news_desk', film()), 'kind_not_allowed_for_source')
})

test('unknown and server-decided fields are rejected; no silent remap', () => {
  for (const f of ['source', 'status', 'publish_at', 'channels', 'late_for_slot', 'payload_hash', 'x']) {
    assert.equal(code('news_desk', mut(news(), (o) => { o[f] = 'v' })), `unknown_field:${f}`, f)
  }
  assert.equal(code('production_os', mut(film(), (o) => { o.kind = 'movie' })), 'kind_invalid')
})

test('spec_version, source_ref, source_version', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.spec_version = 2 })), 'spec_version_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { delete o.spec_version })), 'spec_version_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.source_ref = 'a b' })), 'source_ref_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.source_ref = '../x' })), 'source_ref_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.source_version = 0 })), 'source_version_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.source_version = 1.5 })), 'source_version_invalid')
})

test('form, language, rights (both directions of rights_reason)', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.form = 'long' })), 'form_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.language = 'kr' })), 'language_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.rights_status = 'ok' })), 'rights_status_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { delete o.rights_reason })), 'rights_reason_required')
  assert.equal(code('news_desk', mut(news(), (o) => { o.rights_reason = '  ' })), 'rights_reason_required')
  assert.equal(code('news_desk', mut(news(), (o) => { o.rights_reason = 'x'.repeat(2001) })), 'rights_reason_required')
  assert.equal(code('news_desk', mut(news(), (o) => { o.rights_status = 'cleared' })), 'rights_reason_forbidden')
  assert.equal(code('news_desk', mut(news(), (o) => { o.rights_status = 'cleared'; delete o.rights_reason })), 'OK')
})

test('upstream_approval_id: lowercase UUID only', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.upstream_approval_id = UUID.toUpperCase() })), 'upstream_approval_id_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.upstream_approval_id = 'news-pn-1001-v1-20261005' })), 'upstream_approval_id_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.upstream_approval_id = UUID + ' ' })), 'upstream_approval_id_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { delete o.upstream_approval_id })), 'upstream_approval_id_invalid')
})

test('approval fields, ai_generated, title', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.upstream_approved_at = 'nope' })), 'upstream_approved_at_not_timestamp')
  assert.equal(code('news_desk', mut(news(), (o) => { o.upstream_approved_by = '' })), 'upstream_approved_by_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { delete o.ai_generated })), 'ai_generated_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.title = '   ' })), 'title_invalid')
})

test('allowed_platforms: key and array required, [] allowed, known, no duplicates', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.allowed_platforms = [] })), 'OK') // explicit "none" is intent
  assert.equal(code('news_desk', mut(news(), (o) => { delete o.allowed_platforms })), 'allowed_platforms_required') // forgotten is not
  assert.equal(code('news_desk', mut(news(), (o) => { o.allowed_platforms = null })), 'allowed_platforms_required')
  assert.equal(code('news_desk', mut(news(), (o) => { o.allowed_platforms = 'youtube' })), 'allowed_platforms_not_array')
  assert.equal(code('news_desk', mut(news(), (o) => { o.allowed_platforms = ['facebook'] })), 'allowed_platforms_invalid')
  assert.equal(code('news_desk', mut(news(), (o) => { o.allowed_platforms = ['x', 'x'] })), 'allowed_platforms_duplicate')
})

test('not_before: news forbids, entertainment requires', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { o.not_before = '2026-10-06T00:00:00Z' })), 'not_before_forbidden_for_news')
  assert.equal(code('production_os', mut(film(), (o) => { delete o.not_before })), 'not_before_required')
  assert.equal(code('production_os', mut(film(), (o) => { o.not_before = 'soon' })), 'not_before_not_timestamp')
})

test('asset keys are bound to source / ref / version / role', () => {
  const setKey = (key: string) => mut(news(), (o) => { asset(o).key = key })
  const bad = 'asset_invalid:main_9x16:key'
  assert.equal(code('news_desk', setKey('imports/production_os/pn-1001/v1/main_9x16-abc')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-9999/v1/main_9x16-abc')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-1001/v2/main_9x16-abc')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-1001/v1/thumbnail-abc')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-1001/v1/main_9x16-')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-1001/v1/main_9x16-a/../../x')), bad)
  assert.equal(code('news_desk', setKey('imports/news_desk/pn-1001/v1/main_9x16-a b')), bad)
})

test('assets: sha256, bytes, aspect, main required', () => {
  assert.equal(code('news_desk', mut(news(), (o) => { asset(o).sha256 = 'A'.repeat(64) })), 'asset_invalid:main_9x16:sha256')
  assert.equal(code('news_desk', mut(news(), (o) => { asset(o).sha256 = 'a'.repeat(63) })), 'asset_invalid:main_9x16:sha256')
  assert.equal(code('news_desk', mut(news(), (o) => { delete asset(o).bytes })), 'asset_invalid:main_9x16')
  assert.equal(code('news_desk', mut(news(), (o) => { asset(o).bytes = -1 })), 'asset_invalid:main_9x16')
  assert.equal(code('news_desk', mut(news(), (o) => { asset(o).width = 1920; asset(o).height = 1080 })), 'asset_invalid:main_9x16:aspect')
  assert.equal(code('news_desk', mut(news(), (o) => { delete asset(o).height })), 'asset_invalid:main_9x16:size')
  assert.equal(code('news_desk', mut(news(), (o) => { asset(o).width = 1088 })), 'OK') // within 2%
  assert.equal(code('news_desk', mut(news(), (o) => { o.assets = [asset(o, 1)] })), 'main_asset_required')
  assert.equal(code('news_desk', mut(news(), (o) => { o.assets = [] })), 'assets_required')
})

test('script asset: text only, 64KB cap, no file fields', () => {
  const withScript = (extra: Record<string, unknown>) => mut(news(), (o) => { (o.assets as unknown[]).push({ role: 'script', ...extra }) })
  assert.equal(code('news_desk', withScript({ text_content: 'line' })), 'OK')
  assert.equal(code('news_desk', withScript({})), 'asset_invalid:script')
  assert.equal(code('news_desk', withScript({ text_content: 'x'.repeat(64 * 1024 + 1) })), 'asset_invalid:script:too_long')
  assert.equal(code('news_desk', withScript({ text_content: 'x'.repeat(64 * 1024) })), 'OK')
  assert.equal(code('news_desk', withScript({ text_content: 'a', key: 'imports/news_desk/pn-1001/v1/script-abc' })), 'asset_invalid:script')
})

test('RPC payload: server fields added, channel roles from pickAssetRole, urls from the key', () => {
  const r = validateImportRequest('news_desk', news())
  assert.ok(r.ok)
  if (!r.ok) return
  const p = buildImportRpcPayload(r.req, new Date('2026-10-06T22:00:00Z'), false, 'https://pub.example/')
  assert.equal(p.publish_at, '2026-10-06T22:00:00.000Z')
  assert.equal(p.late_for_slot, false)
  assert.equal(p.payload_hash, r.req.payload_hash)
  assert.equal(p.upstream_approved_at, '2026-10-05T00:00:00.000Z')
  const assets = p.assets as { role: string; url: string | null; key: string | null }[]
  assert.equal(assets[0].url, `https://pub.example/${assets[0].key}`)
  // 9:16 only: youtube has no usable asset (null, NOT a silent 16:9 substitute)
  const ch = Object.fromEntries((p.channels as { platform: string; role: string | null }[]).map((c) => [c.platform, c.role]))
  assert.deepEqual(ch, { youtube: null, instagram: 'main_9x16', tiktok: 'main_9x16', x: 'main_9x16' })
})

test('payload_hash does not depend on the slot, lateness or public base', () => {
  const r = validateImportRequest('news_desk', news())
  assert.ok(r.ok)
  if (!r.ok) return
  const a = buildImportRpcPayload(r.req, new Date('2026-10-06T22:00:00Z'), false, 'https://a.example')
  const b = buildImportRpcPayload(r.req, new Date('2026-10-07T22:00:00Z'), true, 'https://b.example')
  assert.equal(a.payload_hash, b.payload_hash)
})

test('empty allowed_platforms builds an empty channels list and hashes differently from a non-empty one', () => {
  const none = validateImportRequest('news_desk', mut(news(), (o) => { o.allowed_platforms = [] }))
  const some = validateImportRequest('news_desk', news())
  assert.ok(none.ok && some.ok)
  if (!none.ok || !some.ok) return
  const p = buildImportRpcPayload(none.req, new Date('2026-10-06T22:00:00Z'), false, 'https://pub.example')
  assert.deepEqual(p.channels, [])
  assert.notEqual(none.req.payload_hash, some.req.payload_hash)
})
