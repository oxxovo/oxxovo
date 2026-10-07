// Dispatch tick (design SS5-3). Every "must not send" case has a "does send"
// control built from the same fake, so a tick that never sends anything cannot
// pass them all. Time is a fake clock: nothing sleeps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DISPATCH_MAX_DURATION_SEC,
  SWEEP_MARGIN_SEC,
  runDispatchTick,
  type AlertableDist,
  type ClaimedDist,
  type DispatchAsset,
  type DispatchDeps,
  type MarkArgs,
} from './content-dispatch'
import { PostizConfigError, PostizHttpError, PostizMediaError } from './postiz'

const SHA = 'a'.repeat(64)
const OPEN = {
  social_dispatch_enabled: 'true',
  news_dispatch_enabled: 'true',
  entertainment_dispatch_enabled: 'true',
  content_dispatch_per_tick: '10',
  content_dispatch_max_bytes_default: '104857600',
}

const row = (n: number, over: Partial<ClaimedDist> = {}): ClaimedDist => ({
  dist_id: `d${n}`, content_id: `c${n}`, platform: 'youtube', account: null, attempts: 0,
  kind: 'cf', form: 'short', language: 'ko', title: `title ${n}`, caption: `caption ${n}`, ...over,
})
const asset = (role = 'main_16x9', over: Partial<DispatchAsset> = {}): DispatchAsset => ({
  role, url: `https://r2.example/${role}.mp4`, sha256: SHA, bytes: 1000, ...over,
})

type ContentStateRow = { status: string; rights_status: string; publish_at: string; kind: string }

type Harness = {
  deps: DispatchDeps
  log: string[]
  marks: MarkArgs[]
  published: { channels: string[]; caption: string; youtube?: { title: string; visibility: string } }[]
  prepared: { url: string; opts: { expectedSha256?: string; maxBytes?: number } }[]
  claimKinds: string[][]
  alertsSent: string[]
  alerted: string[][]
  daily: string[]
  clock: { t: number }
}

function harness(opts: {
  config?: Record<string, string> | ((call: number) => Record<string, string> | null)
  rows?: ClaimedDist[]
  assets?: (contentId: string) => DispatchAsset[]
  contentState?: (contentId: string) => ContentStateRow | null
  prepare?: (url: string) => Promise<{ id: string; path: string }>
  publish?: () => Promise<{ postIds: string[] }>
  alertable?: AlertableDist[]
  sendAlertOk?: boolean
  stepMs?: number
} = {}): Harness {
  const h: Harness = {
    deps: undefined as unknown as DispatchDeps, log: [], marks: [], published: [], prepared: [],
    claimKinds: [], alertsSent: [], alerted: [], daily: [], clock: { t: 0 },
  }
  let readCalls = 0
  const queue = [...(opts.rows ?? [])]
  h.deps = {
    nowMs: () => h.clock.t,
    // Like the real reader (adminConfigReader): ONLY the requested keys come back.
    // A fake that returned everything hid a missing key in the recheck read.
    async readConfig(keys) {
      readCalls++
      const c = typeof opts.config === 'function' ? opts.config(readCalls) : (opts.config ?? OPEN)
      return c === null ? null : new Map(Object.entries(c).filter(([k]) => keys.includes(k)))
    },
    async sweep(th) { h.log.push(`sweep:${th}`); return 0 },
    async listAlertable() { return opts.alertable ?? [] },
    async markAlerted(ids) { h.alerted.push(ids) },
    async listNotifiable() { return [] },
    async markNotified() {},
    async sendAlert(subject) { h.alertsSent.push(subject); return opts.sendAlertOk ?? true },
    async alertDaily(key) { h.daily.push(key); return true },
    async claimOne(kinds) { h.log.push('claim'); h.claimKinds.push(kinds); return queue.shift() ?? null },
    async loadAssets(id) { return opts.assets ? opts.assets(id) : [asset()] },
    async loadContentState(id) {
      return opts.contentState
        ? opts.contentState(id)
        : { status: 'scheduled', rights_status: 'cleared', publish_at: new Date(0).toISOString(), kind: 'cf' }
    },
    async mark(a) { h.log.push(`mark:${a.result}`); h.marks.push(a); h.clock.t += opts.stepMs ?? 0 },
    postiz: {
      async prepare(url, o) {
        h.prepared.push({ url, opts: o })
        return opts.prepare ? opts.prepare(url) : { id: 'm1', path: 'p' }
      },
      async publish(args) {
        h.published.push({ channels: args.channels, caption: args.caption, youtube: args.youtube })
        return opts.publish ? opts.publish() : { postIds: ['post-1'] }
      },
    },
  }
  return h
}

