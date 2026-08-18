// Cosmetic/skincare-application prompt guard (HQ 2026-08-19). SERVER ONLY.
//
// Not a flat banned-word list -- a RULE, because a flat list can't express
// this one without banning ordinary prompts. "face" and "apply" and "cream"
// each show up in completely unrelated, legitimate prompts on their own; the
// thing actually being avoided is a prompt that reads as product application
// to a face. So:
//
//   Axis A      (direct product name, e.g. lotion)      -- blocks ALONE.
//   Axis A'     (product-adjacent: serum, cream, ...)  \
//   Axis B      (application action: apply, rub, ...)   | any 2+ of these
//   Axis C      (body part: face, facial)               / three block.
//   EXEMPT      (cosmetic/CF/#AICF, ...)  -- present ANYWHERE, overrides
//               every match above (a knowing cosmetic-CF prompt, not a
//               dodge).
//
// A single axis alone (just "face", just "apply", just "cream") PASSES --
// blocking any one of these alone leaves no usable prompt vocabulary
// ("close-up of a face" must stay legal).
//
// Lists live in platform_config (5 keys, no-deploy tunable), same JSON-or-
// comma/newline parse as text-limits.ts / music-limits.ts / faq-banned-words.ts
// -- JSON is required for any term containing a comma. HQ 2026-08-19: an
// empty list is a PASS, not a block, so the code deploy and the SQL that
// populates these 5 keys must ship together -- shipping code alone with
// empty lists makes the guard decorative.

import 'server-only'
import { getPlatformConfigMap } from './partners'

export type CosmeticCheckResult = {
  blocked: boolean
  hit: string[]
  blockMessage: string | null
}

export type CosmeticAxisLists = {
  axisA: string[]
  axisAPrime: string[]
  axisB: string[]
  axisC: string[]
  exempt: string[]
}

const KEYS = {
  axisA: 'cosmetic_guard_axis_a',
  axisAPrime: 'cosmetic_guard_axis_a_prime',
  axisB: 'cosmetic_guard_axis_b',
  axisC: 'cosmetic_guard_axis_c',
  exempt: 'cosmetic_guard_exempt',
} as const

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
  } catch {
    /* not JSON -- fall through to delimiter split */
  }
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

function hitsIn(text: string, terms: readonly string[]): string[] {
  const hay = text.toLowerCase()
  return terms.filter((t) => t && hay.includes(t.toLowerCase()))
}

function blockMessageFor(hit: string[]): string {
  // TEMP wording -- 제니3 확정 전 (mirrors ip-check.ts's own TEMP-message stance).
  return `[TEMP] 프롬프트가 화장품/스킨케어 제품 사용 장면으로 보입니다 (${hit.join(', ')}). 화장품 CF/커머셜 맥락이면 프롬프트에 cosmetic, CF, #AICF 같은 표시를 추가해 주세요.`
}

/**
 * Pure rule: axis A blocks alone; A'/B/C block only when 2+ of the three are
 * present; an EXEMPT hit anywhere overrides everything. Exported directly so
 * it's testable/reusable without a DB round-trip.
 */
export function evaluateCosmeticAxes(text: string, lists: CosmeticAxisLists): CosmeticCheckResult {
  const t = text ?? ''
  if (hitsIn(t, lists.exempt).length > 0) return { blocked: false, hit: [], blockMessage: null }

  const aHits = hitsIn(t, lists.axisA)
  if (aHits.length > 0) return { blocked: true, hit: aHits, blockMessage: blockMessageFor(aHits) }

  const aPrimeHits = hitsIn(t, lists.axisAPrime)
  const bHits = hitsIn(t, lists.axisB)
  const cHits = hitsIn(t, lists.axisC)
  const axesPresent = [aPrimeHits, bHits, cHits].filter((h) => h.length > 0).length
  if (axesPresent >= 2) {
    const hit = [...aPrimeHits, ...bHits, ...cHits]
    return { blocked: true, hit, blockMessage: blockMessageFor(hit) }
  }

  return { blocked: false, hit: [], blockMessage: null }
}

/**
 * Reads the 5 lists from platform_config and evaluates in one call -- mirrors
 * checkPromptForIp()'s self-contained shape so the studio.ts call sites (t2v/
 * t2i/i2v, alongside checkPromptForIp) look the same for both checks.
 */
export async function checkPromptForCosmetic(promptText: string): Promise<CosmeticCheckResult> {
  const text = (promptText ?? '').trim()
  if (!text) return { blocked: false, hit: [], blockMessage: null }

  const cfg = await getPlatformConfigMap()
  const lists: CosmeticAxisLists = {
    axisA: parseList(cfg.get(KEYS.axisA) as string | undefined),
    axisAPrime: parseList(cfg.get(KEYS.axisAPrime) as string | undefined),
    axisB: parseList(cfg.get(KEYS.axisB) as string | undefined),
    axisC: parseList(cfg.get(KEYS.axisC) as string | undefined),
    exempt: parseList(cfg.get(KEYS.exempt) as string | undefined),
  }
  return evaluateCosmeticAxes(text, lists)
}
