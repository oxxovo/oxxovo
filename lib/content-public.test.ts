// Public judgement (design SS7-2). The fake client below APPLIES the filters it
// is given and projects only the selected columns, so these tests prove the
// SQL-level filtering and the projection, not just the JS around them.
// Every "must be hidden" row has a "visible" control next to it: a judgement
// that returned null for everything would otherwise pass every hidden case.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PUBLIC_ASSET_COLUMNS,
  PUBLIC_CONTENT_COLUMNS,
  decidePublicationSwitch,
  getOpenPublicationDbas,
  getPublicContent,
  isPublicRow,
  listPublicContents,
  resolvePublicAddress,
  toPublicAssets,
} from './content-public'

type Row = Record<string, unknown>
type Admin = Parameters<typeof getOpenPublicationDbas>[0]

type Call = { table: string; select: string; filters: string[] }

function fakeAdmin(
  tables: Record<string, Row[]>,
  opts: { ignoreFilters?: boolean; errorOn?: string; throwOn?: string } = {},
): { admin: Admin; calls: Call[] } {
  const calls: Call[] = []
  const admin = {
    from(table: string) {
      if (opts.throwOn === table) throw new Error('boom')
      let rows = [...(tables[table] ?? [])]
      const rec: Call = { table, select: '', filters: [] }
      calls.push(rec)
      const finish = () => {
        const cols = rec.select.split(',').map((c) => c.trim()).filter(Boolean)
        return rows.map((r) => (cols.length ? Object.fromEntries(cols.map((c) => [c, r[c]])) : r))
      }
      const result = (data: unknown) => (opts.errorOn === table ? { data: null, error: { message: 'x' } } : { data, error: null })
      const q = {
        select(c: string) { rec.select = c; return q },
        eq(k: string, v: unknown) { rec.filters.push(`eq:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => r[k] === v); return q },
        lte(k: string, v: string) { rec.filters.push(`lte:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => Date.parse(String(r[k])) <= Date.parse(v)); return q },
        in(k: string, vals: unknown[]) { rec.filters.push(`in:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => vals.includes(r[k])); return q },
        not(k: string) { rec.filters.push(`not:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => r[k] !== null && r[k] !== undefined); return q },
        order(k: string, o: { ascending: boolean }) {
          rec.filters.push(`order:${k}`)
          rows.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : String(a[k]) > String(b[k]) ? 1 : 0) * (o.ascending ? 1 : -1))
          return q
        },
        limit(n: number) { rec.filters.push('limit'); rows = rows.slice(0, n); return q },
        maybeSingle() { return Promise.resolve(result(finish()[0] ?? null)) },
        then(resolve: (v: unknown) => unknown) { return Promise.resolve(result(finish())).then(resolve) },
      }
      return q
    },
  }
  return { admin: admin as unknown as Admin, calls }
}

const NOW = new Date('2026-10-10T00:00:00Z')
const ID = '3f2b8c1e-5a47-4d9e-9c0a-1b2c3d4e5f60'

const sw = (news: string | null, ent: string | null): Row[] => {
  const out: Row[] = []
  if (news !== null) out.push({ key: 'news_publication_enabled', value: news })
  if (ent !== null) out.push({ key: 'entertainment_publication_enabled', value: ent })
  return out
}

function content(over: Row = {}): Row {
  return {
    id: ID, kind: 'news', form: 'short', language: 'ko', title: 'T', description: 'D', ai_generated: true,
    publish_at: '2026-10-09T00:00:00Z', status: 'scheduled', rights_status: 'cleared',
    // internal columns that must never come out
    source: 'news_desk', source_ref: 'pn-1', source_version: 1, caption: 'SNS caption', payload_hash: 'h',
    upstream_approval_id: 'u', rights_reason: null, held_reason: null, returned_reason: null,
    ...over,
  }
}