test('control: everything open -> one row is claimed, verified, published and marked sent', async () => {
  const h = harness({ rows: [row(1)] })
  const r = await runDispatchTick(h.deps)
  assert.equal(r.stage, 'ran')
  assert.deepEqual(h.published, [{ channels: ['youtube'], caption: 'caption 1', youtube: { title: 'title 1', visibility: 'private' } }])
  assert.equal(h.marks[0].result, 'sent')
  assert.equal(h.marks[0].externalId, 'post-1')
  assert.equal(h.marks[0].captionSent, 'caption 1') // the text actually sent is snapshotted
  assert.deepEqual(h.prepared[0].opts, { expectedSha256: SHA, maxBytes: 104857600 })
})

test('master switch closed: nothing is claimed or sent, but the sweep still runs', async () => {
  const h = harness({ config: { ...OPEN, social_dispatch_enabled: 'false' }, rows: [row(1)] })
  const r = await runDispatchTick(h.deps)
  assert.equal(r.stage, 'master_closed')
  assert.deepEqual(h.claimKinds, [])
  assert.equal(h.published.length, 0)
  assert.deepEqual(h.log, [`sweep:${DISPATCH_MAX_DURATION_SEC + SWEEP_MARGIN_SEC}`])
})

test('switch read failure = closed (null read, and a throwing read)', async () => {
  const readers: Array<() => Record<string, string> | null> = [
    () => null,
    () => { throw new Error('db down') },
  ]
  for (const config of readers) {
    const h = harness({ config, rows: [row(1)] })
    const r = await runDispatchTick(h.deps)
    assert.equal(r.stage, 'unreadable')
    assert.equal(h.claimKinds.length, 0)
    assert.equal(h.published.length, 0)
  }
})

test('only a literal "true" opens a switch', async () => {
  for (const v of ['TRUE', 'True', ' true', 'true ', '1', 'yes', '']) {
    const h = harness({ config: { ...OPEN, social_dispatch_enabled: v }, rows: [row(1)] })
    assert.equal((await runDispatchTick(h.deps)).stage, 'master_closed', JSON.stringify(v))
    assert.equal(h.published.length, 0)
  }
})

test('DBA switches are independent: news closed -> only entertainment kinds are claimed', async () => {
  const h = harness({ config: { ...OPEN, news_dispatch_enabled: 'false' }, rows: [] })
  await runDispatchTick(h.deps)
  assert.equal(h.claimKinds.length, 1)
  assert.ok(!h.claimKinds[0].includes('news'))
  assert.ok(h.claimKinds[0].includes('cf'))
  const h2 = harness({ config: { ...OPEN, entertainment_dispatch_enabled: 'false' }, rows: [] })
  await runDispatchTick(h2.deps)
  assert.deepEqual(h2.claimKinds[0], ['news'])
})

test('both DBAs closed -> no claim at all', async () => {
  const h = harness({ config: { ...OPEN, news_dispatch_enabled: 'false', entertainment_dispatch_enabled: 'false' } })
  assert.equal((await runDispatchTick(h.deps)).stage, 'no_open_dba')
  assert.equal(h.claimKinds.length, 0)
})

test('per_tick missing or invalid -> nothing is sent and a daily alert is raised (silent non-sending is the failure)', async () => {
  for (const bad of [undefined, '0', '-1', 'abc', '3.5']) {
    const cfg: Record<string, string> = { ...OPEN }
    if (bad === undefined) delete cfg.content_dispatch_per_tick
    else cfg.content_dispatch_per_tick = bad
    const h = harness({ config: cfg, rows: [row(1)] })
    const r = await runDispatchTick(h.deps)
    assert.equal(r.stage, 'config', String(bad))
    assert.equal(h.claimKinds.length, 0)
    assert.deepEqual(h.daily, ['content_dispatch_config'])
  }
})

