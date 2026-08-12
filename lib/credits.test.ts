// The pricing guard. Pure arithmetic, so every case is assertable without a
// database.
//
// The rule under test: a generation is never priced at 0. Not because 0 is a
// generous price -- because every caller decides "may this account spend?" with
// `balance < credits`, and `balance < 0` is false for EVERY account including a
// brand new one with nothing in it. A zero does not discount the charge, it
// deletes the check. Both ways of reaching one are real: model_catalog
// .cost_per_second_usd is NOT NULL DEFAULT 0, and a platform_config price key
// that does not exist reads as 0 (studio_music_gen_cost_usd, measured absent on
// 2026-08-01).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creditsForCost, creditsForCostOrNull, creditsForUsd, type StudioPricing } from './credits'

// Live values, 2026-08-01: studio_margin_rate 0.25, studio_credit_usd_value 0.10.
const LIVE: StudioPricing = { marginRate: 0.25, creditUsdValue: 0.1 }

test('prices a normal generation, rounding up', () => {
  // veo31-lite-draft at 0.03/s x 8s = 0.24 -> x1.25 = 0.30 -> 3 credits.
  assert.equal(creditsForCost(0.03 * 8, LIVE), 3)
  // kling-v3-turbo at 0.112/s x 5s = 0.56 -> x1.25 = 0.70 -> 7 credits.
  assert.equal(creditsForCost(0.112 * 5, LIVE), 7)
  // Never rounds a fraction down to free: 0.001 -> 0.00125 -> 1 credit.
  assert.equal(creditsForCost(0.001, LIVE), 1)
})

test('throws on an unpriced model row (cost 0 -- the column default)', () => {
  assert.throws(() => creditsForCost(0, LIVE), /non-positive charge/)
})

test('throws on a missing platform_config price (reads as 0, or as NaN)', () => {
  assert.throws(() => creditsForCost(Number(undefined), LIVE), /non-positive charge/)
  assert.throws(() => creditsForCost(Number(''), LIVE), /non-positive charge/) // Number('') === 0
})

test('throws on a negative cost', () => {
  assert.throws(() => creditsForCost(-1, LIVE), /non-positive charge/)
})

test('throws on unusable pricing config rather than pricing at 0', () => {
  // credit value 0 -> Infinity; margin -1 -> 0; both are misconfiguration.
  assert.throws(() => creditsForCost(0.24, { marginRate: 0.25, creditUsdValue: 0 }), /non-positive charge/)
  assert.throws(() => creditsForCost(0.24, { marginRate: -1, creditUsdValue: 0.1 }), /non-positive charge/)
  assert.throws(() => creditsForCost(0.24, { marginRate: NaN, creditUsdValue: 0.1 }), /non-positive charge/)
})

test('the error names the three inputs, so the fix is obvious from the log', () => {
  try {
    creditsForCost(0, LIVE)
    assert.fail('expected a throw')
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    assert.match(m, /cost_usd=0/)
    assert.match(m, /margin_rate=0\.25/)
    assert.match(m, /credit_usd_value=0\.1/)
  }
})

test('creditsForCostOrNull: same number when priced, null when not', () => {
  assert.equal(creditsForCostOrNull(0.03 * 8, LIVE), 3)
  assert.equal(creditsForCostOrNull(0, LIVE), null)
  assert.equal(creditsForCostOrNull(-1, LIVE), null)
  assert.equal(creditsForCostOrNull(0.24, { marginRate: 0.25, creditUsdValue: 0 }), null)
})

test('creditsForCostOrNull never returns 0 -- the value that would skip the check', () => {
  const costs = [0, -0, -1, 0.001, 1e-12, NaN, Infinity, -Infinity]
  for (const c of costs) {
    const got = creditsForCostOrNull(c, LIVE)
    assert.ok(got === null || got >= 1, `cost ${c} produced ${got}`)
  }
})

// A purchase is the opposite direction and 0 is legitimate there (too small an
// amount buys nothing) -- guarded by Stripe's minimum, not by this function.
// Pinned so the guard above is never "helpfully" copied onto it.
test('creditsForUsd is unguarded on purpose', () => {
  assert.equal(creditsForUsd(10, 0.1), 100)
  assert.equal(creditsForUsd(0, 0.1), 0)
})
