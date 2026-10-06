// Postiz client guards (design SS5-3, SS5-6). The network is a fake fetch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildPostBody, prepareMedia, publishPrepared, PostizMediaError } from './postiz'

const MEDIA = { id: 'm', path: 'p' }

test('the post body is always type:now and carries one entry per channel', () => {
  const b = buildPostBody([{ channel: 'youtube', integrationId: 'i1' }, { channel: 'x', integrationId: 'i2' }], MEDIA, 'hi')
  assert.equal(b.type, 'now')
  assert.equal(b.posts.length, 2)
})

test('scheduling is refused at runtime, before any lookup or request', async () => {
  await assert.rejects(
    publishPrepared({ channels: ['youtube'], media: MEDIA, caption: 'x', scheduledAt: '2030-01-01T00:00:00Z' } as never),
    /scheduling is not allowed/,
  )
})

function withFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, fn: () => Promise<void>) {
  const orig = globalThis.fetch
  globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => handler(String(u), init)) as typeof fetch
  process.env.POSTIZ_API_KEY = 'test-key'
  return fn().finally(() => {
    globalThis.fetch = orig
    delete process.env.POSTIZ_API_KEY
  })
}

test('hash mismatch aborts BEFORE the upload request is made', async () => {
  const calls: string[] = []
  await withFetch(
    (url) => {
      calls.push(url)
      return new Response(Buffer.from('actual bytes'), { headers: { 'content-type': 'video/mp4' } })
    },
    async () => {
      await assert.rejects(
        prepareMedia('https://r2.example/a.mp4', { expectedSha256: 'f'.repeat(64) }),
        (e: unknown) => e instanceof PostizMediaError && e.code === 'hash_mismatch',
      )
      assert.deepEqual(calls, ['https://r2.example/a.mp4']) // only the download; nothing went to Postiz
    },
  )
})

test('control: matching hash proceeds to the upload request', async () => {
  const body = Buffer.from('actual bytes')
  const sha = createHash('sha256').update(body).digest('hex')
  const calls: string[] = []
  await withFetch(
    (url) => {
      calls.push(url)
      if (url.endsWith('/upload')) return new Response(JSON.stringify({ id: 'u1', path: 'pp' }), { status: 200 })
      return new Response(body, { headers: { 'content-type': 'video/mp4' } })
    },
    async () => {
      const m = await prepareMedia('https://r2.example/a.mp4', { expectedSha256: sha })
      assert.deepEqual(m, { id: 'u1', path: 'pp' })
      assert.equal(calls.length, 2)
    },
  )
})

test('size ceiling: refused on the Content-Length header, and on the received bytes when the header lies', async () => {
  await withFetch(
    () => new Response(Buffer.alloc(10), { headers: { 'content-length': '5000' } }),
    async () => {
      await assert.rejects(
        prepareMedia('https://r2.example/a.mp4', { maxBytes: 100 }),
        (e: unknown) => e instanceof PostizMediaError && e.code === 'oversize',
      )
    },
  )
  await withFetch(
    () => new Response(Buffer.alloc(500)),
    async () => {
      await assert.rejects(
        prepareMedia('https://r2.example/a.mp4', { maxBytes: 100 }),
        (e: unknown) => e instanceof PostizMediaError && e.code === 'oversize',
      )
    },
  )
})