test('memory ceiling key missing or invalid -> nothing is sent (no code default)', async () => {
  for (const bad of [undefined, '0', 'abc', '1e9']) {
    const cfg: Record<string, string> = { ...OPEN }
    if (bad === undefined) delete cfg.content_dispatch_max_bytes_default
    else cfg.content_dispatch_max_bytes_default = bad
    const h = harness({ config: cfg, rows: [row(1)] })
    const r = await runDispatchTick(h.deps)
    assert.equal(r.stage, 'config', String(bad))
    assert.equal(r.stopped, 'config:content_dispatch_max_bytes_default')
    assert.equal(h.claimKinds.length, 0)
  }
})

test('one row at a time: claim -> process -> claim, never a batch; stops at per_tick', async () => {
  const h = harness({ config: { ...OPEN, content_dispatch_per_tick: '2' }, rows: [row(1), row(2), row(3)] })
  const r = await runDispatchTick(h.deps)
  assert.equal(r.processed, 2)
  const seq = h.log.filter((l) => !l.startsWith('sweep:'))
  assert.deepEqual(seq, ['claim', 'mark:sent', 'claim', 'mark:sent'])
})

test('time budget: stops claiming when the remaining time is below one item budget', async () => {
  // default item budget 120s; tick budget = 300 - 30 = 270s. Each item takes 100s.
  const h = harness({ rows: [row(1), row(2), row(3), row(4)], stepMs: 100_000 })
  const r = await runDispatchTick(h.deps)
  assert.equal(r.processed, 2) // t=0: 270>=120 ok; t=100: 170>=120 ok; t=200: 70<120 stop
  assert.equal(r.stopped, 'time_budget')
  assert.equal(h.claimKinds.length, 2) // the third row was never claimed, so it stays queued
})

test('item budget is configurable (platform_config), not fixed', async () => {
  const h = harness({ config: { ...OPEN, content_dispatch_item_budget_seconds: '200' }, rows: [row(1), row(2)], stepMs: 100_000 })
  const r = await runDispatchTick(h.deps)
  assert.equal(r.processed, 1) // t=100: 170 < 200 stop
})

test('the route declares the same maxDuration the library computes from', () => {
  const src = readFileSync(new URL('../app/api/cron/content-dispatch/route.ts', import.meta.url), 'utf8')
  const m = src.match(/export const maxDuration = (\d+)/)
  assert.ok(m, 'route must declare maxDuration as a literal')
  assert.equal(Number(m![1]), DISPATCH_MAX_DURATION_SEC)
})

test('recheck: switch closed AFTER prepare, BEFORE publish -> not sent, stopped_by_switch, tick stops', async () => {
  // read #1 = tick start (open), read #2 = the recheck (closed)
  const h = harness({
    config: (n) => (n === 1 ? OPEN : { ...OPEN, social_dispatch_enabled: 'false' }),
    rows: [row(1), row(2)],
  })
  const r = await runDispatchTick(h.deps)
  assert.equal(h.published.length, 0)
  assert.equal(h.marks[0].result, 'stopped_by_switch')
  assert.equal(r.stopped, 'switch_closed_at_recheck')
  assert.equal(h.claimKinds.length, 1) // row 2 is not even claimed
})

test('recheck: only that DBA closed -> stopped, even though master is open', async () => {
  const h = harness({
    config: (n) => (n === 1 ? OPEN : { ...OPEN, entertainment_dispatch_enabled: 'false' }),
    rows: [row(1)],
  })
  await runDispatchTick(h.deps)
  assert.equal(h.published.length, 0)
  assert.equal(h.marks[0].result, 'stopped_by_switch')
})

test('recheck: rights lowered / status changed / publish_at pushed out after the claim -> not sent', async () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const past = new Date(0).toISOString()
  const cases: ContentStateRow[] = [
    { status: 'scheduled', rights_status: 'restricted', publish_at: past, kind: 'cf' },
    { status: 'hidden', rights_status: 'cleared', publish_at: past, kind: 'cf' },
    { status: 'scheduled', rights_status: 'cleared', publish_at: future, kind: 'cf' },
  ]
  for (const cs of cases) {
    const h = harness({ rows: [row(1)], contentState: () => cs })
    h.clock.t = Date.now() // so a future publish_at is really in the future
    await runDispatchTick(h.deps)
    assert.equal(h.published.length, 0, JSON.stringify(cs))
    assert.equal(h.marks[0].result, 'stopped_by_switch')
  }
  // control: the same row with an unchanged state does go out
  const ok = harness({ rows: [row(1)] })
  await runDispatchTick(ok.deps)
  assert.equal(ok.published.length, 1)
})

