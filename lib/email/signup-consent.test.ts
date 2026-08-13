import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldRecordSignupConsent } from './signup-consent'

test('control group -- a row is never re-consented once it has opted out', () => {
  assert.equal(
    shouldRecordSignupConsent({ email_consent_at: '2026-08-01T00:00:00Z', email_opt_out_at: '2026-08-10T00:00:00Z' }),
    false,
  )
})

test('control group -- opted out with no prior consent stamp (e.g. unsubscribe link hit before any login) stays out', () => {
  assert.equal(
    shouldRecordSignupConsent({ email_consent_at: null, email_opt_out_at: '2026-08-10T00:00:00Z' }),
    false,
  )
})

test('already consented, never opted out -- second login does not re-stamp (idempotent, preserves original evidence)', () => {
  assert.equal(
    shouldRecordSignupConsent({ email_consent_at: '2026-08-01T00:00:00Z', email_opt_out_at: null }),
    false,
  )
})

test('brand new row, never touched -- gets the first stamp', () => {
  assert.equal(shouldRecordSignupConsent({ email_consent_at: null, email_opt_out_at: null }), true)
})

test('no row at all (lookup miss) never writes', () => {
  assert.equal(shouldRecordSignupConsent(null), false)
})
