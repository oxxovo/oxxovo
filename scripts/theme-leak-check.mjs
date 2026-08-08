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
const BANNED = [
  '화장품', '코스메틱', '코스메', '스킨케어', '스킨 케어', '뷰티', '메이크업', '립스틱',
  'cosmetic', 'cosmetics', 'skincare', 'skin care', 'makeup', 'make-up', 'lipstick',
  // ad-format words: the theme is a COMMERCIAL, so naming the format leaks it too
  '광고', 'CF', 'commercial',
]

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

const findings = []
for (const file of walk(SCOPE)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (isComment(line)) return
    let probe = line
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

console.log(`\n═══ theme leak check | scope=app/studio/** | ${BANNED.length} terms ═══`)
if (findings.length === 0) {
  console.log('  PASS  no product-category / industry / ad-format word in a participant-facing string\n')
  process.exit(0)
}
for (const f of findings) {
  console.log(`  FAIL  ${f.file}:${f.line}  ★"${f.term}"\n        ${f.text}`)
}
console.log(
  `\n  ${findings.length} leak(s). The main-round theme must not be inferable from Studio, which\n` +
    '  participants use BEFORE any reveal. Use a genre, a mood, or a camera behaviour\n' +
    '  instead of a product type, an industry, or an ad format.\n',
)
process.exit(1)
