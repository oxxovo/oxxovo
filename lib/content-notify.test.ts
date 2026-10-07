import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_CONTENTS_URL,
  NOTIFY_LIMIT,
  heldReasonText,
  listNotifiableContents,
  markContentsNotified,
  planNotices,
  runContentNotices,
  type NotifiableContent,
  type NoticeAdmin,
  type NoticeDeps,
} from './content-notify'

const c = (n: number, over: Partial<NotifiableContent> = {}): NotifiableContent => ({
  id: `id${n}`, title: `title ${n}`, kind: 'cf', source_ref: `ref-${n}`, source_version: 1,
  status: 'scheduled', rights_status: 'cleared', held_reason: null, rights_reason: null,
  publish_at: '2026-10-08T07:00:00Z', ...over,
})
const held = (n: number, over: Partial<NotifiableContent> = {}) =>
  c(n, { status: 'held', held_reason: 'late_for_slot', ...over })
const rightsHeld = (n: number, over: Partial<NotifiableContent> = {}) =>
  c(n, { status: 'held', rights_status: 'restricted', rights_reason: 'terms pending', ...over })

function deps(rows: NotifiableContent[], sendOk = true) {
  const sent: { subject: string; html: string }[] = []
  const marked: string[][] = []
  const d: NoticeDeps = {
    async list() { return rows },
    async send(subject, html) { if (sendOk) sent.push({ subject, html }); return sendOk },
    async mark(ids) { marked.push(ids) },
  }
  return { d, sent, marked }
}

// ---- mail content -----------------------------------------------------------
test('held mail: count in the subject, WHY on the first line, admin link, never says "scheduled"', () => {
  const p = planNotices([held(1), held(2), held(3, { held_reason: 'manual' })], false)
  assert.ok(p.action)
  assert.match(p.action!.subject, /^\[OXXOVO\] 3 content item\(s\) held/)
  const firstLine = p.action!.html.split('</p>')[0]
  assert.match(firstLine, /2 missed its publish slot/)
  assert.match(firstLine, /1 stopped by a person/)
  assert.ok(p.action!.html.includes(`${ADMIN_CONTENTS_URL}?status=action`))
  assert.doesNotMatch(p.action!.html, /scheduled/i)
  assert.equal(p.scheduled, null)
})

test('scheduled mail is separate from the held mail and lists UTC times', () => {
  const p = planNotices([c(1), c(2), held(3)], false)
  assert.ok(p.scheduled && p.action)
  assert.match(p.scheduled!.subject, /2 new content item\(s\) scheduled/)
  assert.match(p.scheduled!.html, /2026-10-08 07:00 UTC/)
  assert.ok(!p.scheduled!.ids.includes('id3'))
  assert.ok(!p.action!.ids.includes('id1'))
  assert.doesNotMatch(p.action!.html, /new content/i)
})

test('rights-waiting: own section, NOT counted in the held subject; rides along with an action mail', () => {
  const p = planNotices([held(1), rightsHeld(2), rightsHeld(3)], false)
  assert.match(p.action!.subject, /^\[OXXOVO\] 1 content item\(s\) held/)
  assert.match(p.action!.html, /Also waiting on rights \(2\)/)
  assert.deepEqual(p.action!.ids.sort(), ['id1', 'id2', 'id3'])
})

test('only rights-waiting: no mail, but the rows are to be marked so they do not pile up', () => {
  const p = planNotices([rightsHeld(1), rightsHeld(2)], false)
  assert.equal(p.action, null)
  assert.equal(p.scheduled, null)
  assert.deepEqual(p.markOnly, ['id1', 'id2'])
})

test('held reason text: version 2+ with no stored reason is explained', () => {
  assert.match(heldReasonText(held(1, { held_reason: null, source_version: 2 })), /version 2 is always held/)
  assert.match(heldReasonText(held(1, { held_reason: null })), /no reason recorded/)
})

test('source text is HTML-escaped, control chars stripped, length capped', () => {
  const p = planNotices([held(1, { title: '<script>alert(1)</script>\u0007' + 'x'.repeat(300), source_ref: 'a"b' })], false)
  assert.doesNotMatch(p.action!.html, /<script>/)
  assert.match(p.action!.html, /&lt;script&gt;/)
  assert.match(p.action!.html, /a&quot;b/)
  assert.doesNotMatch(p.action!.html, /x{200}/)
  assert.doesNotMatch(p.action!.html, /\u0007/)
})

// ---- probe- -----------------------------------------------------------------
test('probe- rows never reach a mail or a mark, even if the query handed them over (control: real row does)', () => {
  const probe = [held(1, { source_ref: 'probe-rt-20261006054214' }), rightsHeld(2, { source_ref: 'PROBE-x' }), c(3, { source_ref: 'probe-a' })]
  const p0 = planNotices(probe, false)
  assert.deepEqual([p0.action, p0.scheduled, p0.markOnly], [null, null, []])
  const p1 = planNotices([...probe, held(4)], false)
  assert.deepEqual(p1.action!.ids, ['id4'])
})

