// Control test (HQ 2026-08-15): prove the "test mode" tag on the Buy Credits
// card actually reads the live key, in both directions, rather than having
// simply been deleted. "It doesn't show anymore" is not proof the wiring
// works -- it is equally consistent with the wiring having been ripped out.
// Local process.env only; production/preview Vercel env is never touched
// here.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTestMode } from './stripe'

test('isTestMode flips with the actual STRIPE_SECRET_KEY prefix, not a fixed label', () => {
  const saved = process.env.STRIPE_SECRET_KEY
  try {
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_probe_only'
    assert.equal(isTestMode(), true, 'a sk_test_ key must report test mode')

    process.env.STRIPE_SECRET_KEY = 'sk_live_local_probe_only'
    assert.equal(isTestMode(), false, 'a sk_live_ key must NOT report test mode')
  } finally {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = saved
  }
})
