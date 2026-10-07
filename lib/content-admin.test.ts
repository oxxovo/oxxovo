import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROBE_BLOCK_MESSAGE,
  checkExternalUrl,
  dispatchClosedReason,
  isFailedExhausted,
  isProbeRef,
  kindsForFilter,
  matchesStatusFilter,
  needsAction,
  parseStatusFilter,
  releaseConfirmLines,
  remainingLabel,
  missingKeys,
} from './content-admin'
import {
  holdContent,
  markDistPosted,
  preflightRelease,
  releaseContent,
  requeueDist,
  returnContent,
  type AdminLike,
  type Actor,
} from './content-admin-actions'

const CID = '11111111-1111-4111-8111-111111111111'
const DID = '22222222-2222-4222-8222-222222222222'
const ACTOR: Actor = { id: '33333333-3333-4333-8333-333333333333', email: 'ops@oxxovo.ai' }

// Minimal fake of the supabase-js query builder + rpc, recording every rpc.
type Tables = Record<string, Record<string, unknown>[]>
function fake(tables: Tables, rpcError?: string) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const admin: AdminLike = {
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = []
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
        lt: (c: string, v: number) => (filters.push((r) => (r[c] as number) < v), q),
        maybeSingle: async () => ({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))[0] ?? null, error: null }),
        then: (res: (v: unknown) => unknown) =>
          res({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null }),
      }
      return q
    },
    async rpc(fn, args) {
      calls.push({ fn, args })
      return { data: {}, error: rpcError ? { message: rpcError } : null }
    },
  }
  return { admin, calls }
}

const content = (over: Record<string, unknown> = {}) => ({
  id: CID, title: 'T', kind: 'cf', source: 'production_os', source_ref: 'real-1', source_version: 1, ...over,
})

// ---- probe guard -----------------------------------------------------------
test('isProbeRef: prefix only, case-insensitive, non-strings are not probe', () => {
  assert.equal(isProbeRef('probe-rt-cl-20261006060004'), true)
  assert.equal(isProbeRef('  PROBE-x'), true)
  assert.equal(isProbeRef('my-probe-1'), false)
  assert.equal(isProbeRef(null), false)
})

test('[release] on a probe- row is refused and NO rpc is called', async () => {
  const { admin, calls } = fake({ contents: [content({ source_ref: 'probe-rt-cl-20261006060004' })] })
  const r = await releaseContent(admin, ACTOR, CID)
  assert.deepEqual(r, { ok: false, error: PROBE_BLOCK_MESSAGE })
  assert.equal(calls.length, 0)
})

test('[release] on a normal row calls content_release with the REAL admin as actor', async () => {
  const { admin, calls } = fake({ contents: [content()] })
  const r = await releaseContent(admin, ACTOR, CID)
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].fn, 'content_release')
  assert.equal(calls[0].args.p_actor_email, 'ops@oxxovo.ai')
  assert.equal(calls[0].args.p_actor_id, ACTOR.id)
})

test('[release] fails closed when the row cannot be looked up', async () => {
  const { admin, calls } = fake({ contents: [] })
  const r = await releaseContent(admin, ACTOR, CID)
  assert.equal(r.ok, false)
  assert.equal(calls.length, 0)
})

test('[requeue] on a distribution of a probe- row is refused (control: normal row passes)', async () => {
  const dist = { id: DID, content_id: CID, platform: 'youtube', status: 'failed' }
  const probe = fake({ contents: [content({ source_ref: 'probe-x' })], content_distributions: [dist] })
  const r1 = await requeueDist(probe.admin, ACTOR, DID)
  assert.deepEqual(r1, { ok: false, error: PROBE_BLOCK_MESSAGE })
  assert.equal(probe.calls.length, 0)

  const real = fake({ contents: [content()], content_distributions: [dist] })
  const r2 = await requeueDist(real.admin, ACTOR, DID)
  assert.equal(r2.ok, true)
  assert.equal(real.calls[0].fn, 'dist_requeue')
})

test('actor: empty email or non-uuid id is refused before any rpc', async () => {
  const { admin, calls } = fake({ contents: [content()] })
  assert.equal((await holdContent(admin, { id: ACTOR.id, email: '  ' }, CID)).ok, false)
  assert.equal((await holdContent(admin, { id: 'db:postgres', email: 'a@b.c' }, CID)).ok, false)
  assert.equal(calls.length, 0)
})

