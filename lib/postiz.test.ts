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

// ---- YouTube settings (content dispatch only) --------------------------------

import { PostizConfigError, YOUTUBE_TITLE_MAX, parseYoutubeVisibility, youtubeTitle } from './postiz'

const CHANS = [
  { channel: 'youtube' as const, integrationId: 'yt1' },
  { channel: 'x' as const, integrationId: 'x1' },
]

test('youtube settings: title + type on the youtube entry only; other channels untouched', () => {
  const b = buildPostBody(CHANS, MEDIA, 'cap', { title: '[시험] 2026-10-07 clip', visibility: 'private' })
  const yt = b.posts.find((p) => p.integration.id === 'yt1')!
  const x = b.posts.find((p) => p.integration.id === 'x1')!
  assert.deepEqual(yt.settings, { __type: 'youtube', post_type: 'post', title: '[시험] 2026-10-07 clip', type: 'private' })
  assert.deepEqual(x.settings, { __type: 'x', post_type: 'post' })
})

test('promo path unchanged: without the youtube argument the settings are exactly the old shape', () => {
  const b = buildPostBody(CHANS, MEDIA, 'cap')
  for (const p of b.posts) assert.deepEqual(Object.keys(p.settings).sort(), ['__type', 'post_type'])
})

test('youtube settings with an unusable title throw BEFORE a body exists; the visibility is re-parsed, not trusted', () => {
  assert.throws(() => buildPostBody(CHANS, MEDIA, 'cap', { title: 'a', visibility: 'private' }), PostizConfigError)
  // a youtube argument with no youtube channel is simply ignored
  assert.doesNotThrow(() => buildPostBody([{ channel: 'x', integrationId: 'x1' }], MEDIA, 'cap', { title: 'a', visibility: 'private' }))
  const b = buildPostBody(CHANS, MEDIA, 'cap', { title: 'ok title', visibility: 'PUBLIC!!' as never })
  assert.equal((b.posts[0].settings as { type: string }).type, 'private')
})

test('parseYoutubeVisibility: only the three words, everything else is private', () => {
  assert.equal(parseYoutubeVisibility('public'), 'public')
  assert.equal(parseYoutubeVisibility(' UNLISTED '), 'unlisted')
  assert.equal(parseYoutubeVisibility('private'), 'private')
  for (const v of [undefined, null, '', 'pub', 'public ok', 1, true, {}, []]) assert.equal(parseYoutubeVisibility(v), 'private', String(v))
})

test('youtubeTitle: cleaned, capped at 100 code points, null when under 2 characters', () => {
  assert.equal(youtubeTitle('  [시험]\n 2026-10-07   clip '), '[시험] 2026-10-07 clip')
  assert.equal(youtubeTitle('<b>hi</b>'), 'bhi/b')
  assert.equal(youtubeTitle('a'), null)
  assert.equal(youtubeTitle('<>'), null)
  assert.equal(youtubeTitle(''), null)
  assert.equal(youtubeTitle('ab'), 'ab')
  const long = youtubeTitle('가'.repeat(150))!
  assert.equal(Array.from(long).length, YOUTUBE_TITLE_MAX)
  // 100 code points of an astral character: never split a surrogate pair
  const emoji = youtubeTitle('😀'.repeat(150))!
  assert.equal(Array.from(emoji).length, YOUTUBE_TITLE_MAX)
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(emoji))
})