test('recheck: content row unreadable or missing -> not sent', async () => {
  const h = harness({ rows: [row(1)], contentState: () => null })
  await runDispatchTick(h.deps)
  assert.equal(h.published.length, 0)
  assert.equal(h.marks[0].result, 'stopped_by_switch')
})

test('a row that comes back twice in one tick stops the tick (requeue loop guard)', async () => {
  const h2 = harness({
    rows: [row(1), row(1)],
    contentState: () => ({ status: 'hidden', rights_status: 'cleared', publish_at: new Date(0).toISOString(), kind: 'cf' }),
  })
  const r2 = await runDispatchTick(h2.deps)
  assert.equal(r2.stopped, 'row_reclaimed_in_same_tick')
  assert.equal(h2.published.length, 0)
})

test('hash mismatch: failed_terminal, nothing published (a changed file never reaches the outside)', async () => {
  const h = harness({
    rows: [row(1)],
    prepare: async () => { throw new PostizMediaError('hash_mismatch', 'x') },
  })
  await runDispatchTick(h.deps)
  assert.equal(h.published.length, 0)
  assert.equal(h.marks[0].result, 'failed_terminal')
  assert.equal(h.marks[0].error, 'hash_mismatch')
})

test('asset bigger than the dispatch memory ceiling: failed_terminal without downloading', async () => {
  const h = harness({
    config: { ...OPEN, content_dispatch_max_bytes_default: '1000' },
    rows: [row(1)],
    assets: () => [asset('main_16x9', { bytes: 1001 })],
  })
  await runDispatchTick(h.deps)
  assert.equal(h.prepared.length, 0)
  assert.equal(h.marks[0].result, 'failed_terminal')
  assert.match(h.marks[0].error ?? '', /^oversize_for_dispatch/)
  // control: at the ceiling it goes through
  const ok = harness({
    config: { ...OPEN, content_dispatch_max_bytes_default: '1000' },
    rows: [row(1)],
    assets: () => [asset('main_16x9', { bytes: 1000 })],
  })
  await runDispatchTick(ok.deps)
  assert.equal(ok.published.length, 1)
})

test('asset problems are failed_terminal: no asset for the platform, missing url or sha256', async () => {
  for (const assets of [[asset('main_9x16')], [asset('main_16x9', { url: null })], [asset('main_16x9', { sha256: null })]]) {
    const h = harness({ rows: [row(1)], assets: () => assets })
    await runDispatchTick(h.deps)
    assert.equal(h.published.length, 0)
    assert.equal(h.marks[0].result, 'failed_terminal')
  }
})

test('the same role function as import: x falls back to main_9x16, youtube does not', async () => {
  const x = harness({ rows: [row(1, { platform: 'x' })], assets: () => [asset('main_9x16')] })
  await runDispatchTick(x.deps)
  assert.equal(x.prepared[0].url, 'https://r2.example/main_9x16.mp4')
  assert.equal(x.marks[0].result, 'sent')
  const yt = harness({ rows: [row(1, { platform: 'youtube' })], assets: () => [asset('main_9x16')] })
  await runDispatchTick(yt.deps)
  assert.equal(yt.prepared.length, 0)
})

test('a failure BEFORE posting is failed (retryable), never unknown', async () => {
  const h = harness({ rows: [row(1)], prepare: async () => { throw new TypeError('fetch failed') } })
  await runDispatchTick(h.deps)
  assert.equal(h.marks[0].result, 'failed')
  assert.equal(h.published.length, 0)
})

test('publish outcomes: 4xx = failed, 5xx = unknown, timeout/network = unknown, 2xx without id = unknown, missing channel id = failed', async () => {
  const cases: [string, () => Promise<{ postIds: string[] }>, string][] = [
    ['4xx', async () => { throw new PostizHttpError(400, 'bad') }, 'failed'],
    ['5xx', async () => { throw new PostizHttpError(502, 'bad gateway') }, 'unknown'],
    ['timeout', async () => { throw new DOMException('timed out', 'TimeoutError') }, 'unknown'],
    ['network', async () => { throw new TypeError('fetch failed') }, 'unknown'],
    ['empty', async () => ({ postIds: [] }), 'unknown'],
    ['unidentified', async () => ({ postIds: ['unknown'] }), 'unknown'],
    ['config', async () => { throw new PostizConfigError('channel id missing') }, 'failed'],
    ['ok', async () => ({ postIds: ['p9'] }), 'sent'],
  ]
  for (const [name, publish, want] of cases) {
    const h = harness({ rows: [row(1)], publish })
    await runDispatchTick(h.deps)
    assert.equal(h.marks[0].result, want, name)
  }
})

