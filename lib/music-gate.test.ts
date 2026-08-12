// Fail-closed proof for the Studio music gate. Pure: evaluateMusicGate is the
// whole decision, so every failure path can be asserted without a database.
//
// The rule under test: music is OFF unless the season row says otherwise with a
// literal boolean true. Anything else -- missing row (query error / column not
// migrated / unknown season), null, a truthy string, a 1 -- stays closed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMusicGate, MUSIC_GATE_CLOSED, MUSIC_CAP_FALLBACK } from './music-gate'

const ON = {
  studio_music_enabled: true,
  studio_music_ai_enabled: true,
  studio_music_max_generations_per_round: 15,
}

test('closed: no row (query error / column missing / unknown season)', () => {
  assert.deepEqual(evaluateMusicGate(null), MUSIC_GATE_CLOSED)
  assert.deepEqual(evaluateMusicGate(undefined), MUSIC_GATE_CLOSED)
})

test('closed: empty row -- both columns absent', () => {
  assert.deepEqual(evaluateMusicGate({}), MUSIC_GATE_CLOSED)
})

test('closed: master false, even when ai is true', () => {
  const g = evaluateMusicGate({ studio_music_enabled: false, studio_music_ai_enabled: true })
  assert.equal(g.enabled, false)
  assert.equal(g.aiEnabled, false, 'ai must never open on its own')
})

test('closed: master null/undefined', () => {
  assert.equal(evaluateMusicGate({ studio_music_enabled: null }).enabled, false)
  assert.equal(evaluateMusicGate({ studio_music_enabled: undefined }).enabled, false)
})

test('closed: truthy non-boolean does NOT open a switch', () => {
  for (const v of ['true', 'TRUE', 1, 'yes', {}, []] as unknown[]) {
    assert.equal(evaluateMusicGate({ studio_music_enabled: v }).enabled, false, `value ${JSON.stringify(v)}`)
  }
})

test('library-only fallback: master true + ai false', () => {
  const g = evaluateMusicGate({ ...ON, studio_music_ai_enabled: false })
  assert.equal(g.enabled, true, 'picker open')
  assert.equal(g.aiEnabled, false, 'generation closed')
})

test('library-only fallback: master true + ai missing', () => {
  const g = evaluateMusicGate({ studio_music_enabled: true })
  assert.equal(g.enabled, true)
  assert.equal(g.aiEnabled, false)
})

test('fully open: master true + ai true', () => {
  const g = evaluateMusicGate(ON)
  assert.equal(g.enabled, true)
  assert.equal(g.aiEnabled, true)
  assert.equal(g.cap, 15)
})

test('cap: unreadable/garbage falls back to the conservative default, NOT unlimited', () => {
  for (const v of [undefined, null, 'abc', NaN, -3] as unknown[]) {
    const g = evaluateMusicGate({ ...ON, studio_music_max_generations_per_round: v })
    assert.equal(g.cap, MUSIC_CAP_FALLBACK, `value ${JSON.stringify(v)}`)
  }
})

test('cap: 0 is an explicit season opt-in to unlimited', () => {
  assert.equal(evaluateMusicGate({ ...ON, studio_music_max_generations_per_round: 0 }).cap, 0)
})

test('cap: floored to a whole number', () => {
  assert.equal(evaluateMusicGate({ ...ON, studio_music_max_generations_per_round: 15.9 }).cap, 15)
})

test('closed gate reports cap 0 but is unreachable -- enabled is false', () => {
  assert.equal(MUSIC_GATE_CLOSED.enabled, false)
  assert.equal(MUSIC_GATE_CLOSED.aiEnabled, false)
})
