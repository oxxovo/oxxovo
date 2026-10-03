// Competition Publication is FAIL-CLOSED (HQ 2026-10-03). Verification against the
// real platform_config, read-only. Holds whether or not the row exists, so it
// needs no editing if the row is ever removed or flipped.
//
// The missing-row / error / garbage directions are pinned without a database in
// lib/competition-publication.test.ts; this file checks the wiring against the
// live row and the composed gate.
//
// Usage: node --env-file=.env.local --import ./scripts/test-register.mjs --test e2e/phase0-competition-publication-default.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { isCompetitionPublicationEnabled } from '../lib/competition-publication.ts'
import { isWatchPublic, isCompetitionWatchPublic } from '../lib/watch-gate.ts'

test('isCompetitionPublicationEnabled() equals "row exists and says true" -- a missing row is closed', async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.from('platform_config').select('value').eq('key', 'competition_publication_enabled').maybeSingle()
  assert.equal(error, null)
  const expected = data ? String(data.value).trim().toLowerCase() === 'true' : false
  assert.equal(await isCompetitionPublicationEnabled(), expected)
})

test('isCompetitionWatchPublic() is the AND of the env gate and the DB switch', async () => {
  assert.equal(await isCompetitionWatchPublic(), isWatchPublic() && (await isCompetitionPublicationEnabled()))
})
