import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planBroadcastSend } from './broadcast'

// Control group ① (HQ, 2026-08-12): a recipient in the queue-time snapshot
// who unsubscribed BEFORE this tick actually runs must be skipped, not sent
// -- the snapshot names who was a target then, not who consents now.
test('control group -- unsubscribed since the snapshot was taken is skipped, not sent', () => {
  const plan = planBroadcastSend(
    ['a@example.com'],
    new Map([['a@example.com', { email_opt_in: true, email_opt_out_at: '2026-08-11T00:00:00Z' }]]),
  )
  assert.deepEqual(plan, { toSend: [], toSkip: ['a@example.com'] })
})

// Control group ② (HQ, 2026-08-12): a recipient with NO live consent row at
// all -- never signed up, so no profiles row exists to check -- must not be
// treated as "no evidence either way, so send". canSendMarketingEmail is the
// door; a caller that stops checking for it must fail closed, not open.
test('control group -- no live consent record (never signed up) is skipped, not defaulted to send', () => {
  const plan = planBroadcastSend(['ghost@example.com'], new Map())
  assert.deepEqual(plan, { toSend: [], toSkip: ['ghost@example.com'] })
})

test('currently consented, never opted out, gets sent', () => {
  const plan = planBroadcastSend(
    ['b@example.com'],
    new Map([['b@example.com', { email_opt_in: true, email_opt_out_at: null }]]),
  )
  assert.deepEqual(plan, { toSend: ['b@example.com'], toSkip: [] })
})

test('a mixed batch splits correctly and case/whitespace do not affect the match', () => {
  const plan = planBroadcastSend(
    [' Consented@Example.com ', 'optedout@example.com', 'nevershown@example.com'],
    new Map([
      ['consented@example.com', { email_opt_in: true, email_opt_out_at: null }],
      ['optedout@example.com', { email_opt_in: false, email_opt_out_at: '2026-08-01T00:00:00Z' }],
    ]),
  )
  assert.deepEqual(plan, {
    toSend: [' Consented@Example.com '],
    toSkip: ['optedout@example.com', 'nevershown@example.com'],
  })
})
