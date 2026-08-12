// Run: node --import ./scripts/test-register.mjs --test lib/music-picker-scope.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { musicPickerOrFilter, musicPickerPathOk, isUuid } from './music-picker-scope.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

// ---- the SQL half -------------------------------------------------------
test('the or-filter is exactly this string (it is a signature-shaped constant)', () => {
  assert.equal(
    musicPickerOrFilter(A),
    'and(source.eq.library,active.is.true),and(source.eq.ai,user_id.eq.11111111-1111-4111-8111-111111111111)',
  )
})

test('the or-filter names BOTH paths -- a filter that only said library would hide the participant own tracks', () => {
  const f = musicPickerOrFilter(A)
  assert.ok(f.includes('source.eq.library'), 'library branch present')
  assert.ok(f.includes('source.eq.ai'), 'ai branch present')
  assert.ok(f.includes('active.is.true'), 'library rows must be curation-active')
  assert.ok(f.includes(`user_id.eq.${A}`), 'ai rows must be scoped to the caller')
})

test('a non-uuid userId throws rather than reaching PostgREST inside a filter string', () => {
  for (const bad of ['', 'not-a-uuid', "x') or ('1'='1", '11111111-1111-4111-8111', null, undefined, 42]) {
    assert.throws(() => musicPickerOrFilter(bad as string), /must be a uuid/, `rejected: ${String(bad)}`)
  }
})

// ---- the JS half, both directions ---------------------------------------
test('ACCEPTS: an active library row, and my own ai row', () => {
  assert.equal(musicPickerPathOk({ source: 'library', active: true, user_id: null }, A), true)
  assert.equal(musicPickerPathOk({ source: 'ai', active: true, user_id: A }, A), true)
  // an ai row does not need `active` -- curation is a library concept
  assert.equal(musicPickerPathOk({ source: 'ai', active: false, user_id: A }, A), true)
})

test('REFUSES: an inactive library row', () => {
  assert.equal(musicPickerPathOk({ source: 'library', active: false, user_id: null }, A), false)
})

test('REFUSES: a library row whose `active` is NULL -- undecided is withheld, not shown', () => {
  assert.equal(musicPickerPathOk({ source: 'library', active: null, user_id: null }, A), false)
  assert.equal(musicPickerPathOk({ source: 'library', active: undefined, user_id: null }, A), false)
  // and not merely truthy-tested
  assert.equal(musicPickerPathOk({ source: 'library', active: 1, user_id: null }, A), false)
  assert.equal(musicPickerPathOk({ source: 'library', active: 'true', user_id: null }, A), false)
})

test("REFUSES: another participant's ai row", () => {
  assert.equal(musicPickerPathOk({ source: 'ai', active: true, user_id: B }, A), false)
  assert.equal(musicPickerPathOk({ source: 'ai', active: true, user_id: null }, A), false)
})

test('REFUSES: any source that is neither library nor ai -- undecidable path is blocked', () => {
  for (const s of ['upload', 'LIBRARY', 'Ai', '', null, undefined, 0]) {
    assert.equal(musicPickerPathOk({ source: s, active: true, user_id: A }, A), false, `source=${String(s)}`)
  }
})

test('REFUSES everything when the caller id is not a uuid', () => {
  assert.equal(musicPickerPathOk({ source: 'library', active: true, user_id: null }, 'nope'), false)
  assert.equal(musicPickerPathOk({ source: 'ai', active: true, user_id: 'nope' }, 'nope'), false)
})

// ---- the two halves must agree -------------------------------------------
// ★The whole point of having both is defence in depth, which is worthless if they
// disagree. This asserts the agreement on the cases the SQL can express: for every
// row shape below, what the predicate says is what the filter was written to select.
test('SQL and JS agree on every enumerated row shape', () => {
  const rows = [
    { row: { source: 'library', active: true, user_id: null }, sqlSelects: true },
    { row: { source: 'library', active: false, user_id: null }, sqlSelects: false },
    { row: { source: 'library', active: null, user_id: null }, sqlSelects: false }, // active.is.true excludes NULL
    { row: { source: 'ai', active: true, user_id: A }, sqlSelects: true },
    { row: { source: 'ai', active: null, user_id: A }, sqlSelects: true }, // ai branch ignores active
    { row: { source: 'ai', active: true, user_id: B }, sqlSelects: false },
    { row: { source: 'upload', active: true, user_id: A }, sqlSelects: false }, // neither branch matches
  ]
  for (const { row, sqlSelects } of rows) {
    assert.equal(
      musicPickerPathOk(row, A),
      sqlSelects,
      `disagreement on ${JSON.stringify(row)}: SQL would ${sqlSelects ? 'select' : 'skip'} it`,
    )
  }
})

test('isUuid is the same check in both halves', () => {
  assert.equal(isUuid(A), true)
  assert.equal(isUuid('11111111-1111-4111-8111-11111111111'), false) // one short
  assert.equal(isUuid(`${A} `), false) // trailing space
})
