import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canSendMarketingEmail } from './consent'

// Control group, run FIRST and expected to fail loudly if the gate is ever
// weakened: an account that never consented, or that unsubscribed, must never
// be a marketing-send target. See feedback_fixture_seed_failure_vacuous_pass
// -- a gate that always returns true would pass every "consented" test below
// while also passing this one, so this one has to exist and has to be red
// the moment the guard clause is removed.
test('control group -- never consented does not get marketing email', () => {
  assert.equal(canSendMarketingEmail({ email_opt_in: false, email_opt_out_at: null }), false)
})

test('control group -- consent columns entirely null (pre-migration row) does not get marketing email', () => {
  assert.equal(canSendMarketingEmail({ email_opt_in: null, email_opt_out_at: null }), false)
})

test('consented and never opted out gets marketing email', () => {
  assert.equal(canSendMarketingEmail({ email_opt_in: true, email_opt_out_at: null }), true)
})

test('opted in but later unsubscribed does not get marketing email', () => {
  assert.equal(
    canSendMarketingEmail({ email_opt_in: true, email_opt_out_at: '2026-08-11T00:00:00Z' }),
    false,
  )
})

test('opt_out_at wins even if email_opt_in was left stale true', () => {
  // Defensive: unsubscribeEmail() always flips opt_in to false alongside
  // opt_out_at, but the gate does not trust that alone -- opt_out_at is the
  // authoritative "stop" signal even if some other write path only touched
  // one column.
  assert.equal(
    canSendMarketingEmail({ email_opt_in: true, email_opt_out_at: '2020-01-01T00:00:00Z' }),
    false,
  )
})
