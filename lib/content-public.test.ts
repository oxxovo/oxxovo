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
  PUBLIC_THUMBNAIL_COLUMNS,
  decidePublicationSwitch,
  getOpenPublicationDbas,
  getPublicContent,
  isPublicRow,
  listPublicContents,
  pickThumbnails,
  resolvePublicAddress,
  toPublicAssets,
} from './content-public'

type Row = Record<string, unknown>
type Admin = Parameters<typeof getOpenPublicationDbas>[0]

type Call = { table: string; select: string; filters: string[] }

function fakeAdmin(
  tables: Record<string, Row[]>,
  opts: { ignoreFilters?: boolean; errorOn?: string; throwOn?: string; errorCode?: string } = {},
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
      const result = (data: unknown) => (opts.errorOn === table ? { data: null, error: { message: 'SECRET-TEXT-IN-MESSAGE', code: opts.errorCode } } : { data, error: null })
      const q = {
        select(c: string) { rec.select = c; return q },
        eq(k: string, v: unknown) { rec.filters.push(`eq:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => r[k] === v); return q },
        lte(k: string, v: string) { rec.filters.push(`lte:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => Date.parse(String(r[k])) <= Date.parse(v)); return q },
        in(k: string, vals: unknown[]) { rec.filters.push(`in:${k}`); if (!opts.ignoreFilters) rows = rows.filter((r) => vals.includes(r[k])); return q },
        not(k: string, op?: string, pat?: string) {
          rec.filters.push(`not:${k}`)
          if (!opts.ignoreFilters) {
            if (op === 'ilike') {
              const re = new RegExp('^' + String(pat).replace(/%/g, '.*') + '$', 'i')
              rows = rows.filter((r) => !re.test(String(r[k])))
            } else rows = rows.filter((r) => r[k] !== null && r[k] !== undefined)
          }
          return q
        },
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
  const ok = { kind: 'news', status: 'scheduled', rights_status: 'cleared', publish_at: '2026-10-09T00:00:00Z', source_ref: 'pn-1' }
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
  // third layer: probe- test rows, and a missing source_ref (fail-closed)
  assert.equal(isPublicRow({ ...ok, source_ref: 'probe-rt-cl-20261006060004' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, source_ref: 'PROBE-x' }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, source_ref: undefined }, ['news'], NOW), false)
  assert.equal(isPublicRow({ ...ok, source_ref: 'my-probe-1' }, ['news'], NOW), true) // prefix only
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
  // source_ref is selected for the probe- re-check and nowhere else; `source`,
  // `source_version` and everything below must not be selected at all.
  const withoutRecheck = selected.replace('source_ref', '')
  assert.ok(selected.includes('source_ref'), 'source_ref is read for the probe- re-check')
  for (const secret of ['text_content', 'sha256', 'source', 'payload_hash', 'upstream', 'rights_reason', 'held_reason', 'returned', 'caption', 'notified_at']) {
    assert.ok(!withoutRecheck.includes(secret), `${secret} must not be selected`)
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
  const slug = [{ key: 'content_path_news', value: 'news-slug' }]

  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug), now: NOW }), `/news-slug/${ID}`)
  // public but the kind has no slug -> null (404), not a guessed path
  assert.equal(await resolvePublicAddress(ID, { admin: tables([]), now: NOW }), null)
  // slug present but the item is not public -> null: /c/<id> must not reveal that it exists
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, { status: 'held' }), now: NOW }), null)
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, { rights_status: 'blocked' }), now: NOW }), null)
  assert.equal(await resolvePublicAddress(ID, { admin: tables(slug, {}, sw('false', 'false')), now: NOW }), null)
  // invalid / reserved slug -> closed
  assert.equal(await resolvePublicAddress(ID, { admin: tables([{ key: 'content_path_news', value: 'api' }]), now: NOW }), null)
})

// ---- probe- rows: three layers (HQ 2026-10-07) --------------------------------