test('rpc error text is mapped to a readable Korean message, not echoed raw', async () => {
  const { admin } = fake({ contents: [content()] }, 'precondition_failed:no_main_asset')
  const r = await releaseContent(admin, ACTOR, CID)
  assert.deepEqual(r, { ok: false, error: '송출할 메인 영상 에셋이 없습니다' })
  const { admin: a2 } = fake({ contents: [content()] }, 'ERROR: duplicate key value violates constraint "x"')
  const r2 = await releaseContent(a2, ACTOR, CID)
  assert.equal(r2.ok, false)
  assert.ok(!(r2 as { error: string }).error.includes('duplicate key'))
})

test('[return] needs a reason (trimmed) and caps its length', async () => {
  const { admin, calls } = fake({})
  assert.equal((await returnContent(admin, ACTOR, CID, '   ')).ok, false)
  assert.equal((await returnContent(admin, ACTOR, CID, 'x'.repeat(2001))).ok, false)
  assert.equal(calls.length, 0)
  assert.equal((await returnContent(admin, ACTOR, CID, ' 자막 오류 ')).ok, true)
  assert.equal(calls[0].args.p_reason, '자막 오류')
})

test('[나갔음]: skipped_* needs a URL; platform domain enforced; unknown may omit', async () => {
  const skipped = fake({ content_distributions: [{ id: DID, content_id: CID, platform: 'youtube', status: 'skipped_oversize' }] })
  assert.equal((await markDistPosted(skipped.admin, ACTOR, DID, '')).ok, false)
  assert.equal((await markDistPosted(skipped.admin, ACTOR, DID, 'https://evil.example/watch?v=1')).ok, false)
  assert.equal(skipped.calls.length, 0)
  assert.equal((await markDistPosted(skipped.admin, ACTOR, DID, 'https://www.youtube.com/watch?v=abc')).ok, true)

  const unknown = fake({ content_distributions: [{ id: DID, content_id: CID, platform: 'x', status: 'unknown' }] })
  assert.equal((await markDistPosted(unknown.admin, ACTOR, DID, '')).ok, true)
  assert.equal(unknown.calls[0].args.p_external_url, null)
})

// ---- preflight -------------------------------------------------------------
test('preflight refuses a probe- row; for a real row says "queue", never "posts now"', async () => {
  const p = await preflightRelease(fake({ contents: [content({ source_ref: 'probe-a' })] }).admin, CID)
  assert.deepEqual(p, { ok: false, error: PROBE_BLOCK_MESSAGE })

  const r = await preflightRelease(
    fake({
      contents: [content()],
      content_distributions: [{ content_id: CID, platform: 'youtube', status: 'queued' }],
      platform_config: [{ key: 'social_dispatch_enabled', value: 'true' }],
    }).admin,
    CID,
  )
  assert.equal(r.ok, true)
  const text = (r as { lines: string[] }).lines.join('\n')
  assert.match(text, /송출 대기열에 넣습니다/)
  assert.match(text, /엔터 송출 스위치가 닫혀/) // entertainment_dispatch_enabled row missing => closed
  assert.doesNotMatch(text, /지금 올립니다/)
})

test('preflight shows the previous version that is already posted + oversize', async () => {
  const r = await preflightRelease(
    fake({
      contents: [content({ source_version: 2 }), { id: 'p1', source: 'production_os', source_ref: 'real-1', source_version: 1 }],
      content_distributions: [
        { content_id: CID, platform: 'youtube', status: 'queued' },
        { content_id: 'p1', platform: 'youtube', status: 'posted', external_url: 'https://youtu.be/a' },
      ],
      content_assets: [{ content_id: CID, role: 'main_16x9', bytes: 200 * 1024 * 1024 }],
      platform_config: [
        { key: 'social_dispatch_enabled', value: 'true' },
        { key: 'entertainment_dispatch_enabled', value: 'true' },
        { key: 'content_dispatch_max_bytes_default', value: String(100 * 1024 * 1024) },
      ],
    }).admin,
    CID,
  )
  const text = (r as { lines: string[] }).lines.join('\n')
  assert.match(text, /이전 버전이 이미 송출됐습니다 \(v1 youtube\)/)
  assert.match(text, /송출 상한\(100MB\)보다 큽니다/)
  assert.doesNotMatch(text, /스위치가 닫혀/)
})

