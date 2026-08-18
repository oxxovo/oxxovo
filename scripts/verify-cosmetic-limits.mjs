// TEMP verification script for lib/cosmetic-limits.ts (HQ 2026-08-19 combo-
// rule guard). Pure function only (evaluateCosmeticAxes) -- no DB needed,
// proves the AXIS COMBINATION logic itself: A blocks alone, A'/B/C need 2+ of
// the three, a single axis alone always passes, EXEMPT overrides everything.
// Each test sentence is picked to trip EXACTLY the axes named in its label --
// see the inline note on any sentence where that took care (substring
// matching means e.g. "rubs" also contains "rub").
// Run: node --import ./scripts/test-register.mjs scripts/verify-cosmetic-limits.mjs
import { evaluateCosmeticAxes } from '../lib/cosmetic-limits.ts'

const lists = {
  axisA: ['로션', 'lotion'],
  axisAPrime: ['세럼', 'serum', '크림', 'cream', '모이스처라이저', 'moisturizer', '에센스', 'essence', '앰플', 'ampoule', '스킨케어', 'skincare', 'skin care'],
  axisB: ['바르', '바름', '도포', 'apply', 'applying', 'applied', 'rub', 'smooth on'],
  axisC: ['얼굴', '안면', 'face', 'facial'],
  exempt: ['화장품', 'CF', 'cosmetic', 'commercial film', 'beauty', '#AICF', '#AIcommercial'],
}

let pass = 0, fail = 0
function check(label, text, expectBlocked) {
  const r = evaluateCosmeticAxes(text, lists)
  const ok = r.blocked === expectBlocked
  if (ok) { pass++; console.log(`  OK   [${expectBlocked ? 'BLOCK' : 'PASS '}] ${label}`) }
  else { fail++; console.log(`  FAIL [expected ${expectBlocked ? 'BLOCK' : 'PASS'}, got ${r.blocked ? 'BLOCK' : 'PASS'}] ${label}  hit=${JSON.stringify(r.hit)}`) }
}

console.log('-- Axis A alone blocks (no other axis needed) --')
check('lotion only (EN)', 'a bottle of lotion sits on the shelf', true)
check('로션 only (KO)', '테이블 위에 로션 한 병이 놓여 있다', true)

console.log('-- A single non-A axis alone PASSES (must stay usable vocabulary) --')
check('face only (axis C)', 'close-up of a face, cinematic lighting', false)
check('apply only (axis B)', 'he will apply for a visa next month', false)
check('cream only (axis A prime)', 'a bowl of whipped cream on the table', false)

console.log('-- Two of {A prime, B, C} together blocks --')
check('cream(A\') + face(C), no B', 'she has cream near her face', true)
check('serum(A\') + applying(B), no C', 'a hand applying serum to a bottle cap', true)
check('rub(B) + facial(C), no A\'', 'he starts to rub near his facial hair', true)

console.log('-- All three (A prime + B + C) blocks --')
check('cream + rubs(contains rub) + face', 'a woman rubs cream onto her face in the mirror', true)

console.log('-- EXEMPT overrides everything, even axis A alone --')
check('lotion + #AICF exempt', '#AICF a lotion commercial, product hero shot', false)
check('cream + rub + face + cosmetic exempt', 'a cosmetic commercial: she rubs cream onto her face', false)

console.log('-- Clean prompt, zero axis hits --')
check('totally unrelated prompt', 'a dragon flying over a neon city at night', false)

console.log('-'.repeat(70))
console.log(`RESULT: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
