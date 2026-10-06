import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyUploadedAssets } from './content-verify'
import type { ParsedAsset } from './content-import'
import type { ContentStorage } from './content-r2'

const H = 'a'.repeat(64)

function asset(over: Partial<ParsedAsset> = {}): ParsedAsset {
  return {
    role: 'main_9x16', media_type: 'video', key: 'imports/news_desk/r/v1/main_9x16-1', file_format: 'mp4',
    bytes: 100, duration_sec: null, width: null, height: null, sha256: H, text_content: null, ...over,
  }
}

function storage(objs: Record<string, { bytes: number; sha: string }>, calls: string[] = []): ContentStorage {
  return {
    async head(key) { calls.push(`head:${key}`); return objs[key] ? { bytes: objs[key].bytes } : null },
    async sha256(key) { calls.push(`sha:${key}`); return objs[key].sha },
  }
}

test('passes when object exists with matching size and sha256', async () => {
  const r = await verifyUploadedAssets([asset()], storage({ 'imports/news_desk/r/v1/main_9x16-1': { bytes: 100, sha: H } }))
  assert.deepEqual(r, { ok: true })
})

test('missing object -> asset_not_uploaded (the control for the pass case)', async () => {
  const r = await verifyUploadedAssets([asset()], storage({}))
  assert.deepEqual(r, { ok: false, status: 422, code: 'asset_not_uploaded:main_9x16' })
})

test('size mismatch is caught before the expensive read', async () => {
  const calls: string[] = []
  const r = await verifyUploadedAssets([asset()], storage({ 'imports/news_desk/r/v1/main_9x16-1': { bytes: 99, sha: H } }, calls))
  assert.deepEqual(r, { ok: false, status: 422, code: 'asset_size_mismatch:main_9x16' })
  assert.ok(!calls.some((c) => c.startsWith('sha:')), 'no full read when size already differs')
})

test('sha256 mismatch: the claimed hash is not trusted', async () => {
  const r = await verifyUploadedAssets([asset()], storage({ 'imports/news_desk/r/v1/main_9x16-1': { bytes: 100, sha: 'b'.repeat(64) } }))
  assert.deepEqual(r, { ok: false, status: 422, code: 'asset_sha256_mismatch:main_9x16' })
})

test('text assets need no object; a missing second asset still fails the request', async () => {
  const script = asset({ role: 'script', media_type: 'text', key: null, sha256: null, bytes: null, text_content: 'x' })
  assert.deepEqual(await verifyUploadedAssets([script], storage({})), { ok: true })
  const thumb = asset({ role: 'thumbnail', media_type: 'image', key: 'imports/news_desk/r/v1/thumbnail-2' })
  const r = await verifyUploadedAssets([asset(), thumb], storage({ 'imports/news_desk/r/v1/main_9x16-1': { bytes: 100, sha: H } }))
  assert.deepEqual(r, { ok: false, status: 422, code: 'asset_not_uploaded:thumbnail' })
})