// ---- retry rule -------------------------------------------------------------
test('notified_at is marked only AFTER the mail was accepted; a failed send marks nothing', async () => {
  const ok = deps([held(1), c(2)])
  const r1 = await runContentNotices(ok.d)
  assert.equal(r1.mails, 2)
  assert.deepEqual(ok.marked, [['id1'], ['id2']])

  const bad = deps([held(1), c(2)], false)
  const r2 = await runContentNotices(bad.d)
  assert.equal(r2.mails, 0)
  assert.equal(r2.marked, 0)
  assert.deepEqual(bad.marked, [])
  assert.deepEqual(r2.warnings, ['notice_not_sent:held', 'notice_not_sent:scheduled'])
})

test('one failing mail does not block the other; a list failure is a warning, not a throw', async () => {
  const sent: string[] = []
  const marked: string[][] = []
  const r = await runContentNotices({
    async list() { return [held(1), c(2)] },
    async send(subject) { if (/held/.test(subject)) throw new Error('boom'); sent.push(subject); return true },
    async mark(ids) { marked.push(ids) },
  })
  assert.equal(r.mails, 1)
  assert.deepEqual(marked, [['id2']])
  assert.match(r.warnings[0], /notice_failed:held:boom/)

  const r2 = await runContentNotices({ async list() { throw new Error('db down') }, send: async () => true, mark: async () => {} })
  assert.match(r2.warnings[0], /notify_list_failed:db down/)
})

test('rights-only: marked without any send', async () => {
  const x = deps([rightsHeld(1)])
  const r = await runContentNotices(x.d)
  assert.equal(x.sent.length, 0)
  assert.deepEqual(x.marked, [['id1']])
  assert.equal(r.marked, 1)
})

test('a full page adds a "more pending" note', () => {
  const rows = Array.from({ length: NOTIFY_LIMIT }, (_, i) => held(i))
  assert.match(planNotices(rows, true).action!.html, /More than 100 pending/)
  assert.doesNotMatch(planNotices(rows, false).action!.html, /More than/)
})

// ---- the real query (fake client that actually applies the filters) ----------
type Row = Record<string, unknown>
function fakeDb(rows: Row[]) {
  const updates: { patch: Row; ids: unknown[] }[] = []
  const admin: NoticeAdmin = {
    from() {
      let filters: ((r: Row) => boolean)[] = []
      let patch: Row | null = null
      const q: Record<string, unknown> = {
        select: () => q,
        update: (p: Row) => ((patch = p), q),
        is: (col: string, v: null) => (filters.push((r) => (r[col] ?? null) === v), q),
        in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), q),
        not: (col: string, op: string, pat: string) => {
          assert.equal(op, 'ilike')
          const re = new RegExp('^' + pat.replace(/%/g, '.*') + '$', 'i')
          filters.push((r) => !re.test(String(r[col])))
          return q
        },
        order: () => q,
        limit: () => q,
        then: (res: (v: unknown) => unknown) => {
          const hit = rows.filter((r) => filters.every((f) => f(r)))
          if (patch) updates.push({ patch, ids: hit.map((r) => r.id) })
          return res({ data: patch ? null : hit, error: null })
        },
      }
      filters = []
      return q
    },
  }
  return { admin, updates }
}

test('listNotifiableContents: probe- rows excluded by the QUERY; notified / returned / hidden rows too', async () => {
  const db = fakeDb([
    { ...held(1), notified_at: null },
    { ...held(2, { source_ref: 'probe-rt-cl-20261006060004' }), notified_at: null },
    { ...held(3), notified_at: '2026-10-07T00:00:00Z' },
    { ...c(4, { status: 'returned' }), notified_at: null },
    { ...c(5, { status: 'hidden' }), notified_at: null },
    { ...c(6), notified_at: null },
  ])
  const got = await listNotifiableContents(db.admin)
  assert.deepEqual(got.map((r) => r.id).sort(), ['id1', 'id6'])
})

test('markContentsNotified only touches rows that are still unnotified, and skips an empty list', async () => {
  const db = fakeDb([{ id: 'a', notified_at: null }, { id: 'b', notified_at: 'x' }])
  await markContentsNotified(db.admin, ['a', 'b'])
  assert.deepEqual(db.updates[0].ids, ['a'])
  assert.ok(typeof db.updates[0].patch.notified_at === 'string')
  await markContentsNotified(db.admin, [])
  assert.equal(db.updates.length, 1)
})