test('failed carries the http status and the backoff base; other results do not', async () => {
  const h = harness({
    config: { ...OPEN, content_dispatch_backoff_base_minutes: '5', content_dispatch_max_attempts: '3' },
    rows: [row(1)],
    publish: async () => { throw new PostizHttpError(429, 'slow down') },
  })
  await runDispatchTick(h.deps)
  assert.equal(h.marks[0].httpStatus, 429)
  assert.equal(h.marks[0].backoffBaseMinutes, 5)
  const s = harness({ config: { ...OPEN, content_dispatch_backoff_base_minutes: '5' }, rows: [row(1)] })
  await runDispatchTick(s.deps)
  assert.equal(s.marks[0].backoffBaseMinutes, null)
})

test('caption: the row caption when present, otherwise the title', async () => {
  const h = harness({ rows: [row(1, { caption: '  ' })] })
  await runDispatchTick(h.deps)
  assert.equal(h.published[0].caption, 'title 1')
  assert.equal(h.marks[0].captionSent, 'title 1')
})

test('mark failure stops the tick and is reported (the row is left for the sweep, not retried blindly)', async () => {
  const h = harness({ rows: [row(1), row(2)] })
  h.deps.mark = async () => { throw new Error('rpc down') }
  const r = await runDispatchTick(h.deps)
  assert.equal(r.rows[0].outcome, 'mark_failed')
  assert.equal(r.stopped, 'mark_failed')
  assert.equal(h.claimKinds.length, 1)
})

test('alerts: alerted_at only after the mail was accepted (and they go out with switches closed)', async () => {
  const pending: AlertableDist[] = [
    { id: 'x1', platform: 'youtube', status: 'unknown', last_error: 'swept', attempts: 0, title: 'T <b>', source_ref: 'r1' },
  ]
  const ok = harness({ config: { ...OPEN, social_dispatch_enabled: 'false' }, alertable: pending })
  const r = await runDispatchTick(ok.deps)
  assert.equal(r.alerted, 1)
  assert.deepEqual(ok.alerted, [['x1']])
  const bad = harness({ alertable: pending, sendAlertOk: false })
  const r2 = await runDispatchTick(bad.deps)
  assert.equal(r2.alerted, 0)
  assert.deepEqual(bad.alerted, []) // not recorded -> retried next tick
  assert.ok(r2.warnings.includes('alert_not_sent'))
})

test('sweep threshold is computed from maxDuration, above it', async () => {
  const h = harness({ config: { ...OPEN, social_dispatch_enabled: 'false' } })
  await runDispatchTick(h.deps)
  const th = Number(h.log[0].split(':')[1])
  assert.ok(th > DISPATCH_MAX_DURATION_SEC)
})

test('import notices: sent from the tick with switches CLOSED, marked after the mail; probe- never; a failing list does not break the tick', async () => {
  const content = (n: number, ref = `ref-${n}`) => ({
    id: `c${n}`, title: `t${n}`, kind: 'cf', source_ref: ref, source_version: 1, status: 'held',
    rights_status: 'cleared', held_reason: 'late_for_slot', rights_reason: null, publish_at: '2026-10-08T07:00:00Z',
  })
  const closed = { ...OPEN, social_dispatch_enabled: 'false' }

  const h = harness({ config: closed })
  const marked: string[][] = []
  h.deps.listNotifiable = async () => [content(1), content(2, 'probe-rt-1')]
  h.deps.markNotified = async (ids) => { marked.push(ids) }
  const r = await runDispatchTick(h.deps)
  assert.equal(r.stage, 'master_closed') // the tick still stops at the switches...
  assert.equal(r.notified, 1) // ...but the notice went out first
  assert.deepEqual(marked, [['c1']]) // probe- row not marked
  assert.equal(h.alertsSent.length, 1)

  const bad = harness({ config: closed, sendAlertOk: false })
  const marked2: string[][] = []
  bad.deps.listNotifiable = async () => [content(1)]
  bad.deps.markNotified = async (ids) => { marked2.push(ids) }
  const r2 = await runDispatchTick(bad.deps)
  assert.equal(r2.notified, 0)
  assert.deepEqual(marked2, []) // mail not accepted -> retried next tick
  assert.ok(r2.warnings.includes('notice_not_sent:held'))

  const boom = harness({ config: closed })
  boom.deps.listNotifiable = async () => { throw new Error('db down') }
  const r3 = await runDispatchTick(boom.deps)
  assert.equal(r3.stage, 'master_closed')
  assert.ok(r3.warnings.some((w) => w.startsWith('notify_list_failed')))
})

