// Main-round theme leak guard for the PRE-REVEAL participant surface.
//
//   npm run test:theme-leak
//
// ★WHY A CHECK AND NOT A SWEEP. The rule ("no product category / industry words
// in participant-facing text") was issued for the 300-song music labels, and when
// it was applied to the labels the SAME leak was already sitting in two shipped
// strings nobody was looking at: the AI-music prompt example ('화장품 광고' /
// 'for a skincare ad') and the camera-preset group pill ('뷰티/제품' /
// 'Beauty/Product'). A one-time sweep fixes those two and protects nothing. This
// fails the build instead.
//
// SCOPE = app/studio/** only, and that scope is the whole argument. The theme
// label is legitimately PUBLIC later: seasons.main_round_theme_label is rendered
// on /watch from the "Judging Complete" stage onward (lib/watch.ts stage machine),
// so a repo-wide ban would be wrong and would be deleted by the first person it
// annoyed. Studio is where participants work DURING the application round, before
// any reveal -- that is the surface where the theme must not appear, and it is the
// surface this guards.
//
// Comment lines are skipped on purpose: the fix commits explain what the banned
// words were, so the explanation must be allowed to name them.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SCOPE = join(ROOT, 'app', 'studio')

// Product categories / industries / ad-format words. The main-round theme is a
// cosmetics commercial film, so these are the words that give it away.
// APPEND-ONLY in spirit: adding a term can only make the guard stricter.
// ★RECONCILED WITH THE WORKER'S LIST 2026-08-08, when the grid vocabulary was
// confirmed (제니3 asked for the two to be compared). src/music-grid.ts guards the DATA
// that becomes UI text; this guards the UI text. Neither is a superset of the other, so
// both grew:
//   here <- worker : 'beauty' (English -- only '뷰티' was banned, so an English
//                    string would have passed), and 'ad'
//   both  <- new   : '제품' / 'product' / '커머셜'. The camera-preset pill that
//                    started this rule literally read '뷰티/제품' -- the fix shipped,
//                    but '제품' was never actually BANNED, so the regression was free.
// ★'luxury' / '럭셔리' ADDED 2026-08-09 (head office), and it is the SAME SHAPE as
// '제품' was. 제니3 refused 'luxury' as a grid label on 2026-08-08 (a product-GRADE
// word implies an industry) and replaced it with 'elegant' -- but refusing one
// candidate label is not a rule, so nothing stopped the next person proposing it
// again, in a preset name, a tag, a filename or a seeder string. A decision that
// lives only in the minutes of the meeting that made it regresses for free.
const BANNED = [
  '화장품', '코스메틱', '코스메', '스킨케어', '스킨 케어', '뷰티', '메이크업', '립스틱',
  'cosmetic', 'cosmetics', 'skincare', 'skin care', 'makeup', 'make-up', 'lipstick', 'beauty',
  // product-category words: naming the product type leaks the theme as surely as
  // naming the industry does.
  '제품', 'product',
  // product-GRADE words: a grade implies the kind of thing being graded.
  'luxury', '럭셔리', '명품',
  // ad-format words: the theme is a COMMERCIAL, so naming the format leaks it too
  '광고', 'CF', 'commercial', '커머셜', 'ad',
]

// ★'브랜드' / 'brand' ARE NOT HERE, though head office named them. Measured against
// the real strings first, and both live uses are legitimate:
//   - the trademark refusal has to SAY it ('상표·브랜드명은 사용할 수 없어요' /
//     'Trademarks / brand names are not allowed') -- banning the word deletes the one
//     sentence that tells a participant what they did wrong;
//   - `brand: 'OXXOVO'` is the logo's alt text: our own name, not a product category.
// Neither lets anyone infer a cosmetics commercial, which is what this list is for. A
// ban suppressed at both of its real call sites is a ban the next person deletes, so it
// is reported to 제니2 rather than added and worked around.