const assets = (): Row[] => [
  { content_id: ID, role: 'main_9x16', media_type: 'video', file_format: 'mp4', url: 'https://cdn.example/m.mp4', duration_sec: 30, width: 1080, height: 1920, sha256: 'a', text_content: null },
  { content_id: ID, role: 'thumbnail', media_type: 'image', file_format: 'jpg', url: 'https://cdn.example/t.jpg', duration_sec: null, width: null, height: null, sha256: 'b', text_content: null },
  { content_id: ID, role: 'script', media_type: 'text', file_format: null, url: null, duration_sec: null, width: null, height: null, sha256: null, text_content: 'SECRET SCRIPT' },
  { content_id: ID, role: 'audio_master', media_type: 'audio', file_format: 'wav', url: 'https://cdn.example/a.wav', duration_sec: 30, width: null, height: null, sha256: 'c', text_content: null },
]

// ---- pure ------------------------------------------------------------------

test('decidePublicationSwitch: only a literal true opens; every other input closes', () => {
  assert.equal(decidePublicationSwitch({ value: 'true' }, null), true)
  assert.equal(decidePublicationSwitch({ value: ' TRUE ' }, null), true)
  for (const v of ['false', '', '1', 'yes', 'on', 'truee', null, undefined, 0, 1]) {
    assert.equal(decidePublicationSwitch({ value: v }, null), false, String(v))
  }
  assert.equal(decidePublicationSwitch(null, null), false) // missing row
  assert.equal(decidePublicationSwitch({ value: 'true' }, new Error('x')), false) // read error beats a value
})

test('isPublicRow: each of the four conditions alone closes it (control: all four open)', () => {
  const ok = { kind: 'news', status: 'scheduled', rights_status: 'cleared', publish_at: '2026-10-09T00:00:00Z' }
  assert.equal(isPublicRow(ok, ['news'], NOW), true)
  assert.equal(isPublicRow({ ...ok, status: 'held' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, status: 'hidden' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, status: 'returned' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, rights_status: 'restricted' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, rights_status: 'blocked' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, publish_at: '2026-10-11T00:00:00Z' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, publish_at: 'garbage' }, ['news'], NOW), false)
  assert.equal(isPublicRow(ok, [], NOW), false)
  assert.equal(isPublicRow(ok, ['film'], NOW), false)
  assert.equal(isPublicRow({ ...ok, publish_at: NOW.toISOString() }, ['news'], NOW), true) // boundary: publish_at <= now
})

test('toPublicAssets: only main_*/thumbnail with a url; script, audio_master and url-less rows never pass', () => {
  const out = toPublicAssets(assets())
  assert.deepEqual(out.map((a) => a.role).sort(), ['main_9x16', 'thumbnail'])
  assert.ok(out.every((a) => !('sha256' in a) && !('text_content' in a)))
  assert.deepEqual(toPublicAssets([{ role: 'main_16x9', url: '   ' }, { role: 'main_16x9', url: null }, { role: 'main_16x9' }]), [])
})

// ---- switches --------------------------------------------------------------

test('getOpenPublicationDbas: each switch alone; missing / error / throw -> none', async () => {
  const open = async (rows: Row[], o = {}) => getOpenPublicationDbas(fakeAdmin({ platform_config: rows }, o).admin)
  assert.deepEqual(await open(sw('true', 'true')), ['news', 'entertainment'])
  assert.deepEqual(await open(sw('true', 'false')), ['news'])
  assert.deepEqual(await open(sw('false', 'true')), ['entertainment'])
  assert.deepEqual(await open(sw('false', 'false')), [])
  assert.deepEqual(await open(sw('true', null)), ['news']) // one row missing closes only that DBA
  assert.deepEqual(await open([]), [])
  assert.deepEqual(await open(sw('true', 'true'), { errorOn: 'platform_config' }), [])
  assert.deepEqual(await open(sw('true', 'true'), { throwOn: 'platform_config' }), [])
})

test('the competition switch does not open content (they are different questions)', async () => {
  const rows: Row[] = [{ key: 'competition_publication_enabled', value: 'true' }, ...sw('false', 'false')]
  assert.deepEqual(await getOpenPublicationDbas(fakeAdmin({ platform_config: rows }).admin), [])
})

// ---- getPublicContent ------------------------------------------------------

function world(contentOver: Row = {}, switches = sw('true', 'true')) {
  return fakeAdmin({ platform_config: switches, contents: [content(contentOver)], content_assets: assets() })
}

