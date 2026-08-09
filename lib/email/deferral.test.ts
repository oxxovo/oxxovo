// The two "not now" rules. Both exist because the alternative was silence:
// a tick killed by maxDuration reported the same shape as a complete one, and a
// 429 was written as a failure, which starts a backoff that gives up on a
// participant after five attempts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isRateLimitError,
  makeTickBudget,
  budgetAllows,
  budgetRecord,
  TICK_BUDGET_MS,
  TICK_BUDGET_SEED_MS,
} from './deferral'

// ── isRateLimitError ────────────────────────────────────────────────────────

test('★a rate limit is recognised however it arrives', () => {
  // The SDK's typed error.
  assert.equal(isRateLimitError({ name: 'rate_limit_exceeded', message: 'Too many requests' }), true)
  // A transport-level failure that only carries a status.
  assert.equal(isRateLimitError({ statusCode: 429 }), true)
  // Something in between that only gives prose.
  assert.equal(isRateLimitError({ message: 'Rate limit exceeded, retry shortly' }), true)
  assert.equal(isRateLimitError({ message: '429 Too Many Requests' }), true)
  assert.equal(isRateLimitError({ message: 'ratelimit reached' }), true)
})

test('★a real rejection is NOT a rate limit -- it must keep the backoff', () => {
  // These are the errors the backoff exists for. Misclassifying one as a
  // deferral would retry a permanently bad address every 15 minutes forever.
  for (const e of [
    { name: 'validation_error', message: 'Invalid `to` field.' },
    { name: 'missing_required_field', message: 'Missing `to` field.' },
    { statusCode: 422, message: 'Invalid email address' },
    { statusCode: 403, message: 'Domain is not verified' },
    { message: 'The recipient mailbox is full' },
    {},
  ]) {
    assert.equal(isRateLimitError(e), false, JSON.stringify(e))
  }
})

// ── the tick budget ─────────────────────────────────────────────────────────

test('a fresh budget starts pessimistic, not empty', () => {
  const b = makeTickBudget(1_000_000)
  assert.equal(b.deadlineMs, 1_000_000 + TICK_BUDGET_MS)
  assert.equal(b.avgMs, TICK_BUDGET_SEED_MS)
  assert.equal(b.attempts, 0)
  // ★240s, not 300s. The 60s difference is the reserve that absorbs the 3.9s
  // outlier measured against Resend, which is why budgetAllows only has to fit
  // one AVERAGE send.
  assert.equal(TICK_BUDGET_MS, 240_000)
  assert.ok(TICK_BUDGET_MS < 300_000)
})

test('★the budget stops BEFORE the last send, not after it', () => {
  const start = 1_000_000
  const b = makeTickBudget(start)
  const deadline = start + TICK_BUDGET_MS

  // Comfortably inside.
  assert.equal(budgetAllows(b, start), true)
  // Exactly one average send left: allowed, because it fits.
  assert.equal(budgetAllows(b, deadline - TICK_BUDGET_SEED_MS), true)
  // One millisecond less than one send: refused. This is the whole point --
  // starting a send that cannot finish inside the reserve is how the tick used
  // to die mid-loop with nothing reported.
  assert.equal(budgetAllows(b, deadline - TICK_BUDGET_SEED_MS + 1), false)
  assert.equal(budgetAllows(b, deadline), false)
  assert.equal(budgetAllows(b, deadline + 60_000), false)
})

test('the average follows what was actually measured', () => {
  const b = makeTickBudget(0)
  budgetRecord(b, 300)
  assert.equal(b.attempts, 1)
  assert.equal(b.avgMs, 300, 'one sample replaces the seed outright')
  budgetRecord(b, 500)
  assert.equal(b.avgMs, 400)
  budgetRecord(b, 400)
  assert.equal(b.avgMs, 400)
})

test('★one 3.9s spike does not shut the batch down', () => {
  // The slowest single Resend call measured on 2026-08-08. A reactive average
  // (EMA) would jump to it and start deferring; a running mean absorbs it, and
  // the 60s reserve is what actually covers the tail.
  const b = makeTickBudget(0)
  for (let i = 0; i < 40; i++) budgetRecord(b, 400)
  const before = b.avgMs
  budgetRecord(b, 3_900)
  assert.ok(b.avgMs < 500, `one spike moved the mean from ${before} to ${b.avgMs}`)
  // And there is still room to keep going at that average.
  assert.equal(budgetAllows(b, 100_000), true)
})

test('★450 sends at the measured cost: the budget is what stops the tick, and it says so', () => {
  // The 11/8 12:00 finalist tick, simulated at the slow end of what was
  // measured (0.7s per send). This is the case the budget exists for: at this
  // cost the batch does NOT fit, and the point is that it stops deliberately
  // with a count rather than being killed at 300s with none.
  const start = 0
  const b = makeTickBudget(start)
  const PER_SEND = 700
  let clock = start
  let sent = 0
  let deferred = 0
  for (let i = 0; i < 450; i++) {
    if (!budgetAllows(b, clock)) {
      deferred = 450 - i
      break
    }
    clock += PER_SEND
    budgetRecord(b, PER_SEND)
    sent++
  }
  assert.equal(sent + deferred, 450, 'every recipient is accounted for -- none is dropped')
  assert.ok(deferred > 0, 'at 0.7s per send 450 does not fit in 240s')
  assert.ok(clock <= start + TICK_BUDGET_MS, 'and it stopped inside the budget')
  // 240s / 0.7s = 342 sends, so roughly a third waits for the next tick.
  assert.equal(sent, 342)
  assert.equal(deferred, 108)

  // At the optimistic cost (Vercel sits next to the DB) the whole batch fits,
  // which is the other half of the claim: the budget only bites when it should.
  const fast = makeTickBudget(0)
  let fc = 0
  let fsent = 0
  for (let i = 0; i < 450; i++) {
    if (!budgetAllows(fast, fc)) break
    fc += 400
    budgetRecord(fast, 400)
    fsent++
  }
  assert.equal(fsent, 450, 'at 0.4s per send all 450 go out in one tick')
})
