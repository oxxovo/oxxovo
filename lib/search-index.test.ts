// The fail-closed rule for search indexing of the Watch pages, with no database in the way.
// The DB is never reached: the Supabase env points at a closed local port, so the read fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { decideSearchIndexAllowed, isSearchIndexAllowed, searchIndexMetadata } from './search-index.ts'

const NOINDEX = { robots: { index: false, follow: false } }

test('only a row saying true lifts the noindex', () => {
  assert.equal(decideSearchIndexAllowed({ value: 'true' }, null), true)
  assert.equal(decideSearchIndexAllowed({ value: ' TRUE ' }, null), true)
})

test('★no row, a query error, and every value but true keep the noindex', () => {
  assert.equal(decideSearchIndexAllowed(null, null), false)
  assert.equal(decideSearchIndexAllowed(undefined, null), false)
  assert.equal(decideSearchIndexAllowed({ value: 'true' }, { message: 'boom' }), false)
  for (const v of ['false', '', 'False', '1', 'yes', 'tru', null, undefined, 0, true]) {
    assert.equal(decideSearchIndexAllowed({ value: v }, null), v === true, String(v))
  }
})

test('★the read itself fails closed: unreachable database -> not allowed', async () => {
  const saved = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY]
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-real'
  try {
    assert.equal(await isSearchIndexAllowed(), false)
  } finally {
    if (saved[0] === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved[0]
    if (saved[1] === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved[1]
  }
})

test('★the read fails closed when the client cannot even be created (thrown, not returned): no Supabase env -> not allowed', async () => {
  const saved = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY]
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    assert.equal(await isSearchIndexAllowed(), false)
  } finally {
    if (saved[0] !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved[0]
    if (saved[1] !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved[1]
  }
})

test('metadata: not allowed -> noindex+nofollow; allowed -> no robots tag', () => {
  assert.deepEqual(searchIndexMetadata(false), NOINDEX)
  assert.deepEqual(searchIndexMetadata(true), {})
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

test('★wiring: app/watch/layout.tsx feeds the switch into generateMetadata, and no page under app/watch sets its own robots', () => {
  const layout = readFileSync('app/watch/layout.tsx', 'utf8')
  assert.ok(/export async function generateMetadata/.test(layout))
  assert.ok(/searchIndexMetadata\(await isSearchIndexAllowed\(\)\)/.test(layout))
  const own = walk('app/watch').filter((f) => /\.(ts|tsx)$/.test(f) && f.split(String.fromCharCode(92)).join('/') !== 'app/watch/layout.tsx' && /\brobots\b/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(own, [])
})

test('robots.txt stays Allow: / for the Watch pages (a Disallow would hide the noindex from crawlers)', () => {
  const src = readFileSync('app/robots.ts', 'utf8').replace(/\/\/.*$/gm, '')
  assert.ok(/isWatchPublic\(\)\) \{\s*return \{ rules: \{ userAgent: '\*', allow: '\/' \}/.test(src))
})
