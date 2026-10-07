import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ACTION_ERROR_TEXT,
  BUTTON_TEXT,
  CONFIRM_TEXT,
  CONTENT_STATUS_TEXT,
  DBA_TEXT,
  DIST_STATUS_TEXT,
  ERROR_TEXT,
  FILTER_TEXT,
  HELD_REASON_TEXT,
  PROBE_BLOCK_MESSAGE,
  SCREEN_TEXT,
  SWITCH_TEXT,
} from './content-admin-text'
import { STATUS_FILTER_LABEL, formatPT, ptWallToIso, remainingLabel } from './content-admin'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// Every string the screen can show, functions called with a placeholder.
function allStrings(): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (typeof v === 'function') out.push(String((v as (...a: unknown[]) => unknown)('x', 'x', 'x')))
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  ;[
    CONTENT_STATUS_TEXT, DIST_STATUS_TEXT, DBA_TEXT, FILTER_TEXT, HELD_REASON_TEXT, BUTTON_TEXT, SCREEN_TEXT,
    ACTION_ERROR_TEXT, ERROR_TEXT, SWITCH_TEXT, CONFIRM_TEXT, PROBE_BLOCK_MESSAGE,
  ].forEach(walk)
  return out
}

// ---- the confirmed terms, as a table (copy owner, 2026-10-07) ---------------
test('terms: the confirmed status / button / source / concept words, exactly', () => {
  assert.deepEqual({ ...CONTENT_STATUS_TEXT }, { scheduled: 'Scheduled', held: 'Held', returned: 'Returned', hidden: 'Hidden' })
  assert.deepEqual(
    { ...DIST_STATUS_TEXT },
    {
      queued: 'Queued', sending: 'Dispatching', posted: 'Dispatched', failed: 'Failed', unknown: 'Needs review',
      cancelled: 'Canceled', skipped_no_asset: 'Skipped — no asset', skipped_oversize: 'Skipped — too large',
    },
  )
  assert.deepEqual({ ...DBA_TEXT }, { news: 'Daily', entertainment: 'Entertainment' })
  assert.deepEqual(
    [BUTTON_TEXT.hold, BUTTON_TEXT.hide, BUTTON_TEXT.return, BUTTON_TEXT.restoreToHold, BUTTON_TEXT.unhide],
    ['Hold', 'Hide', 'Return', 'Restore to hold', 'Unhide'],
  )
  assert.deepEqual(
    [BUTTON_TEXT.dispatch, BUTTON_TEXT.redispatch, BUTTON_TEXT.markDispatched, BUTTON_TEXT.editMetadata, BUTTON_TEXT.editDispatchTime],
    ['Dispatch', 'Re-dispatch', 'Mark dispatched', 'Edit metadata', 'Edit dispatch time'],
  )
  assert.deepEqual([BUTTON_TEXT.save, BUTTON_TEXT.close, BUTTON_TEXT.cancel], ['Save', 'Close', 'Cancel'])
  // The filter chips show the same words as the card labels.
  assert.equal(STATUS_FILTER_LABEL.held, CONTENT_STATUS_TEXT.held)
  assert.equal(STATUS_FILTER_LABEL.returned, CONTENT_STATUS_TEXT.returned)
})

test('terms: held / returned are the notice-mail words (lib/content-notify.ts NOTICE_TEXT), not synonyms', () => {
  const mail = read('lib/content-notify.ts')
  assert.match(mail, /content item\(s\) held/)
  assert.match(mail, /content item\(s\) returned/)
  assert.equal(CONTENT_STATUS_TEXT.held.toLowerCase(), 'held')
  assert.equal(CONTENT_STATUS_TEXT.returned.toLowerCase(), 'returned')
})

// ---- status mapping is complete against the schema --------------------------
test('every status the DB allows has a label (a new status cannot silently show raw)', () => {
  const sql = read('reports/phase1_step1_tables_2026-10-05.sql')
  const set = (name: string) => {
    const m = new RegExp(`CONSTRAINT ${name}\\s+CHECK \\(status IN \\(([^)]*)\\)\\)`).exec(sql)
    assert.ok(m, `${name} not found in the schema file`) // positive control: the regex finds it
    return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
  }
  assert.deepEqual(Object.keys(CONTENT_STATUS_TEXT).sort(), set('contents_status_chk'))
  assert.deepEqual(Object.keys(DIST_STATUS_TEXT).sort(), set('content_distributions_status_chk'))
})

// ---- dispatch vs publish, forbidden words, no Korean ------------------------
test('this screen says "dispatch", never "publish" (publish = on the site, a different thing)', () => {
  const strings = allStrings()
  assert.ok(strings.some((s) => /dispatch/i.test(s))) // control: the scan sees real text
  for (const s of strings) assert.doesNotMatch(s, /publish/i, s)
})

test('forbidden wording: Pause, News (as a source name), Ent, Meta', () => {
  for (const s of allStrings()) {
    assert.doesNotMatch(s, /\bpaus/i, s) // Hold, not Pause
    assert.doesNotMatch(s, /\bNews\b/, s) // Daily
    assert.doesNotMatch(s, /\bEnt\b/, s) // Entertainment, spelled out
    assert.doesNotMatch(s, /\bMeta\b/, s) // Metadata
  }
  assert.ok(allStrings().some((s) => /\bmetadata\b/i.test(s))) // control: the word we DO use is found
})