test('visible control: a cleared scheduled past item with its DBA open is returned', async () => {
  const { admin } = world()
  const r = await getPublicContent(ID, { admin, now: NOW })
  assert.ok(r)
  assert.equal(r!.content.id, ID)
})

test('hidden: every way a row can be non-public yields null (same answer for all, so none is distinguishable)', async () => {
  const cases: [string, Row][] = [
    ['held', { status: 'held' }],
    ['hidden', { status: 'hidden' }],
    ['returned', { status: 'returned' }],
    ['restricted', { rights_status: 'restricted' }],
    ['blocked', { rights_status: 'blocked' }],
    ['future publish_at', { publish_at: '2026-10-11T00:00:00Z' }],
  ]
  for (const [name, over] of cases) {
    const { admin } = world(over)
    assert.equal(await getPublicContent(ID, { admin, now: NOW }), null, name)
  }
})

test('DBA switch: news open + entertainment closed shows news, hides drama; and the reverse', async () => {
  const drama = { kind: 'drama' }
  assert.ok(await getPublicContent(ID, { admin: world({}, sw('true', 'false')).admin, now: NOW }))
  assert.equal(await getPublicContent(ID, { admin: world(drama, sw('true', 'false')).admin, now: NOW }), null)
  assert.ok(await getPublicContent(ID, { admin: world(drama, sw('false', 'true')).admin, now: NOW }))
  assert.equal(await getPublicContent(ID, { admin: world({}, sw('false', 'true')).admin, now: NOW }), null)
})

test('all switches closed -> null and the contents table is never queried', async () => {
  const { admin, calls } = world({}, sw('false', 'false'))
  assert.equal(await getPublicContent(ID, { admin, now: NOW }), null)
  assert.ok(calls.every((c) => c.table === 'platform_config'), 'closed DBAs must not even reach the content query')
})

test('invalid id -> null with no database call at all', async () => {
  const { admin, calls } = world()
  for (const bad of ['', 'x', '../etc', "1' or '1'='1", ID.toUpperCase(), ID + 'x']) {
    assert.equal(await getPublicContent(bad, { admin, now: NOW }), null, bad)
  }
  assert.equal(calls.length, 0)
})

test('the filters are in the SQL query, with named columns (no load-all-then-filter)', async () => {
  const { admin, calls } = world()
  await getPublicContent(ID, { admin, now: NOW })
  const q = calls.find((c) => c.table === 'contents')!
  for (const f of ['eq:status', 'eq:rights_status', 'lte:publish_at', 'in:kind', 'eq:id']) assert.ok(q.filters.includes(f), f)
  assert.equal(q.select, PUBLIC_CONTENT_COLUMNS)
  assert.ok(!q.select.includes('*'))
  const a = calls.find((c) => c.table === 'content_assets')!
  assert.equal(a.select, PUBLIC_ASSET_COLUMNS)
  assert.ok(a.filters.includes('in:role'))
  assert.ok(a.filters.includes('not:url'))
})

test('nothing internal is selected: no script text, hashes, source identity, rights reason or SNS caption', async () => {
  const { admin, calls } = world()
  await getPublicContent(ID, { admin, now: NOW })
  const selected = calls.map((c) => c.select).join(',')
  for (const secret of ['text_content', 'sha256', 'source', 'payload_hash', 'upstream', 'rights_reason', 'held_reason', 'returned', 'caption', 'notified_at']) {
    assert.ok(!selected.includes(secret), `${secret} must not be selected`)
  }
})

test('the returned shape is the projection, and assets exclude script / audio_master', async () => {
  const { admin } = world()
  const r = await getPublicContent(ID, { admin, now: NOW })
  assert.deepEqual(Object.keys(r!.content).sort(), ['ai_generated', 'description', 'form', 'id', 'kind', 'language', 'publish_at', 'title'])
  assert.deepEqual(r!.assets.map((a) => a.role).sort(), ['main_9x16', 'thumbnail'])
  assert.ok(!JSON.stringify(r).includes('SECRET SCRIPT'))
})

test('RE-CHECK: if the SQL filter were broken, a held row is still dropped (control: a good row passes with the same broken client)', async () => {
  const broken = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content({ status: 'held' })], content_assets: assets() }, { ignoreFilters: true })
  assert.equal(await getPublicContent(ID, { admin: broken.admin, now: NOW }), null)
  const brokenGood = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content()], content_assets: assets() }, { ignoreFilters: true })
  assert.ok(await getPublicContent(ID, { admin: brokenGood.admin, now: NOW }))
})