// Allowed because they are not the leak:
//  - `preset_group_beauty` / `group_id === 'beauty'` are INTERNAL keys, never
//    rendered. The DB column is `group_id='beauty'` and renaming it is a DB write
//    (head office), so the code has to keep matching it.
const ALLOWED_SUBSTRINGS = [
  'preset_group_beauty',
  "'beauty'",
  '"beauty"',
  'group_id',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

// A line is skipped when it is a comment. Crude on purpose: a block-comment body
// in this codebase is either `//`-prefixed or ` * `-prefixed, and being slightly
// over-permissive about comments cannot hide a leak in a STRING (a rendered
// string and a comment do not share a line in this codebase's style).
const isComment = (line) => {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

// ★A TRAILING comment is the same class as a whole-line one, and it became load-bearing
// when '제품'/'product' were added: the line that FIXED the original leak is
//     preset_group_beauty: 'Elegant', // mood, not a product category -- see the KO note
// which is a code line whose comment has to name the banned word to explain itself. The
// fix's own explanation must not fail the guard that fix exists for.
// `(?<!:)//` so a URL's `https://` is left alone; the terms are what we scan for, and a
// banned word inside a URL would still be caught because only the comment is removed.
const stripTrailingComment = (line) => line.replace(/(?<!:)\/\/.*$/, '')

const findings = []
for (const file of walk(SCOPE)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (isComment(line)) return
    let probe = stripTrailingComment(line)
    for (const ok of ALLOWED_SUBSTRINGS) probe = probe.split(ok).join('')
    for (const term of BANNED) {
      // whole-word for the short ASCII ones so 'CF' does not match 'CFG' and
      // 'commercial' does not need it; CJK terms have no word boundaries.
      const hit = /^[A-Za-z-]+$/.test(term)
        ? new RegExp(`\\b${term.replace(/-/g, '\\-')}\\b`, 'i').test(probe)
        : probe.includes(term)
      if (hit) findings.push({ file: relative(ROOT, file), line: i + 1, term, text: line.trim().slice(0, 120) })
    }
  })
}

let failed = false

console.log(`\n═══ theme leak check | scope=app/studio/** | ${BANNED.length} terms ═══`)
if (findings.length === 0) {
  console.log('  PASS  no product-category / industry / ad-format word in a participant-facing string\n')
} else {
  failed = true
  for (const f of findings) {
    console.log(`  FAIL  ${f.file}:${f.line}  ★"${f.term}"\n        ${f.text}`)
  }
  console.log(
    `\n  ${findings.length} leak(s). The main-round theme must not be inferable from Studio, which\n` +
      '  participants use BEFORE any reveal. Use a genre, a mood, or a camera behaviour\n' +
      '  instead of a product type, an industry, or an ad format.\n',
  )
}

// ★PART 2 (added 2026-08-21, HQ). Everything above is a static grep over app/studio/**
// SOURCE. It cannot see a leak that lives in DATA, not code -- which is exactly how the
// real one got past it: seasons_public.main_round_theme_label ("Cosmetic Commercial
// Film") sat on the anon-readable view and was fetchable via a plain PostgREST call,
// with zero source-code string anywhere to grep for. This part hits the SAME public
// REST endpoint any visitor's browser can reach (the anon key is NEXT_PUBLIC_* -- it
// ships to every client bundle already, so querying it here is not a new exposure) and
// scans the actual response for the same banned vocabulary. Network/env failures WARN
// instead of failing the build: this check is only meaningful against the real deployed
// view, and an offline/local run without prod env has nothing to say about that.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log(`\n═══ theme leak check | PART 2: public API response (seasons_public) ═══`)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('  WARN  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set -- skipped\n')
} else {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seasons_public?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
    if (!res.ok) {
      console.log(`  WARN  fetch failed (${res.status}) -- skipped\n`)
    } else {
      const rows = await res.json()
      const apiFindings = []
      for (const row of rows) {
        for (const [col, val] of Object.entries(row)) {
          const s = typeof val === 'string' ? val : JSON.stringify(val ?? '')
          for (const term of BANNED) {
            const hit = /^[A-Za-z-]+$/.test(term)
              ? new RegExp(`\\b${term.replace(/-/g, '\\-')}\\b`, 'i').test(s)
              : s.includes(term)
            if (hit) apiFindings.push({ id: row.id, col, term, text: s.slice(0, 120) })
          }
        }
      }
      if (apiFindings.length === 0) {
        console.log('  PASS  no banned term in any seasons_public column, any row\n')
      } else {
        for (const f of apiFindings) console.log(`  FAIL  seasons_public row=${f.id} column="${f.col}"  ★"${f.term}"\n        ${f.text}`)
        console.log(`\n  ${apiFindings.length} live API leak(s). Remove the column from seasons_public (or null the\n  value) -- see reports/seasons_public_main_round_theme_removal_2026-08-17.sql for the pattern.\n`)
        failed = true
      }
    }
  } catch (e) {
    console.log(`  WARN  ${e.message} -- skipped\n`)
  }
}

// process.exitCode (not process.exit()) -- a forced exit() right after an
// undici fetch() can race the socket handle's close and crash on Windows
// (libuv assertion in async.c). Setting exitCode lets Node drain naturally.
process.exitCode = failed ? 1 : 0
