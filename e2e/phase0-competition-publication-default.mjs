// Phase 0-3 verification: competition_publication_enabled has NOT been inserted
// into platform_config (that INSERT is a DB write -- see the Phase 0 report,
// reports/competition_publication_switch_2026-09-27.sql, for TK to run). Until it
// exists, isCompetitionPublicationEnabled() must default to true so this whole
// change is a no-op on current production behavior.
//
// Usage: node --env-file=.env.local --import ./scripts/test-register.mjs --test e2e/phase0-competition-publication-default.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { isCompetitionPublicationEnabled } from '../lib/competition-publication.ts'
import { isWatchPublic, isCompetitionWatchPublic } from '../lib/watch-gate.ts'

test('★precondition: competition_publication_enabled does not exist in platform_config yet', async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data } = await admin.from('platform_config').select('key').eq('key', 'competition_publication_enabled').maybeSingle()
  assert.equal(data, null, 'this row should not exist -- P0-3 did not write to the DB')
})

test('isCompetitionPublicationEnabled() defaults to true when the row is missing (no behavior change)', async () => {
  assert.equal(await isCompetitionPublicationEnabled(), true)
})

test('isCompetitionWatchPublic() equals isWatchPublic() alone while the new switch is unset', async () => {
  assert.equal(await isCompetitionWatchPublic(), isWatchPublic())
})
