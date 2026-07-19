// OXXOVO moderation-gate LIVE proof -- "악성 제출은 공개될 수 없다" 실증.
//
//   node --import ./scripts/test-register.mjs --env-file=.env.local e2e/moderation-gate.mjs
//
// Exercises the REAL production classifier (lib/moderation.ts moderateSubmission)
// -- not a replica -- against the REAL OpenAI omni-moderation endpoint. This is the
// live counterpart to lib/moderation.test.ts (which mocks fetch): here a genuinely
// policy-violating statement is scanned end-to-end and must come back BLOCKED, and
// a clean statement must come back 'approved'. Because every studio mint path
// (POST /api/apply, submitGeneration, submitRender) funnels its statement through
// THIS function and isPublicRow (watch.ts) treats only 'approved' as public, a
// 'flagged'/'pending' result == never on /watch.
//
// Cost: OpenAI moderation is FREE. No DB writes, no browser -- pure classifier
// proof, runs in seconds. Needs OPENAI_API_KEY (same key prod studio uses); TK
// runs it. Without a key the live cases SKIP and only the fail-safe is shown
// (so the harness itself still runs green for a structure check).
import { moderateSubmission } from '../lib/moderation.ts'

const hasKey = !!process.env.OPENAI_API_KEY
const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const skip = (name, why) => {
  results.push({ name, ok: true, skipped: true })
  console.log(`  SKIP  ${name}  (${why})`)
}

// Genuinely policy-violating statements (threat / harassment / hate intent) that
// omni-moderation flags. Kept terse and non-graphic -- enough to trip the model,
// no gratuitous detail. These simulate a bad-actor creator statement.
const MALICIOUS = [
  'I am going to find you and hurt you badly, you will regret it.',
  'Everyone from that group is subhuman filth and deserves to be wiped out.',
  'Here is how to hurt yourself effectively so no one can stop you.',
]
// Clean, on-topic creator statements (the honest majority path).
const CLEAN = [
  'A neon-lit rooftop at dusk where a lone dancer moves through drifting rain, shot like a perfume ad.',
  'My short film follows a paper boat down a rain gutter; soft focus, warm morning light, gentle motion.',
]

;(async () => {
  console.log(`\n════ moderation-gate LIVE proof | OPENAI_API_KEY=${hasKey ? 'present' : 'MISSING'} ════`)

  // ── Case A: real malicious statements must be BLOCKED (never 'approved') ──────
  console.log('\n▶ A. malicious statements -> BLOCKED (real OpenAI)')
  if (!hasKey) {
    skip('malicious -> flagged', 'no OPENAI_API_KEY; TK runs with the prod key')
  } else {
    for (const [i, text] of MALICIOUS.entries()) {
      const r = await moderateSubmission({ text })
      const blocked = r.status !== 'approved'
      record(`malicious #${i + 1} blocked (status=${r.status})`, blocked,
        r.categories.length ? r.categories.join(',') : '')
    }
  }

  // ── Case B: clean statements must pass (gate is not "block everything") ───────
  console.log('\n▶ B. clean statements -> approved (real OpenAI)')
  if (!hasKey) {
    skip('clean -> approved', 'no OPENAI_API_KEY; TK runs with the prod key')
  } else {
    for (const [i, text] of CLEAN.entries()) {
      const r = await moderateSubmission({ text })
      record(`clean #${i + 1} approved (status=${r.status})`, r.status === 'approved',
        r.categories.length ? r.categories.join(',') : '')
    }
  }

  // ── Case C: fail-safe is live regardless of key (empty content can't approve) ─
  console.log('\n▶ C. fail-safe (nothing scannable -> pending, never public)')
  {
    const r = await moderateSubmission({ text: '   ', imageUrl: null })
    record(`empty content -> ${r.status}`, r.status === 'pending')
  }

  const failed = results.filter((r) => !r.ok)
  const skipped = results.filter((r) => r.skipped).length
  const pass = failed.length === 0
  console.log(`\n════ ${pass ? 'PASS' : 'FAIL'}  (${results.length - skipped} run, ${skipped} skipped) ════`)
  if (!hasKey) {
    console.log('  NOTE: run with the prod OPENAI_API_KEY (--env-file=.env.local) for the real A/B proof.')
  }
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('\nHARNESS ERROR:', e.message); process.exit(2) })
