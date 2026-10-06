// Promo guard order (design SS5-6, HQ 2026-10-06): the master switch is read
// FIRST, before the approval gate and before any row is touched, so a
// switch-off probe returns 503 for ANY id and can never post.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { publishPromoVideo, type PromoPublishDeps } from './promo-publish'

function deps(config: Record<string, string> | null | 'throw'): { d: PromoPublishDeps; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    d: {
      readConfig: async () => {
        calls.push('read')
        if (config === 'throw') throw new Error('db down')
        return config === null ? null : new Map(Object.entries(config))
      },
      prepare: async () => {
        calls.push('prepare')
        return { id: 'm', path: 'p' }
      },
      publish: async () => {
        calls.push('publish')
        return { postIds: ['x'], channels: ['youtube'] }
      },
    },
  }
}

test('master switch false -> dispatch_disabled for any id, nothing prepared or published', async () => {
  const { d, calls } = deps({ social_dispatch_enabled: 'false' })
  assert.deepEqual(await publishPromoVideo('00000000-0000-0000-0000-000000000000', 'manual', d), {
    ok: false,
    error: 'dispatch_disabled',
  })
  assert.deepEqual(calls, ['read'])
})

test('switch row missing, other value, unreadable or throwing -> closed (never open)', async () => {
  for (const c of [{}, { social_dispatch_enabled: 'TRUE' }, { social_dispatch_enabled: '' }]) {
    const { d, calls } = deps(c)
    assert.equal((await publishPromoVideo('x', 'cron', d)).ok, false)
    assert.deepEqual(calls, ['read'])
  }
  for (const c of [null, 'throw'] as const) {
    const { d, calls } = deps(c)
    assert.deepEqual(await publishPromoVideo('x', 'cron', d), { ok: false, error: 'dispatch_unreadable' })
    assert.deepEqual(calls, ['read'])
  }
})

test('source order: guard 1 precedes the promo_videos read; guard 2 sits between prepare and publish', () => {
  const src = readFileSync(new URL('./promo-publish.ts', import.meta.url), 'utf8')
  const first = src.indexOf('readMasterSwitch(deps.readConfig)')
  assert.ok(first > 0)
  assert.ok(first < src.indexOf(".from('promo_videos')"))
  const prep = src.indexOf('deps.prepare(')
  const second = src.indexOf('readMasterSwitch(deps.readConfig)', prep)
  const pub = src.indexOf('deps.publish(')
  assert.ok(prep > 0 && second > prep && pub > second, 'second guard must sit between prepare and publish')
})
