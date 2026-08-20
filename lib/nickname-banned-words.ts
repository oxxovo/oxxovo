// Banned-word gate for participant nicknames (profiles.display_name).
// Separate list from faq-banned-words.ts by design -- each surface owns its
// own list, per the precedent set there (backlog #47). A nickname burned into
// OXXOVO's own promo videos ("by {nickname}") needs a HARD block, not the
// FAQ pattern's overridable warning: this is a self-serve save with no admin
// review step in between.
//
// THREE SEPARATE RULES (제니3 2026-08-19 -- do not collapse into one check,
// each has a different failure mode if merged):
//   1. General banned words (profanity/sexual/hate) -- WORD-BOUNDARY match.
//      Substring matching false-positives on real names/words that merely
//      CONTAIN a banned fragment (e.g. "성" inside "안성재") -- and a false
//      positive here blocks a real signup, which is the worse failure.
//   2. Impersonation / AI-actor names (e.g. "oxxovo") -- SUBSTRING match.
//      "OXXOVO_KIRA" must be caught, so word-boundary is wrong here on
//      purpose -- the opposite tradeoff from rule 1.
//   3. Lookalike-character normalization, applied BEFORE either check above
//      (0<->o, 1/l/I interchangeable, 3<->e, 5<->s, @<->a), so "0xx0vo"
//      still hits rule 2. Note: '*' and other punctuation are not part of
//      this table because validateNickname's charset (letters/digits/space/
//      ._-) already makes "f*ck"-style masking impossible to type in the
//      first place -- nothing to normalize there.
//
// General list ships empty until 제니3 supplies words via 본부 (platform_config
// value, not code -- same "ships empty" contract as faq-banned-words.ts).
// Impersonation list starts with a hardcoded floor (oxxovo/옥소보 itself --
// TK 2026-08-19: self-impersonation isn't an operational judgment call, it is
// always banned) and 제니3's platform_config additions (AI-actor names etc.)
// merge on top of that floor, never replace it.

import { getPlatformConfigMap } from './partners'

const GENERAL_KEY = 'nickname_banned_words_general'
const IMPERSONATION_KEY = 'nickname_banned_words_impersonation'

// Always-on floor, independent of platform_config -- see header.
const IMPERSONATION_FLOOR = ['oxxovo', '옥소보']

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

export async function loadNicknameBannedWordLists(): Promise<{ general: string[]; impersonation: string[] }> {
  const cfg = await getPlatformConfigMap()
  const general = parseList(cfg.get(GENERAL_KEY) as string | undefined)
  const impersonation = [
    ...IMPERSONATION_FLOOR,
    ...parseList(cfg.get(IMPERSONATION_KEY) as string | undefined),
  ]
  return { general, impersonation }
}

// Lookalike-character normalization (rule 3): substitute BEFORE lowercasing,
// so capital 'I' (a genuine 1/l/I lookalike per 제니3) can be told apart from
// lowercase 'i' (the ordinary dotted letter, NOT part of this lookalike set
// in most fonts) -- doing this after lowercasing would conflate the two and
// corrupt every ordinary word containing the letter i.
const LOOKALIKE_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  I: 'l',
  '3': 'e',
  '5': 's',
  '@': 'a',
}
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE_MAP).join('')}]`, 'g')

export function normalizeLookalikes(text: string): string {
  return text.replace(LOOKALIKE_RE, (ch) => LOOKALIKE_MAP[ch]).toLowerCase()
}

// Rule 1: word-boundary match. \p{L}/\p{N} (not ASCII \b) so this is correct
// for Hangul too -- a Hangul syllable block is one \p{L} character, so
// "성" inside "안성재" has \p{L} neighbors on both sides and does NOT match.
// Exported (pure, no I/O) so this exact rule is unit-testable without a DB.
export function matchesWholeWord(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
  return re.test(haystack)
}

// Rule 2: substring match (deliberately looser than rule 1 -- see header).
export function matchesSubstring(haystack: string, term: string): boolean {
  return haystack.includes(term.toLowerCase())
}

/** Hard-block check: any match (either rule) means the caller must refuse the save. */
export async function nicknameContainsBannedWord(value: string): Promise<boolean> {
  const { general, impersonation } = await loadNicknameBannedWordLists()
  const normalized = normalizeLookalikes(value)
  if (general.some((w) => matchesWholeWord(normalized, normalizeLookalikes(w)))) return true
  if (impersonation.some((w) => matchesSubstring(normalized, normalizeLookalikes(w)))) return true
  return false
}
