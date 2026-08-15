// Control test for HQ 2026-08-15's explicit demand: prove wrong-type input
// is actually rejected before ever building the UI around the assumption
// that it is. "Saved" must not silently mean "whatever string was typed."

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfigValue, isRiskKey } from './settings-validate'

test('bool: accepts only the literal strings true/false', () => {
  assert.deepEqual(validateConfigValue('bool', 'true'), { ok: true, normalized: 'true' })
  assert.deepEqual(validateConfigValue('bool', 'false'), { ok: true, normalized: 'false' })
})

test('bool: rejects a non-bool string typed into a bool key', () => {
  for (const bad of ['yes', 'TRUE', '1', '0', 'on', '', 'null']) {
    const r = validateConfigValue('bool', bad)
    assert.equal(r.ok, false, `expected "${bad}" to be rejected`)
  }
})

test('int: accepts integers, including negative', () => {
  assert.deepEqual(validateConfigValue('int', '20'), { ok: true, normalized: '20' })
  assert.deepEqual(validateConfigValue('int', '-3'), { ok: true, normalized: '-3' })
  assert.deepEqual(validateConfigValue('int', '  7 '), { ok: true, normalized: '7' })
})

test('int: rejects non-integer input typed into an int key', () => {
  for (const bad of ['abc', '1.5', '', '1,000', '7px', 'NaN']) {
    const r = validateConfigValue('int', bad)
    assert.equal(r.ok, false, `expected "${bad}" to be rejected`)
  }
})

test('decimal: accepts integers and decimals', () => {
  assert.deepEqual(validateConfigValue('decimal', '0.25'), { ok: true, normalized: '0.25' })
  assert.deepEqual(validateConfigValue('decimal', '500'), { ok: true, normalized: '500' })
})

test('decimal: rejects non-numeric input typed into a decimal key', () => {
  for (const bad of ['abc', '', '1.2.3', '1e5', '$5']) {
    const r = validateConfigValue('decimal', bad)
    assert.equal(r.ok, false, `expected "${bad}" to be rejected`)
  }
})

test('text: passes through, trimmed, empty allowed', () => {
  assert.deepEqual(validateConfigValue('text', '  hello  '), { ok: true, normalized: 'hello' })
  assert.deepEqual(validateConfigValue('text', ''), { ok: true, normalized: '' })
})

test('unknown value_type is rejected rather than falling through to text', () => {
  const r = validateConfigValue('json', '{}')
  assert.equal(r.ok, false)
})

test('isRiskKey matches only the *_enabled suffix', () => {
  assert.equal(isRiskKey('session6_enabled'), true)
  assert.equal(isRiskKey('member_hosted_enabled'), true)
  assert.equal(isRiskKey('membership_required_for_apply'), false)
  assert.equal(isRiskKey('partner_escrow_required'), false)
})