test('no Korean in the /admin/contents sources (comments excluded); control: the scan does see Hangul', () => {
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const hangul = /[가-힣]/
  assert.ok(hangul.test(strip("const x = '한글'"))) // control
  assert.ok(!hangul.test(strip('// 한글 comment\n/* 한글 */')))
  for (const f of [
    'app/admin/contents/ContentsView.tsx',
    'app/admin/contents/page.tsx',
    'app/admin/contents/actions.ts',
    'lib/content-admin.ts',
    'lib/content-admin-actions.ts',
    'lib/content-admin-text.ts',
  ]) {
    assert.ok(!hangul.test(strip(read(f))), `${f} contains Korean text`)
  }
  for (const s of allStrings()) assert.ok(!hangul.test(s), s)
})

// ---- time: en-US, Pacific, 24-hour, always "PT" ------------------------------
test('formatPT: "Oct 7, 2026, 14:30 PT" -- en-US, 24-hour, PT suffix', () => {
  assert.equal(formatPT('2026-10-07T21:30:00Z'), 'Oct 7, 2026, 14:30 PT')
  assert.equal(formatPT('2026-10-07T21:30:00Z').endsWith(' PT'), true)
  assert.doesNotMatch(formatPT('2026-10-07T21:30:00Z'), /AM|PM/i)
  assert.equal(formatPT('2026-10-07T12:05:00Z'), 'Oct 7, 2026, 05:05 PT') // 2-digit hour
})

test('formatPT: midnight is 00:00 (not 24:00); the zone follows DST (PDT -7 / PST -8)', () => {
  assert.equal(formatPT('2026-10-08T07:00:00Z'), 'Oct 8, 2026, 00:00 PT')
  assert.equal(formatPT('2026-11-02T00:00:00Z'), 'Nov 1, 2026, 16:00 PT') // after DST ended: UTC-8
  assert.equal(formatPT('2026-11-01T08:59:00Z'), 'Nov 1, 2026, 01:59 PT') // PDT, one minute before the change
  assert.equal(formatPT('2026-11-01T10:00:00Z'), 'Nov 1, 2026, 02:00 PT') // PST
})

test('formatPT: never UTC (control: the same instant read in UTC differs)', () => {
  assert.notEqual(formatPT('2026-10-07T21:30:00Z'), 'Oct 7, 2026, 21:30 PT')
  assert.equal(formatPT('not a date'), '-')
})

test('ptWallToIso: the datetime-local value is read as PT, whatever the browser zone is', () => {
  assert.equal(ptWallToIso('2026-10-08T07:00'), '2026-10-08T14:00:00.000Z') // PDT
  assert.equal(ptWallToIso('2026-11-02T07:00'), '2026-11-02T15:00:00.000Z') // PST
  assert.equal(ptWallToIso('garbage'), null)
  assert.equal(ptWallToIso(''), null)
  // Round trip: what the person typed is what the screen then shows.
  assert.equal(formatPT(ptWallToIso('2026-10-08T07:00') as string), 'Oct 8, 2026, 07:00 PT')
  assert.equal(formatPT(ptWallToIso('2026-12-25T23:45') as string), 'Dec 25, 2026, 23:45 PT')
})

test('remainingLabel is English', () => {
  const now = new Date('2026-10-07T00:00:00Z')
  assert.equal(remainingLabel('2026-10-07T03:12:00Z', now), 'in 3h 12m')
  assert.equal(remainingLabel('x', now), '-')
})

// ---- the machine's zone must not matter -------------------------------------
// The author's PC is itself on Pacific time, where "read it in the browser zone" and
// "read it as PT" give the SAME answer and a broken version would stay green. So the
// check runs in a child process forced to UTC; the first line proves the child
// really is on UTC (otherwise this test proves nothing and says so).
test('ptWallToIso / formatPT give the same answer whatever zone the machine is in', async () => {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const root = fileURLToPath(new URL('..', import.meta.url))
  const mod = new URL('./content-admin.ts', import.meta.url).href
  const code = `
    import { ptWallToIso, formatPT } from ${JSON.stringify(mod)}
    console.log(JSON.stringify([
      new Date('2026-10-08T07:00:00Z').getHours(),
      ptWallToIso('2026-10-08T07:00'),
      formatPT('2026-10-07T21:30:00Z'),
    ]))`
  const r = spawnSync(process.execPath, ['--import', './scripts/test-register.mjs', '--input-type=module', '-e', code], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
  })
  assert.equal(r.status, 0, r.stderr)
  const [utcHours, iso, shown] = JSON.parse(r.stdout.trim().split('\n').pop() as string)
  assert.equal(utcHours, 7, 'control failed: the child is not on UTC, so this test cannot prove anything')
  assert.equal(iso, '2026-10-08T14:00:00.000Z') // read as PT, not as the child's UTC (which would be 07:00Z)
  assert.equal(shown, 'Oct 7, 2026, 14:30 PT')
})

// ---- the view cannot go around formatPT -------------------------------------
// ContentsView is a React component with no render test, so a call like
// toLocaleString('ko-KR') there is invisible to the formatPT tests (found by
// breaking it on purpose: the mutation stayed green). Pin it by reading the source:
// the screen formats every time through formatPT and reads input through ptWallToIso.
test('/admin/contents: times only through formatPT / ptWallToIso (no toLocale*, no new Date(input))', () => {
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const view = strip(read('app/admin/contents/ContentsView.tsx'))
  assert.match(view, /formatPT\(c\.publishAt\)/)
  assert.match(view, /ptWallToIso\(v\)/)
  for (const f of ['app/admin/contents/ContentsView.tsx', 'app/admin/contents/page.tsx']) {
    const src = strip(read(f))
    assert.doesNotMatch(src, /toLocale(Date|Time)?String\(/, `${f} formats a time by itself`)
    assert.doesNotMatch(src, /Intl\.DateTimeFormat/, `${f} formats a time by itself`)
  }
  assert.doesNotMatch(view, /new Date\(v\)/) // the picker value read in the browser zone
})