const PROBE_ID = '44444444-4444-4444-8444-444444444444'
const probeRow = () => content({ id: PROBE_ID, source_ref: 'probe-rt-cl-20261006060004' }) // cleared + scheduled + due: ONLY the prefix stops it

test('probe- row is not public by id (control: the same row without the prefix IS public)', async () => {
  const tables = (over: Row) => fakeAdmin({ platform_config: sw('true', 'true'), contents: [content({ id: PROBE_ID, ...over })], content_assets: assets() }).admin
  assert.equal(await getPublicContent(PROBE_ID, { admin: tables({ source_ref: 'probe-rt-cl-20261006060004' }), now: NOW }), null)
  assert.ok(await getPublicContent(PROBE_ID, { admin: tables({ source_ref: 'real-1' }), now: NOW }))
})

test('probe- row is not listed (control: a real row is)', async () => {
  const { admin, calls } = fakeAdmin({ platform_config: sw('true', 'true'), contents: [probeRow(), content()] })
  const out = await listPublicContents({ admin, now: NOW })
  assert.deepEqual(out.map((r) => r.id), [ID])
  assert.ok(calls.find((c) => c.table === 'contents')!.filters.includes('not:source_ref'), 'the SQL carries the probe- exclusion')
})

test('layers 1+2 (SQL) and layer 3 (re-check) each stop a probe- row on their own', async () => {
  // SQL layer alone: the re-check cannot help a client whose rows never contain the probe row
  const sqlOnly = fakeAdmin({ platform_config: sw('true', 'true'), contents: [probeRow()], content_assets: assets() })
  assert.equal(await getPublicContent(PROBE_ID, { admin: sqlOnly.admin, now: NOW }), null)
  assert.ok(sqlOnly.calls.find((c) => c.table === 'contents')!.filters.includes('not:source_ref'))
  // re-check alone: filters ignored (as if the SQL were broken), the probe row still does not come out
  const broken = fakeAdmin({ platform_config: sw('true', 'true'), contents: [probeRow()], content_assets: assets() }, { ignoreFilters: true })
  assert.equal(await getPublicContent(PROBE_ID, { admin: broken.admin, now: NOW }), null)
  const brokenList = fakeAdmin({ platform_config: sw('true', 'true'), contents: [probeRow(), content()] }, { ignoreFilters: true })
  assert.deepEqual((await listPublicContents({ admin: brokenList.admin, now: NOW })).map((r) => r.id), [ID])
})

test('source_ref is read for the re-check but never part of the projection', async () => {
  const { admin } = world()
  const r = await getPublicContent(ID, { admin, now: NOW })
  assert.ok(!('source_ref' in r!.content))
  assert.ok(!JSON.stringify(r).includes('pn-1'))
  const list = await listPublicContents({ admin: world().admin, now: NOW })
  assert.ok(!JSON.stringify(list).includes('pn-1'))
})

// ---- a broken query must leave a trace (but only a code and an id) -------------

test('query failures are logged with code and id only; the answer stays null', async () => {
  const logs: string[] = []
  const orig = console.error
  console.error = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
  try {
    for (const table of ['contents', 'content_assets', 'platform_config']) {
      const { admin } = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content()], content_assets: assets() }, { errorOn: table, errorCode: '42703' })
      assert.equal(await getPublicContent(ID, { admin, now: NOW }), null)
    }
    const { admin } = fakeAdmin({ platform_config: sw('true', 'true'), contents: [content()] }, { errorOn: 'contents', errorCode: '42703' })
    assert.deepEqual(await listPublicContents({ admin, now: NOW }), [])
  } finally {
    console.error = orig
  }
  const text = logs.join('\n')
  assert.match(text, /where=content code=42703 id=3f2b8c1e/)
  assert.match(text, /where=assets code=42703/)
  assert.match(text, /where=switches code=42703/)
  assert.match(text, /where=list code=42703/)
  assert.ok(!text.includes('SECRET-TEXT-IN-MESSAGE'), 'the error message text must not be logged')
  assert.ok(!text.includes('SNS caption') && !text.includes('title'), 'no content in the log')
})

