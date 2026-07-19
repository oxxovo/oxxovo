// Moderation gate proof (Patent 3 -- "AI 사전 콘텐츠 모더레이션부").
// Run: node --import ./scripts/test-register.mjs --test lib/moderation.test.ts
//
// Proves the INVARIANT that a studio submission can NEVER go public unless a scan
// actively approved it. moderateSubmission is the single classifier every mint
// path (POST /api/apply, submitGeneration, submitRender) funnels its statement
// through; isPublicRow (watch.ts) then treats ONLY 'approved' as public. So the
// safety property is: flagged content -> 'flagged' (blocked), and every failure
// mode (no key / API error / timeout / nothing scannable) -> 'pending' (blocked),
// NEVER 'approved'. This is deterministic ($0, no network): globalThis.fetch is
// stubbed to simulate the OpenAI moderation endpoint. Real-OpenAI classification
// of a real malicious string + the live end-to-end gate are proven separately by
// e2e/moderation-gate.mjs (dev server + real key).
import test from 'node:test'
import assert from 'node:assert/strict'
import { moderateSubmission } from './moderation.ts'

const KEY = 'test-key-not-real'
const origFetch = globalThis.fetch

// Build a fake OpenAI /v1/moderations response.
function okResponse(flagged: boolean, categories: Record<string, boolean> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ flagged, categories }] }),
  } as unknown as Response
}

async function withFetch(fn: () => unknown, body: () => Promise<void>) {
  globalThis.fetch = fn as typeof fetch
  try {
    await body()
  } finally {
    globalThis.fetch = origFetch
  }
}

test('flagged content is BLOCKED (status=flagged, categories surfaced)', async () => {
  process.env.OPENAI_API_KEY = KEY
  await withFetch(
    () => okResponse(true, { harassment: true, 'harassment/threatening': true, violence: false }),
    async () => {
      const r = await moderateSubmission({ text: 'a malicious, policy-violating statement' })
      assert.equal(r.status, 'flagged')
      assert.notEqual(r.status, 'approved') // the safety property: not public
      assert.ok(r.categories.includes('harassment'))
      assert.ok(!r.categories.includes('violence')) // false categories are not surfaced
    },
  )
})

test('clean content is APPROVED (the gate does not just block everything)', async () => {
  process.env.OPENAI_API_KEY = KEY
  await withFetch(
    () => okResponse(false, { harassment: false }),
    async () => {
      const r = await moderateSubmission({ text: 'A wholesome creator statement about my short film.' })
      assert.equal(r.status, 'approved')
      assert.deepEqual(r.categories, [])
    },
  )
})

test('no OPENAI_API_KEY -> pending (fail-safe, fetch never called)', async () => {
  delete process.env.OPENAI_API_KEY
  let called = false
  await withFetch(
    () => { called = true; return okResponse(false) },
    async () => {
      const r = await moderateSubmission({ text: 'anything' })
      assert.equal(r.status, 'pending')
      assert.notEqual(r.status, 'approved')
      assert.equal(called, false) // no key -> short-circuits before any network call
    },
  )
})

test('nothing scannable (empty text, no image) -> pending, fetch never called', async () => {
  process.env.OPENAI_API_KEY = KEY
  let called = false
  await withFetch(
    () => { called = true; return okResponse(false) },
    async () => {
      const r = await moderateSubmission({ text: '   ', imageUrl: null })
      assert.equal(r.status, 'pending')
      assert.notEqual(r.status, 'approved')
      assert.equal(called, false) // can't approve what it can't scan
    },
  )
})

test('OpenAI API error (non-2xx) -> pending (fail-safe)', async () => {
  process.env.OPENAI_API_KEY = KEY
  await withFetch(
    () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response),
    async () => {
      const r = await moderateSubmission({ text: 'statement' })
      assert.equal(r.status, 'pending')
      assert.notEqual(r.status, 'approved')
    },
  )
})

test('network failure / timeout (fetch throws) -> pending (fail-safe)', async () => {
  process.env.OPENAI_API_KEY = KEY
  await withFetch(
    () => { throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }) },
    async () => {
      // The 5s AbortController timeout lands in this same catch branch, so a slow/
      // hung OpenAI at launch (up to 500 concurrent) -> pending, never a hung submit.
      const r = await moderateSubmission({ text: 'statement' })
      assert.equal(r.status, 'pending')
      assert.notEqual(r.status, 'approved')
    },
  )
})

test('SAFETY PROPERTY: no non-approving outcome ever returns "approved"', async () => {
  // Enumerate every failure/blocked mode and assert none is public.
  process.env.OPENAI_API_KEY = KEY
  // flagged
  await withFetch(() => okResponse(true, { hate: true }), async () => {
    assert.notEqual((await moderateSubmission({ text: 'x' })).status, 'approved')
  })
  // api error
  await withFetch(() => ({ ok: false, status: 429, json: async () => ({}) } as unknown as Response), async () => {
    assert.notEqual((await moderateSubmission({ text: 'x' })).status, 'approved')
  })
  // throw
  await withFetch(() => { throw new Error('boom') }, async () => {
    assert.notEqual((await moderateSubmission({ text: 'x' })).status, 'approved')
  })
  // no key
  delete process.env.OPENAI_API_KEY
  await withFetch(() => okResponse(false), async () => {
    assert.notEqual((await moderateSubmission({ text: 'x' })).status, 'approved')
  })
})
