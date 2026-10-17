// The Watch gate: Preview opens without the DB switch, Production and local still follow it.
// The DB is never reached: the Supabase env points at a closed local port, so any read fails
// (-> closed, fail-closed) instead of touching the real database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isCompetitionWatchPublic } from './watch-gate.ts'

const KEYS = ['VERCEL_ENV', 'WATCH_PUBLIC_ENABLED', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

async function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-real'
  Object.assign(process.env, env)
  try {
    await fn()
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

test('★preview: the competition surface is open without the DB switch', async () => {
  await withEnv({ VERCEL_ENV: 'preview' }, async () => {
    assert.equal(await isCompetitionWatchPublic(), true)
  })
})

test('★production control: same environment except VERCEL_ENV -> closed (the switch could not be read)', async () => {
  await withEnv({ VERCEL_ENV: 'production', WATCH_PUBLIC_ENABLED: 'true' }, async () => {
    assert.equal(await isCompetitionWatchPublic(), false)
  })
})

test('★production without the platform gate is closed whatever the switch says', async () => {
  await withEnv({ VERCEL_ENV: 'production' }, async () => {
    assert.equal(await isCompetitionWatchPublic(), false)
  })
})

test('local dev (no VERCEL_ENV) still follows the DB switch, which could not be read here -> closed', async () => {
  await withEnv({}, async () => {
    assert.equal(await isCompetitionWatchPublic(), false)
  })
})

test('★source guard: the preview shortcut is exactly one line, after the platform gate, before the DB read', () => {
  const src = readFileSync('lib/watch-gate.ts', 'utf8').replace(/\/\/.*$/gm, '')
  const fn = src.slice(src.indexOf('export async function isCompetitionWatchPublic'))
  const platform = fn.indexOf('if (!isWatchPublic()) return false')
  const preview = fn.indexOf("if (process.env.VERCEL_ENV === 'preview') return true")
  const db = fn.indexOf('return isCompetitionPublicationEnabled()')
  assert.ok(platform !== -1 && preview !== -1 && db !== -1)
  assert.ok(platform < preview && preview < db)
  assert.equal(fn.split("'preview'").length - 1, 1, 'only one preview special case')
})
