// Phase 0-B / P0-2 verification: with every real season unscheduled (season_0's
// dates were cleared 2026-09-26; season_1..4 have never had any), getCurrentSeason()
// must return null -- not guess at one of the tied, unscheduled rows.
//
// Usage: node --env-file=.env.local --import ./scripts/test-register.mjs --test e2e/phase0-current-season-null.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { getCurrentSeason } from '../lib/seasons.ts'

test('★precondition: every real season currently has application_open_at = NULL', async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.from('seasons').select('id, is_fixture, application_open_at').eq('is_fixture', false)
  assert.equal(error, null, error?.message)
  const scheduled = (data ?? []).filter((s) => s.application_open_at !== null)
  console.log(`  real seasons: ${data?.length}, with a scheduled open date: ${scheduled.length}`)
  assert.equal(scheduled.length, 0, 'this test assumes the current 2026-09-27 state (all real seasons unscheduled) -- if this fails, real dates exist again and the null-fallback test below is not exercising the case it claims to')
})

test('★getCurrentSeason() returns null -- not a guessed season -- when nothing is scheduled', async () => {
  const season = await getCurrentSeason()
  assert.equal(season, null, `expected null, got ${season?.id} -- the fallback must not pick an unscheduled season`)
})
