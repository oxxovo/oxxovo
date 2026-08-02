// The dedupe rule for the pricing alert. Pure: the signature IS the decision to
// send or not send, so it can be asserted without a database or a mailbox.
//
// Why this is the part worth testing. Every other alert in season-tick fires on
// something that happened during that tick, so it is naturally once. A broken
// price is a standing state: the tick runs hourly, and an alert that repeats
// every hour gets filtered, and a filtered alert is worse than no alert because
// it looks like coverage. The signature is what keeps it to one.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pricingSignature,
  summarizeProblems,
  pricingAlertHtml,
  PRICING_ALERT_STATE_KEY,
  type PricingProblem,
} from './pricing-health'

const model = (id: string, reachable = true): PricingProblem => ({
  kind: 'model_unpriced',
  id,
  detail: 'cost_per_second_usd=0',
  reachable,
})

test('healthy is a signature too -- and it is what an absent state row means', () => {
  // reportPricingHealth defaults previousSignature to 'ok' when the row is
  // missing, so a first run on a healthy platform must compare equal and stay
  // silent. If this string ever changes, that silence breaks.
  assert.equal(pricingSignature([]), 'ok')
})

test('same problems in any order = same signature = no repeat alert', () => {
  const a = pricingSignature([model('kling-v3-pro'), model('veo31-lite')])
  const b = pricingSignature([model('veo31-lite'), model('kling-v3-pro')])
  assert.equal(a, b)
})

test('the signature ignores wording, so a reworded detail does not re-alert', () => {
  const before = pricingSignature([model('ltx2-fast')])
  const after = pricingSignature([
    { kind: 'model_unpriced', id: 'ltx2-fast', detail: 'a completely different sentence', reachable: false },
  ])
  assert.equal(before, after)
})

test('a NEW problem changes the signature, so it does alert', () => {
  const before = pricingSignature([model('ltx2-fast')])
  const after = pricingSignature([model('ltx2-fast'), model('veo31-lite')])
  assert.notEqual(before, after)
})

test('a problem going away changes the signature -- recovery is an alert', () => {
  const before = pricingSignature([model('ltx2-fast')])
  assert.notEqual(before, pricingSignature([]))
})

test('kind is part of the identity: same id, different failure, still alerts', () => {
  const a = pricingSignature([{ kind: 'model_unpriced', id: 'x', detail: '', reachable: true }])
  const b = pricingSignature([{ kind: 'music_unpriced', id: 'x', detail: '', reachable: true }])
  assert.notEqual(a, b)
})

test('summary counts what a participant can actually hit', () => {
  assert.equal(summarizeProblems([]), 'healthy')
  const s = summarizeProblems([model('a', true), model('b', false), model('c', true)])
  assert.match(s, /3 problem/)
  assert.match(s, /2 reachable/)
})

test('the alert body names every problem, and marks the reachable ones', () => {
  const html = pricingAlertHtml({
    problems: [model('kling-v3-pro', true), model('parked-model', false)],
    signature: 'x',
    previousSignature: 'ok',
    changed: true,
    recovered: false,
  })
  assert.match(html, /kling-v3-pro/)
  assert.match(html, /parked-model/)
  assert.match(html, /participant-facing now/)
  // One marker only -- the inactive row must not be dressed up as urgent.
  assert.equal(html.split('participant-facing now').length - 1, 1)
})

test('the recovery body says what it recovered FROM', () => {
  const html = pricingAlertHtml({
    problems: [],
    signature: 'ok',
    previousSignature: 'model_unpriced:kling-v3-pro',
    changed: true,
    recovered: true,
  })
  assert.match(html, /healthy again/)
  assert.match(html, /kling-v3-pro/)
})

test('the state key is namespaced so nobody reads it as a setting', () => {
  // platform_config is otherwise entirely operator knobs; this row is written BY
  // the cron. The prefix is the only thing separating them.
  assert.ok(PRICING_ALERT_STATE_KEY.startsWith('alert_state_'), PRICING_ALERT_STATE_KEY)
})
