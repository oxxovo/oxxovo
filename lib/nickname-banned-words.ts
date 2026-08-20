// Banned-word gate for participant nicknames (profiles.display_name).
// Separate list from faq-banned-words.ts by design -- each surface owns its
// own list, per the precedent set there (backlog #47). A nickname burned into
// OXXOVO's own promo videos ("by {nickname}") needs a HARD block, not the
// FAQ pattern's overridable warning: this is a self-serve save with no admin
// review step in between.
//
// Same "ships empty" contract as faq-banned-words.ts: PLATFORM_CONFIG VALUE,
// NOT CODE. Until 제니3 supplies words via 본부, the key is absent and the
// check finds nothing to match -- nicknames still save normally.

import { getPlatformConfigMap } from './partners'
import { findBannedWords } from './faq-banned-words'

const NICKNAME_BANNED_WORDS_KEY = 'nickname_banned_words'

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

export async function loadNicknameBannedWords(): Promise<string[]> {
  const cfg = await getPlatformConfigMap()
  return parseList(cfg.get(NICKNAME_BANNED_WORDS_KEY) as string | undefined)
}

/** Hard-block check: any match means the caller must refuse the save. */
export async function nicknameContainsBannedWord(value: string): Promise<boolean> {
  const words = await loadNicknameBannedWords()
  if (words.length === 0) return false
  return findBannedWords(value, words).length > 0
}