// ---- YouTube title + visibility (content dispatch only; HQ 2026-10-07) ----------

test('youtube visibility: missing / empty / unknown values are PRIVATE; only the three words pass (control: public passes)', async () => {
  const visibilityFor = async (value: string | undefined) => {
    const cfg: Record<string, string> = { ...OPEN }
    if (value !== undefined) cfg.content_youtube_visibility = value
    const h = harness({ config: cfg, rows: [row(1)] })
    await runDispatchTick(h.deps)
    assert.equal(h.published.length, 1)
    return h.published[0].youtube?.visibility
  }
  assert.equal(await visibilityFor(undefined), 'private')
  for (const bad of ['', ' ', 'yes', 'true', 'PUBLIC!', 'publik', '1', 'private,public']) {
    assert.equal(await visibilityFor(bad), 'private', JSON.stringify(bad))
  }
  assert.equal(await visibilityFor('public'), 'public')
  assert.equal(await visibilityFor(' Unlisted '), 'unlisted')
  assert.equal(await visibilityFor('private'), 'private')
})

test('youtube visibility is read FRESH at the recheck, not from the tick start (both directions)', async () => {
  // tick start says public, the recheck (right before POST) no longer does -> private
  const a = harness({
    rows: [row(1)],
    config: (call) => (call === 1 ? { ...OPEN, content_youtube_visibility: 'public' } : { ...OPEN }),
  })
  await runDispatchTick(a.deps)
  assert.equal(a.published[0].youtube?.visibility, 'private')
  // control: tick start has nothing, the recheck says public -> public (so the recheck value is what is used)
  const b = harness({
    rows: [row(1)],
    config: (call) => (call === 1 ? { ...OPEN } : { ...OPEN, content_youtube_visibility: 'public' }),
  })
  await runDispatchTick(b.deps)
  assert.equal(b.published[0].youtube?.visibility, 'public')
})

test('only youtube rows carry youtube settings (control: the youtube row does)', async () => {
  const h = harness({ rows: [row(1, { platform: 'instagram' }), row(2)], assets: () => [asset('main_16x9'), asset('main_9x16')] })
  await runDispatchTick(h.deps)
  assert.equal(h.published.length, 2)
  assert.equal(h.published[0].channels[0], 'instagram')
  assert.equal(h.published[0].youtube, undefined)
  assert.equal(h.published[1].channels[0], 'youtube')
  assert.deepEqual(h.published[1].youtube, { title: 'title 2', visibility: 'private' })
})

test('unusable youtube title: failed_terminal BEFORE any download or post (control: a usable title posts)', async () => {
  for (const title of ['a', '<>', '   ', '\n\t']) {
    const h = harness({ rows: [row(1, { title })] })
    const r = await runDispatchTick(h.deps)
    assert.equal(h.marks[0].result, 'failed_terminal', JSON.stringify(title))
    assert.equal(h.marks[0].error, 'youtube_title_invalid')
    assert.equal(h.prepared.length, 0, 'nothing was downloaded or uploaded')
    assert.equal(h.published.length, 0)
    assert.equal(r.rows[0].outcome, 'failed_terminal')
  }
  const ok = harness({ rows: [row(1, { title: '[시험] 2026-10-07 test' })] })
  await runDispatchTick(ok.deps)
  assert.equal(ok.marks[0].result, 'sent')
  assert.equal(ok.published[0].youtube?.title, '[시험] 2026-10-07 test')
})

test('an unusable title only matters for youtube (control: an instagram row with the same title posts)', async () => {
  const h = harness({ rows: [row(1, { platform: 'instagram', title: 'a' })], assets: () => [asset('main_9x16')] })
  await runDispatchTick(h.deps)
  assert.equal(h.marks[0].result, 'sent')
})