// ---- section routing -----------------------------------------------------------

import { resolveSectionKind, getPublicContentBySection, listPublicContentsBySection } from './content-public'

const SLUG_NEWS = [{ key: 'content_path_news', value: 'news-slug' }]
const world2 = (paths: Row[], sws = sw('true', 'true'), rows: Row[] = [content()]) =>
  fakeAdmin({ platform_config: [...sws, ...paths], contents: rows, content_assets: assets() })

test('section: a segment that cannot be a slug is answered WITHOUT a database read', async () => {
  const { admin, calls } = world2(SLUG_NEWS)
  for (const bad of ['wp-login.php', 'Admin', 'api', 'c', 'watch', '', 'a'.repeat(60), '.env', 'x y']) {
    assert.equal(await resolveSectionKind(bad, { admin }), null, bad)
  }
  assert.equal(calls.length, 0)
})

test('section: slug-shaped but not configured -> null; configured -> its kind (control)', async () => {
  const none = world2([])
  assert.equal(await resolveSectionKind('news-slug', { admin: none.admin }), null)
  assert.equal(none.calls.length, 1) // exactly one platform_config read, no cache
  assert.equal(await resolveSectionKind('news-slug', { admin: world2(SLUG_NEWS).admin }), 'news')
  assert.equal(await resolveSectionKind('other', { admin: world2(SLUG_NEWS).admin }), null)
})

test('section item: wrong section, missing slug, closed switch, held, probe- are all null (control: the right section shows it)', async () => {
  const ok = await getPublicContentBySection('news-slug', ID, { admin: world2(SLUG_NEWS).admin, now: NOW })
  assert.equal(ok?.kind, 'news')
  assert.equal(ok?.item.content.id, ID)

  const filmSlug = [...SLUG_NEWS, { key: 'content_path_film', value: 'movies' }]
  assert.equal(await getPublicContentBySection('movies', ID, { admin: world2(filmSlug).admin, now: NOW }), null) // news item under the film section
  assert.equal(await getPublicContentBySection('news-slug', ID, { admin: world2([]).admin, now: NOW }), null)
  assert.equal(await getPublicContentBySection('news-slug', ID, { admin: world2(SLUG_NEWS, sw('false', 'false')).admin, now: NOW }), null)
  assert.equal(await getPublicContentBySection('news-slug', ID, { admin: world2(SLUG_NEWS, sw('true', 'true'), [content({ status: 'held' })]).admin, now: NOW }), null)
  assert.equal(await getPublicContentBySection('news-slug', PROBE_ID, { admin: world2(SLUG_NEWS, sw('true', 'true'), [probeRow()]).admin, now: NOW }), null)
  assert.equal(await getPublicContentBySection('news-slug', 'not-a-uuid', { admin: world2(SLUG_NEWS).admin, now: NOW }), null)
})

test('section list: closed DBA -> null (404); open and empty -> []; open with items -> items', async () => {
  assert.equal(await listPublicContentsBySection('news-slug', { admin: world2(SLUG_NEWS, sw('false', 'true')).admin, now: NOW }), null)
  assert.equal(await listPublicContentsBySection('news-slug', { admin: world2(SLUG_NEWS, sw('true', 'true'), []).admin, now: NOW }).then((r) => r?.items.length), 0)
  const r = await listPublicContentsBySection('news-slug', { admin: world2(SLUG_NEWS).admin, now: NOW })
  assert.deepEqual(r?.items.map((i) => i.id), [ID])
  assert.equal(await listPublicContentsBySection('nothing', { admin: world2(SLUG_NEWS).admin, now: NOW }), null)
})

// ---- list thumbnails (cards) -----------------------------------------------------
// The list may carry exactly one extra field, thumbnail_url, and only on request. These
// tests pin what may enter it (role thumbnail only), what may never (videos, scripts,
// audio, anything else), and that a missing thumbnail is null, not an error.

