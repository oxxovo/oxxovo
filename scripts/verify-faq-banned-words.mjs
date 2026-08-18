// TEMP verification script (HQ 2026-08-19): proves loadFaqBannedWordLists() +
// findBannedWords() actually MATCH Korean text from the live platform_config
// row TK re-saved with literal Korean (not the earlier \uXXXX-escaped SQL,
// which stored the escape sequences as literal text -- Postgres does not
// unescape \u sequences inside a plain text column, only inside an actual
// JSON/JSONB value or a client-side JSON.parse). Read-only, no writes.
// Run: node --import ./scripts/test-register.mjs scripts/verify-faq-banned-words.mjs
import { loadFaqBannedWordLists, findBannedWords } from '../lib/faq-banned-words.ts'

function line(s) { console.log(s) }
function hr() { console.log('-'.repeat(70)) }
let pass = 0, fail = 0
function check(label, ok, detail) {
  if (ok) { pass++; line(`  OK   ${label}`) }
  else { fail++; line(`  FAIL ${label}  ${detail ?? ''}`) }
}

hr()
line('1) load lists from platform_config (live)')
hr()
const lists = await loadFaqBannedWordLists()
line(`  warning list (${lists.warning.length} terms): ${JSON.stringify(lists.warning)}`)
line(`  periodBlock list (${lists.periodBlock.length} terms): ${JSON.stringify(lists.periodBlock)}`)
check('warning list is non-empty', lists.warning.length > 0, `got ${lists.warning.length}`)
check(
  'warning list contains the literal Korean string "탈락" (not an escape sequence)',
  lists.warning.includes('탈락'),
  `list: ${JSON.stringify(lists.warning)}`,
)
check(
  'no entry is a raw \\u escape sequence (the earlier bug pattern)',
  !lists.warning.some((w) => /\\u[0-9a-fA-F]{4}/.test(w)),
  `list: ${JSON.stringify(lists.warning)}`,
)

hr()
line('2) findBannedWords() against a realistic admin-authored FAQ answer')
hr()
{
  const combined = [
    'Q. 본선에 진출하지 못하면 어떻게 되나요?',
    'A. 아쉽게도 이번 시즌 결선에는 오르지 못했습니다. 탈락 처리된 분들도 다음 시즌에 다시 도전하실 수 있습니다.',
  ].join('\n')
  const hits = findBannedWords(combined, lists.warning)
  line(`  input: ${JSON.stringify(combined)}`)
  line(`  hits: ${JSON.stringify(hits)}`)
  check('flags "탈락"', hits.includes('탈락'), JSON.stringify(hits))
  check('flags "아쉽게도" (substring of "아쉽게" entry)', hits.some((h) => '아쉽게도'.includes(h)), JSON.stringify(hits))
  check('flags "결선"', hits.includes('결선'), JSON.stringify(hits))
}

hr()
line('3) clean text -- no false positive')
hr()
{
  const combined = [
    'Q. What is OXXOVO?',
    'A. OXXOVO is a platform where AI creators compete in theme-based video tournaments, using tools built into OXXOVO Studio.',
  ].join('\n')
  const hits = findBannedWords(combined, lists.warning)
  check('no hits on clean copy', hits.length === 0, JSON.stringify(hits))
}

hr()
line('4) AI vendor name + sealed prize figure (comma-containing term)')
hr()
{
  const combined = 'A. This season uses Kling for generation, with a prize pool of up to $250,000.'
  const hits = findBannedWords(combined, lists.warning)
  line(`  hits: ${JSON.stringify(hits)}`)
  check('flags "Kling"', hits.includes('Kling'), JSON.stringify(hits))
  check(
    'flags the comma-containing "up to $250,000" or "$250,000" term intact',
    hits.some((h) => h.includes('250,000')),
    JSON.stringify(hits),
  )
}

hr()
line(`RESULT: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
