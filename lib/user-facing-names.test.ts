// The old surface name must not survive in text people read (HQ/TK 2026-10-07:
// the name is retired, the public surface is OXXOVO). This scans the source for
// the word as a NAME and fails on any hit that is not on a short allow-list.
//
// What is deliberately NOT a hit:
//  - comments (stripped first) -- developer vocabulary, not read by users;
//  - identifiers (WatchShell, isWatchHome, watch_as_home, lib/watch-*.ts, ...) --
//    the pattern needs the word to stand alone, and DB / env / internal names are
//    not renamed (design SS7-4 glossary);
//  - the English VERB "watch" (VERB_ALLOWED): "Watch the video ->", "Watch my entry",
//    "Watch Later". Rewriting those would break the sentence, so each one is named
//    here and a NEW occurrence is a failure until someone decides it is a verb;
//  - lowercase `watch` (paths, keys, i18n dictionary names).
//
// PENDING_SECOND_PASS = the email copy, owned by Jenny3 (HQ 2026-10-07). Those
// lines are allowed ONLY until the wording is final; delete the entries when it is.
// This is a safety net, not a proof: it cannot tell a verb from a name by itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

type Allow = { file: string; re: RegExp; why: string }

const VERB_ALLOWED: Allow[] = [
  { file: 'app/admin/broadcasts/BroadcastsView.tsx', re: /Watch the video →/, why: 'verb (button label)' },
  { file: 'app/admin/winners/WinnersView.tsx', re: /Watch video →/, why: 'verb (button label)' },
  { file: 'lib/email/templates/AdminBroadcast.tsx', re: /Watch the video →/, why: 'verb (button label)' },
  { file: 'lib/email/templates/NotSelected.tsx', re: /Watch my entry/, why: 'verb (button label)' },
  { file: 'lib/email/templates/SelectedTop50.tsx', re: /Watch my entry/, why: 'verb (button label)' },
  { file: 'lib/email/templates/VideoLiveMain.tsx', re: /▶ Watch your film/, why: 'verb (button label)' },
  { file: 'lib/email/templates/VideoLivePrelim.tsx', re: /▶ Watch your film|Watch my video/, why: 'verb (button label)' },
  { file: 'lib/share-kit.ts', re: /Watch it and cast/, why: 'verb (share text)' },
  { file: 'lib/watch.ts', re: /Watch the main-round films/, why: 'verb (banner subtitle)' },
  { file: 'lib/admin-i18n.ts', re: /nav_watch: 'Watch'/, why: 'landing nav label kept as is (HQ 2026-10-07, option B)' },
  { file: 'lib/admin-i18n.ts', re: /watch_link: 'Watch the competition →'/, why: 'verb (link label)' },
  { file: 'lib/admin-i18n.ts', re: /Watch the main-round films/, why: 'verb (hero text)' },
  { file: 'lib/admin-i18n.ts', re: /lib_watchlater: 'Watch Later'/, why: 'feature name "Watch Later" (verb)' },
  { file: 'lib/chatbot-kb.ts', re: /Watch the finalists and vote/, why: 'verb (answer text)' },
]

const PENDING_SECOND_PASS: Allow[] = [
  { file: 'lib/email/templates/NotSelected.tsx', re: /공식 Watch에|official Watch/, why: 'email copy, Jenny3' },
  { file: 'lib/email/templates/SeasonWinnerAnnounced.tsx', re: /OXXOVO Watch/, why: 'email copy, Jenny3' },
]

function stripComments(src: string): string {
  // Block comments keep their newlines so line numbers stay right.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  // \r?\n: several source files are CRLF, and a trailing \r stops `.*$` from
  // matching, which left a whole comment line looking like text.
  return noBlock
    .split(/\r?\n/)
    .map((l) => l.replace(/(?<!:)\/\/.*$/, ''))
    .join('\n')
}

function walk(dir: string, out: string[]): void {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) out.push(p)
  }
}

const NAME = /(?<![A-Za-z_./-])(Watch|WATCH)(?![A-Za-z_-])/g

export function findNameHits(root: string, files: string[]): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = []
  for (const f of files) {
    const rel = relative(root, f).split(sep).join('/')
    const lines = stripComments(readFileSync(f, 'utf8')).split('\n')
    lines.forEach((text, i) => {
      NAME.lastIndex = 0
      if (!NAME.test(text)) return
      const allowed = [...VERB_ALLOWED, ...PENDING_SECOND_PASS].some((a) => a.file === rel && a.re.test(text))
      if (!allowed) hits.push({ file: rel, line: i + 1, text: text.trim().slice(0, 140) })
    })
  }
  return hits
}

test('no user-facing text names the retired surface (verbs and the pending email copy are the only exceptions)', () => {
  const root = process.cwd()
  const files: string[] = []
  walk(join(root, 'app'), files)
  walk(join(root, 'lib'), files)
  assert.ok(files.length > 200, 'sanity: the source tree was actually scanned')
  const hits = findNameHits(root, files)
  assert.deepEqual(hits, [], 'the old name is still used as a name here:\n' + hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n'))
})

test('control: the scanner does find a name, ignores a comment, and lets an allow-listed verb through', () => {
  const dir = join(process.cwd(), 'app', '__tmp_names_probe__')
  void dir // the probe below uses string input only; see stripComments + NAME directly
  const hit = (s: string) => {
    NAME.lastIndex = 0
    return NAME.test(stripComments(s))
  }
  assert.equal(hit("const a = 'Shown on Watch as the title'"), true)
  assert.equal(hit("const a = '지금 WATCH에 계십니다'"), true) // Korean glued to the word
  assert.equal(hit("// Watch is only a comment here"), false)
  assert.equal(hit("// Watch in a CRLF file\r\nconst a = 1\r\n"), false) // the NicknameCard.tsx case
  assert.equal(hit("const a = 1\r\nconst b = 'on Watch'\r\n"), true)
  assert.equal(hit("/* Watch\n spans lines */ const x = 1"), false)
  assert.equal(hit('const a = isWatchHome()'), false) // identifier
  assert.equal(hit("import { WatchShell } from './WatchShell'"), false)
  assert.equal(hit("href='https://x.example/a' // note"), false)
  assert.equal(hit("href='https://x.example/Watch' "), false) // path, not a name
  assert.equal(hit("label: 'Watch the video →'"), true) // the scanner flags it; the allow-list is what lets it through
})

test('the allow-lists name only lines that really exist (a stale entry would hide a regression)', () => {
  const root = process.cwd()
  for (const a of [...VERB_ALLOWED, ...PENDING_SECOND_PASS]) {
    const lines = stripComments(readFileSync(join(root, a.file), 'utf8')).split('\n')
    assert.ok(lines.some((l) => a.re.test(l)), `stale allow-list entry: ${a.file} ${a.re}`)
  }
})