const T_ID = '44444444-0000-4000-8000-000000000000'
const thumbAssets = (): Row[] => [
  ...assets(),
  { content_id: T_ID, role: 'main_16x9', media_type: 'video', file_format: 'mp4', url: 'https://cdn.example/other-video.mp4', duration_sec: 30, width: 1920, height: 1080, sha256: 'd', text_content: null },
]
const listWorld = (over: { contents?: Row[]; assets?: Row[]; sws?: Row[] } = {}, opts: Parameters<typeof fakeAdmin>[1] = {}) =>
  fakeAdmin({ platform_config: over.sws ?? sw('true', 'true'), contents: over.contents ?? [content()], content_assets: over.assets ?? thumbAssets() }, opts)

test('thumbnails: with the option, the thumbnail url is set (control); without it there is no field and no asset query', async () => {
  const { admin, calls } = listWorld()
  const on = await listPublicContents({ admin, now: NOW, withThumbnails: true })
  assert.equal(on[0].thumbnail_url, 'https://cdn.example/t.jpg')
  const off = listWorld()
  const plain = await listPublicContents({ admin: off.admin, now: NOW })
  assert.ok(!('thumbnail_url' in plain[0]), 'the field is absent unless asked for')
  assert.ok(!off.calls.some((c) => c.table === 'content_assets'), 'no asset query unless asked for')
  assert.ok(calls.some((c) => c.table === 'content_assets'))
})

test('★thumbnails: the list item carries nothing from the other assets (no video url, script, audio, hash)', async () => {
  const out = await listPublicContents({ admin: listWorld().admin, now: NOW, withThumbnails: true })
  const keys = Object.keys(out[0]).sort()
  assert.deepEqual(keys, ['ai_generated', 'description', 'form', 'id', 'kind', 'language', 'publish_at', 'thumbnail_url', 'title'])
  const json = JSON.stringify(out)
  for (const bad of ['m.mp4', 'a.wav', 'other-video', 'SECRET SCRIPT', 'sha256', 'text_content', '"b"', 'source_ref', 'caption']) assert.ok(!json.includes(bad), bad)
})

test('★thumbnails: the query is SQL-limited to role thumbnail, the judged ids and non-null urls, with the 4 named columns', async () => {
  const { admin, calls } = listWorld()
  await listPublicContents({ admin, now: NOW, withThumbnails: true })
  const q = calls.find((c) => c.table === 'content_assets')!
  assert.equal(q.select, PUBLIC_THUMBNAIL_COLUMNS)
  assert.equal(PUBLIC_THUMBNAIL_COLUMNS, 'content_id, role, media_type, url')
  for (const f of ['in:content_id', 'eq:role', 'not:url']) assert.ok(q.filters.includes(f), f)
  assert.ok(!q.select.includes('*') && !/sha256|text_content|bytes/.test(q.select))
})

test('★thumbnails: only items that passed the public judgement are looked up (a held item is never asked about)', async () => {
  const heldId = '55555555-0000-4000-8000-000000000000'
  const held = content({ id: heldId, status: 'held' })
  const heldThumb: Row = { content_id: heldId, role: 'thumbnail', media_type: 'image', url: 'https://cdn.example/held.jpg' }
  const { admin } = listWorld({ contents: [content(), held], assets: [...thumbAssets(), heldThumb] })
  const out = await listPublicContents({ admin, now: NOW, withThumbnails: true })
  assert.deepEqual(out.map((i) => i.id), [ID])
  assert.ok(!JSON.stringify(out).includes('held.jpg'))
})