test('errors and exceptions -> null, never a throw', async () => {
  for (const o of [{ errorOn: 'contents' }, { errorOn: 'content_assets' }, { throwOn: 'contents' }, { throwOn: 'content_assets' }]) {
    const { admin } = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content()], content_assets: assets() }, o)
    assert.equal(await getPublicContent(ID, { admin, now: NOW }), null, JSON.stringify(o))
  }
})

// ---- list ------------------------------------------------------------------

function many(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => content({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    publish_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
  }))
}

test('list: newest first, only public rows, limit clamped to the maximum', async () => {
  const rows = [...many(60), content({ id: '99999999-0000-4000-8000-000000000000', status: 'held', publish_at: '2026-10-09T23:00:00Z' })]
  const { admin } = fakeAdmin({ platform_config: sw('true', 'true'), contents: rows })
  const out = await listPublicContents({ admin, now: NOW, limit: 1000 })
  assert.equal(out.length, 50)
  assert.ok(!out.some((r) => r.id.startsWith('99999999')), 'the held row, newer than all others, must not appear')
  const times = out.map((r) => r.publish_at)
  assert.deepEqual(times, [...times].sort().reverse())
  assert.equal((await listPublicContents({ admin, now: NOW, limit: 3 })).length, 3)
  assert.equal((await listPublicContents({ admin, now: NOW, limit: 0 })).length, 1) // floor of 1, not "unlimited"
})

test('list: a closed kind is empty; an open kind filters; closed DBAs return nothing', async () => {
  const rows = [content({ id: ID }), content({ id: '11111111-0000-4000-8000-000000000000', kind: 'drama' })]
  const both = fakeAdmin({ platform_config: sw('true', 'true'), contents: rows }).admin
  assert.equal((await listPublicContents({ admin: both, now: NOW })).length, 2)
  assert.deepEqual((await listPublicContents({ admin: both, now: NOW, kind: 'drama' })).map((r) => r.kind), ['drama'])
  const newsOnly = fakeAdmin({ platform_config: sw('true', 'false'), contents: rows }).admin
  assert.deepEqual((await listPublicContents({ admin: newsOnly, now: NOW })).map((r) => r.kind), ['news'])
  assert.deepEqual(await listPublicContents({ admin: newsOnly, now: NOW, kind: 'drama' }), [])
  const none = fakeAdmin({ platform_config: sw('false', 'false'), contents: rows }).admin
  assert.deepEqual(await listPublicContents({ admin: none, now: NOW }), [])
})

test('list: broken filter + re-check drops non-public rows', async () => {
  const { admin } = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content({ status: 'hidden' }), content({ id: '22222222-0000-4000-8000-000000000000' })] }, { ignoreFilters: true })
  const out = await listPublicContents({ admin, now: NOW })
  assert.deepEqual(out.map((r) => r.id), ['22222222-0000-4000-8000-000000000000'])
})

// ---- permanent address -----------------------------------------------------

test('/c/<id> resolves to the current address only for a public item with a configured slug', async () => {
  const tables = (paths: Row[], over: Row = {}, sws = sw('true', 'true')) =>
    fakeAdmin({ platform_config: [...sws, ...paths], contents: [content(over)], content_assets: assets() }).admin
  const slug = [{ key: 'content_path_news', value: 'daily' }]

  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug), now: NOW }), `/daily/${ID}`)
  // public but the kind has no slug -> null (404), not a guessed path
  assert.equal(await resolvePublicAddress(ID, { admin: tables([]), now: NOW }), null)
  // slug present but the item is not public -> null: /c/<id> must not reveal that it exists
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, { status: 'held' }), now: NOW }), null)
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, { rights_status: 'blocked' }), now: NOW }), null)
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, {}, sw('false', 'false')), now: NOW }), null)
  // invalid / reserved slug -> closed
  assert.equal(await resolvePublicAddress(ID, { admin: tables([{ key: 'content_path_news', value: 'api' }]), now: NOW }), null)
})
