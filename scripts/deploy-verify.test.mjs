import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyVersionResponse, verifyLive, diagnoseDeployment } from './deploy-verify.mjs'

const SHA = '4fb8824'
const BUILT = '2026-10-07T18:40:54.371Z'
const json = (sha, builtAt = BUILT) => ({ status: 200, contentType: 'application/json', text: JSON.stringify({ sha, dirty: false, builtAt }) })
const wall = { status: 401, contentType: 'text/html; charset=utf-8', text: '<!doctype html><title>Authentication Required</title>' }

// A fetch that answers from a script, one entry per call; a function entry may throw.
function scripted(entries) {
  let i = 0
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const e = entries[Math.min(i++, entries.length - 1)]
    const r = typeof e === 'function' ? e() : e
    return new Response(r.text, { status: r.status, headers: { 'content-type': r.contentType } })
  }
  return { fetchImpl, calls }
}
const noSleep = () => {
  const slept = []
  return { sleep: async (ms) => void slept.push(ms), slept }
}

test('classify: exact match passes', () => {
  assert.equal(classifyVersionResponse(json(SHA), { sha: SHA, builtAt: BUILT }).kind, 'match')
  assert.equal(classifyVersionResponse(json(SHA), { sha: SHA }).kind, 'match') // builtAt unknown (standalone verify)
})

test('classify: an OLD sha is stale, never a match (control: the same body with the new sha matches)', () => {
  assert.equal(classifyVersionResponse(json('9ab016e'), { sha: SHA, builtAt: BUILT }).kind, 'stale')
  assert.equal(classifyVersionResponse(json(SHA), { sha: SHA, builtAt: BUILT }).kind, 'match')
})

test('classify: same commit but an earlier build is stale (builtAt differs)', () => {
  const r = classifyVersionResponse(json(SHA, '2026-10-06T00:00:00.000Z'), { sha: SHA, builtAt: BUILT })
  assert.equal(r.kind, 'stale')
  assert.match(r.detail, /earlier build/)
})

test('classify: an HTML page is "html" whatever the status, and is never a match', () => {
  assert.equal(classifyVersionResponse(wall, { sha: SHA }).kind, 'html')
  assert.equal(classifyVersionResponse({ ...wall, status: 200 }, { sha: SHA }).kind, 'html')
  assert.equal(classifyVersionResponse({ status: 200, contentType: null, text: '<html>' }, { sha: SHA }).kind, 'html')
})

test('classify: non-200 JSON, broken JSON, missing sha are failures', () => {
  assert.equal(classifyVersionResponse({ status: 500, contentType: 'application/json', text: '{"sha":"4fb8824"}' }, { sha: SHA }).kind, 'http')
  assert.equal(classifyVersionResponse({ status: 200, contentType: 'application/json', text: 'nope' }, { sha: SHA }).kind, 'badjson')
  assert.equal(classifyVersionResponse({ status: 200, contentType: 'application/json', text: '{"x":1}' }, { sha: SHA }).kind, 'badjson')
})

test('verify: old sha is RETRIED, then passes when www moves (not accepted early)', async () => {
  const f = scripted([json('9ab016e'), json('9ab016e'), json('9ab016e'), json(SHA)])
  const s = noSleep()
  const v = await verifyLive({ sha: SHA, builtAt: BUILT, fetchImpl: f.fetchImpl, sleep: s.sleep, attempts: 12 })
  assert.equal(v.ok, true)
  assert.equal(v.attempts, 4)
  assert.equal(f.calls.length, 4)
  assert.equal(s.slept.length, 3)
})

test('verify: www that never moves FAILS after all attempts (this is the false-pass guard)', async () => {
  const f = scripted([json('9ab016e')])
  const s = noSleep()
  const v = await verifyLive({ sha: SHA, builtAt: BUILT, fetchImpl: f.fetchImpl, sleep: s.sleep, attempts: 5 })
  assert.equal(v.ok, false)
  assert.equal(v.attempts, 5)
  assert.equal(v.last.kind, 'stale')
  assert.equal(f.calls.length, 5)
  assert.equal(s.slept.length, 4) // no sleep after the last try
})

test('verify: HTML from www fails with kind "html" (not "stale", not a pass)', async () => {
  const f = scripted([wall])
  const v = await verifyLive({ sha: SHA, fetchImpl: f.fetchImpl, sleep: noSleep().sleep, attempts: 3 })
  assert.equal(v.ok, false)
  assert.equal(v.last.kind, 'html')
})

test('verify: a network error is retried; the request carries a cache-busting query', async () => {
  const f = scripted([() => { throw new Error('ECONNRESET') }, json(SHA)])
  const v = await verifyLive({ sha: SHA, fetchImpl: f.fetchImpl, sleep: noSleep().sleep, attempts: 3 })
  assert.equal(v.ok, true)
  assert.equal(v.attempts, 2)
  assert.match(f.calls[0], /^https:\/\/www\.oxxovo\.ai\/api\/version\?v=\d+$/)
})

test('diagnose: auth wall / alias problem / wrong stamp are told apart', async () => {
  const d = (entry) => diagnoseDeployment({ url: 'https://x.vercel.app', sha: SHA, builtAt: BUILT, fetchImpl: scripted([entry]).fetchImpl })
  assert.match(await d(wall), /auth wall/)
  assert.match(await d(json(SHA)), /alias \/ propagation/)
  assert.match(await d(json('9ab016e')), /stamp did not reach the build/)
})

// deploy-prod.mjs deploys for real when run, so it cannot be executed here. Its wiring
// is pinned by reading the source: the false-pass shapes it must never go back to.
test('deploy-prod.mjs wiring: verifies www via verifyLive, fails the run when unverified, never fetches the deployment URL itself', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('./deploy-prod.mjs', import.meta.url), 'utf8')
  assert.match(src, /import \{[^}]*verifyLive[^}]*\} from '\.\/deploy-verify\.mjs'/)
  assert.match(src, /await verifyLive\(\{ sha: buildSha, builtAt: buildTime/)
  assert.match(src, /NOT VERIFIED[\s\S]*process\.exitCode = 1/) // an unverified deploy is a failed run
  assert.doesNotMatch(src, /fetch\(`\$\{url\}\/api\/version`/) // the old walled check
  assert.doesNotMatch(src, /Could not verify automatically/) // the always-on warning
})
