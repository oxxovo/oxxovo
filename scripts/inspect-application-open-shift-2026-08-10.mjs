#!/usr/bin/env node
/**
 * READ-ONLY measurement for HQ item 2: what breaks if application_open_at
 * moves season_0 from 2026-07-25 to 2026-09-09 PT. Writes nothing.
 * Service role so RLS cannot hide a row.
 *
 *   node --env-file=.env.local scripts/inspect-application-open-shift-2026-08-10.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { getSeasonPhase, toLobbyMode } from '../lib/season-phase.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('missing SUPABASE env')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const line = (s) => console.log('\n===== ' + s + ' ' + '='.repeat(Math.max(0, 60 - s.length)))

const now = new Date()
console.log('now =', now.toISOString())

line('1. every season row: open date, status, is_fixture')
const { data: all, error } = await db
  .from('seasons')
  .select(
    'id, season_number, status, is_fixture, application_open_at, application_close_at, main_round_start_at'
  )
  .order('application_open_at', { ascending: true, nullsFirst: false })
if (error) throw error
for (const s of all) {
  console.log(
    s.id.padEnd(14),
    'open=' + (s.application_open_at ?? 'NULL').toString().padEnd(26),
    'fixture=' + s.is_fixture,
    'status=' + s.status
  )
}

line('2. getCurrentSeason() simulation, season_0.application_open_at overridden to 2026-09-09 PT')
const SHIFTED_OPEN = new Date('2026-09-09T07:00:00.000Z').toISOString() // 00:00 PDT? verify below
console.log('shifted open ISO used:', SHIFTED_OPEN)

function simulate(rows) {
  const opened = rows
    .filter((s) => s.application_open_at && s.application_open_at <= now.toISOString())
    .sort((a, b) => (a.application_open_at < b.application_open_at ? 1 : -1))
  if (opened[0]) return { path: 'opened', row: opened[0] }
  const upcoming = rows
    .filter((s) => s.application_open_at) // NULLs excluded, matches "nulls last" ascending pick of first non-null
    .sort((a, b) => (a.application_open_at < b.application_open_at ? -1 : 1))
  return { path: 'fallback-upcoming', row: upcoming[0] ?? null }
}

const shiftedRows = all.map((s) =>
  s.id === 'season_0' ? { ...s, application_open_at: SHIFTED_OPEN } : s
)
const result = simulate(shiftedRows)
console.log('getCurrentSeason() would resolve via:', result.path)
console.log('-> id:', result.row?.id, 'open:', result.row?.application_open_at, 'is_fixture:', result.row?.is_fixture)

line('3. getSeasonPhase() for season_0 with shifted open, now = today')
const s0 = shiftedRows.find((s) => s.id === 'season_0')
const { data: s0Full } = await db
  .from('seasons')
  .select(
    'application_close_at, main_round_start_at, main_round_end_at, community_vote_start_at, community_vote_end_at, awards_announcement_at, status'
  )
  .eq('id', 'season_0')
  .single()
const phaseResult = getSeasonPhase(
  {
    status: s0Full.status,
    applicationOpenAt: s0.application_open_at,
    applicationCloseAt: s0Full.application_close_at,
    scoringStartAt: null,
    mainRoundStartAt: s0Full.main_round_start_at,
    mainRoundEndAt: s0Full.main_round_end_at,
    voteStartAt: s0Full.community_vote_start_at,
    voteEndAt: s0Full.community_vote_end_at,
    awardsAt: s0Full.awards_announcement_at,
    finalistCount: 0,
    winnerCount: 0,
  },
  now
)
console.log('season_0 phase:', phaseResult)
console.log('lobby mode:', toLobbyMode(phaseResult.phase))

line('4. any other row whose real (unshifted) open_at falls between now and 9/9')
const gapRows = all.filter(
  (s) =>
    s.id !== 'season_0' &&
    s.application_open_at &&
    s.application_open_at > now.toISOString() &&
    s.application_open_at <= SHIFTED_OPEN
)
console.log(gapRows.length, 'row(s)')
for (const r of gapRows) console.log(' -', r.id, r.application_open_at, 'fixture=' + r.is_fixture)
