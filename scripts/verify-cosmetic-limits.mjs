// TEMP verification script for lib/cosmetic-limits.ts (HQ 2026-08-19 combo-
// rule guard). Pure function only (evaluateCosmeticAxes) -- no DB needed,
// proves the AXIS COMBINATION logic itself: A blocks alone, A'/B/C need 2+ of
// the three, a single axis alone always passes, EXEMPT overrides everything.
// Each test sentence is picked to trip EXACTLY the axes named in its label --
// see the inline note on any sentence where that took care (substring
// matching means e.g. "rubs" also contains "rub").
// Run: node --import ./scripts/test-register.mjs scripts/verify-cosmetic-limits.mjs
import { evaluateCosmeticAxes } from '../lib/cosmetic-limits.ts'

// 2026-08-19: TK entered `cosmetic_guard_exempt` as [] in prod, NOT the 7-term
// list this script used to test with -- entering real exempt words made the
// "matched anywhere overrides everything" rule defeat the guard on the exact
// sentence it exists to block ("화장품 광고에서 얼굴에 로션을 바르는 장면" --
// "화장품" is an exempt word, so it nullified the axis-A lotion hit). TK's
// fix: exemption is achieved by these words being ABSENT from the axis lists
// (i.e. the block list itself never uses "화장품"/"CF" as a trigger term),
// not by a runtime override. This lists block matches the 5 platform_config
// values actually in prod as of 2026-08-19.
const lists = {
  axisA: ['로션', 'lotion'],
  axisAPrime: ['세럼', 'serum', '크림', 'cream', '모이스처라이저', 'moisturizer', '에센스', 'essence', '앰플', 'ampoule', '스킨케어', 'skincare', 'skin care'],
  axisB: ['바르', '바름', '도포', 'apply', 'applying', 'applied', 'rub', 'smooth on'],
  axisC: ['얼굴', '안면', 'face', 'facial'],
  exempt: [],
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

console.log('-- EXEMPT is [] in prod -- these words no longer override anything --')
check('lotion + #AICF (no longer exempt)', '#AICF a lotion commercial, product hero shot', true)
check('cream + rub + face + cosmetic (no longer exempt)', 'a cosmetic commercial: she rubs cream onto her face', true)

console.log('-- Empty EXEMPT list must not be read as "exempt everything" (HQ 2026-08-19 check 1) --')
check('empty exempt list does not blanket-pass axis A', 'a bottle of lotion sits on the shelf', true)

console.log('-- HQ 2026-08-19 check 2: the exact sentence the guard exists to catch --')
check('화장품 광고 + 로션(A) + 얼굴(C) -- the target sentence', '화장품 광고에서 얼굴에 로션을 바르는 장면', true)

console.log('-- Clean prompt, zero axis hits --')
check('totally unrelated prompt', 'a dragon flying over a neon city at night', false)

console.log('-'.repeat(70))
console.log(`RESULT: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