test('★thumbnails: pure rules -- role thumbnail only; a public VIDEO role, a non-image, http, blank and a foreign id are all refused', () => {
  const ids = new Set([ID])
  const ok: Row = { content_id: ID, role: 'thumbnail', media_type: 'image', url: 'https://cdn.example/t.jpg' }
  assert.deepEqual([...pickThumbnails([ok], ids)], [[ID, 'https://cdn.example/t.jpg']])
  const refused: [string, Row][] = [
    ['main_16x9 (a public role, but a video)', { ...ok, role: 'main_16x9', media_type: 'video', url: 'https://cdn.example/v.mp4' }],
    ['main_9x16', { ...ok, role: 'main_9x16' }],
    ['script', { ...ok, role: 'script' }],
    ['audio_master', { ...ok, role: 'audio_master' }],
    ['unknown role', { ...ok, role: 'poster' }],
    ['thumbnail that is not an image', { ...ok, media_type: 'video' }],
    ['http url', { ...ok, url: 'http://cdn.example/t.jpg' }],
    ['relative url', { ...ok, url: '/t.jpg' }],
    ['blank url', { ...ok, url: '   ' }],
    ['null url', { ...ok, url: null }],
    ['javascript url', { ...ok, url: 'javascript:alert(1)' }],
    ['another item id', { ...ok, content_id: 'ffffffff-0000-4000-8000-000000000000' }],
    ['no content id', { ...ok, content_id: undefined }],
  ]
  for (const [why, row] of refused) assert.equal(pickThumbnails([row], ids).size, 0, why)
})

test('thumbnails: several thumbnails -> a deterministic one; none -> null (the gradient frame), never an error', async () => {
  const two: Row[] = [
    { content_id: ID, role: 'thumbnail', media_type: 'image', url: 'https://cdn.example/b.jpg' },
    { content_id: ID, role: 'thumbnail', media_type: 'image', url: 'https://cdn.example/a.jpg' },
  ]
  assert.equal(pickThumbnails(two, new Set([ID])).get(ID), 'https://cdn.example/a.jpg')
  const none = await listPublicContents({ admin: listWorld({ assets: [] }).admin, now: NOW, withThumbnails: true })
  assert.equal(none.length, 1)
  assert.equal(none[0].thumbnail_url, null)
  const onlyVideo = await listPublicContents({ admin: listWorld({ assets: [assets()[0]] }).admin, now: NOW, withThumbnails: true })
  assert.equal(onlyVideo[0].thumbnail_url, null, 'a main video is never used as the card image')
})

// content_assets.url is nullable (live schema, TK 2026-10-12: `url text`, no NOT NULL). A
// null url must never throw and never poison a good thumbnail next to it, whatever the order.
test('★thumbnails: a null / missing url beside a good thumbnail is skipped, never thrown on, in either order', async () => {
  const good: Row = { content_id: ID, role: 'thumbnail', media_type: 'image', url: 'https://cdn.example/z.jpg' }
  const nullUrl: Row = { content_id: ID, role: 'thumbnail', media_type: 'image', url: null }
  const noUrl: Row = { content_id: ID, role: 'thumbnail', media_type: 'image' }
  const ids = new Set([ID])
  for (const rows of [[good, nullUrl, noUrl], [nullUrl, noUrl, good], [noUrl, good, nullUrl]]) {
    assert.deepEqual([...pickThumbnails(rows, ids)], [[ID, 'https://cdn.example/z.jpg']])
  }
  assert.equal(pickThumbnails([nullUrl, noUrl], ids).size, 0)
  // Even if the SQL filter were bypassed and the database handed back only a null url, the card
  // gets null (the gradient frame), not an error.
  const out = await listPublicContents({ admin: listWorld({ assets: [{ ...nullUrl, content_id: ID }] }).admin, now: NOW, withThumbnails: true })
  assert.equal(out.length, 1)
  assert.equal(out[0].thumbnail_url, null)
})

test('thumbnails: a failing asset query costs the images, not the list', async () => {
  const origErr = console.error
  console.error = () => {}
  try {
    const out = await listPublicContents({ admin: listWorld({}, { errorOn: 'content_assets' }).admin, now: NOW, withThumbnails: true })
    assert.equal(out.length, 1)
    assert.equal(out[0].thumbnail_url, null)
  } finally {
    console.error = origErr
  }
})