// ---- pure ------------------------------------------------------------------
test('releaseConfirmLines: unreadable switches are reported as unreadable, not "closed"', () => {
  const t = releaseConfirmLines({ title: 'T', kind: 'cf', platforms: [], switches: null, previous: [], oversize: null }).join('\n')
  assert.match(t, /읽지 못했습니다/)
  assert.doesNotMatch(t, /닫혀 있어/)
  assert.match(t, /사이트 전용/)
})

test('dispatchClosedReason: master first, then the kind\'s DBA', () => {
  assert.match(dispatchClosedReason('news', { master: false, news: true, entertainment: true }) ?? '', /마스터/)
  assert.match(dispatchClosedReason('news', { master: true, news: false, entertainment: true }) ?? '', /데일리/)
  assert.equal(dispatchClosedReason('cf', { master: true, news: false, entertainment: true }), null)
})

test('needs-action: unknown / skipped / exhausted failed / late_for_slot; NOT retrying failed, NOT rights-waiting', () => {
  const sched = { status: 'scheduled', rights_status: 'cleared', held_reason: null }
  const d = (status: string, attempts = 0, next: string | null = null) => ({ status, attempts, next_attempt_at: next })
  assert.equal(needsAction(sched, [d('unknown')], 3), true)
  assert.equal(needsAction(sched, [d('skipped_no_asset')], 3), true)
  assert.equal(needsAction(sched, [d('failed', 3, '2026-01-01')], 3), true) // attempts >= max
  assert.equal(needsAction(sched, [d('failed', 1, null)], 3), true) // failed_terminal
  assert.equal(needsAction(sched, [d('failed', 1, '2026-01-01')], 3), false) // will retry by itself
  assert.equal(needsAction(sched, [d('failed', 0, '2026-01-01')], null), true) // max key missing = 0 retries
  assert.equal(needsAction({ status: 'held', rights_status: 'cleared', held_reason: 'late_for_slot' }, [], 3), true)
  const rights = { status: 'held', rights_status: 'restricted', held_reason: 'late_for_slot' }
  assert.equal(needsAction(rights, [d('unknown')], 3), false)
  assert.equal(matchesStatusFilter('rights', rights, [], 3), true)
  assert.equal(matchesStatusFilter('held', rights, [], 3), false)
  assert.equal(isFailedExhausted(d('queued'), 3), false)
})

test('filters: unknown values fall back to all; dba x kind intersection', () => {
  assert.equal(parseStatusFilter('nope'), 'all')
  assert.equal(kindsForFilter('all', 'all'), null)
  assert.deepEqual(kindsForFilter('news', 'all'), ['news'])
  assert.deepEqual(kindsForFilter('entertainment', 'cf'), ['cf'])
  assert.deepEqual(kindsForFilter('news', 'cf'), [])
})

test('checkExternalUrl: https + platform domain only', () => {
  assert.equal(checkExternalUrl('x', 'http://x.com/a', false).ok, false)
  assert.equal(checkExternalUrl('x', 'https://notx.com/a', false).ok, false)
  assert.equal(checkExternalUrl('x', 'https://x.com.evil.io/a', false).ok, false)
  assert.equal(checkExternalUrl('x', 'https://twitter.com/a/status/1', false).ok, true)
  assert.equal(checkExternalUrl('instagram', 'https://www.instagram.com/p/1', true).ok, true)
})

test('remainingLabel / missingKeys', () => {
  const now = new Date('2026-10-07T00:00:00Z')
  assert.equal(remainingLabel('2026-10-07T03:12:00Z', now), '3시간 12분 후')
  assert.equal(remainingLabel('2026-10-06T23:30:00Z', now), '30분 지남')
  assert.deepEqual(missingKeys(null, ['a']), ['a'])
  assert.deepEqual(missingKeys(new Map([['a', '1'], ['b', ' ']]), ['a', 'b', 'c']), ['b', 'c'])
})
