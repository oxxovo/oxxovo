// Banned-word gates for admin-authored FAQ content (app/admin/faq). Design:
// reports/admin_faq_editor_design_2026-08-12.md, gate ③/④. TWO separate
// lists, different consequence:
//
//   faq_banned_words_warning      -- ANY save. Shown as a confirm-to-override
//                                     warning, never a hard block.
//   faq_banned_words_period_block -- Only checked when an item is being
//                                     turned is_active=true AND
//                                     now() < getThemeRevealTime(season).
//                                     HARD refusal, not overridable, and
//                                     stops mattering the moment the reveal
//                                     time passes -- no separate unlock step.
//
// ★BOTH LISTS ARE PLATFORM_CONFIG VALUES, NOT CODE. 제니3 supplies the actual
// words via 본부; until that lands, the config keys are simply absent and
// both checks find nothing to match against -- the feature ships functional
// with an empty list, not blocked waiting for content ([[feedback-absent-is-
// not-zero]] does not apply here the same way it does to a score or a licence
// term: an empty banned-word list is a legitimate "nothing banned yet" state,
// not a missing measurement).
//
// Stored as value_type='text', either a JSON array or a comma/newline-
// separated list (same flexible parse as text-limits.ts's
// parseTrademarkBlocklist) -- JSON is REQUIRED for any term that itself
// contains a comma (e.g. "$250,000"), since plain comma-splitting would
// break it into "$250" + "000".

import { getPlatformConfigMap } from './partners'

const WARNING_KEY = 'faq_banned_words_warning'
const PERIOD_BLOCK_KEY = 'faq_banned_words_period_block'

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
  } catch {
    /* not JSON -- fall through to delimiter split */
  }
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface FaqBannedWordLists {
  warning: string[]
  periodBlock: string[]
}

export async function loadFaqBannedWordLists(): Promise<FaqBannedWordLists> {
  const cfg = await getPlatformConfigMap()
  return {
    warning: parseList(cfg.get(WARNING_KEY) as string | undefined),
    periodBlock: parseList(cfg.get(PERIOD_BLOCK_KEY) as string | undefined),
  }
}

/** Every listed word found in `text` (case-insensitive substring match, same
 *  style as music-grid.ts's findBannedTerm). Empty list -> always []. */
export function findBannedWords(text: string, words: readonly string[]): string[] {
  const hay = text.toLowerCase()
  return words.filter((w) => w && hay.includes(w.toLowerCase()))
}
