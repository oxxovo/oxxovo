// Token resolver for the chatbot/inbound-email knowledge base (lib/chatbot-kb.ts).
// Same shape as lib/faq-tokens.ts (allowlist + resolveXText), separate file
// because the token SET differs -- the chatbot needs schedule milestones the
// FAQ page never shows (prelim publish, main publish, results dates), and it
// needs a `now` token the FAQ page has no use for.
//
// ★HQ 2026-08-30: PT only, no Korean-time bilingual (withKst:false) --
// "the tournament runs on PT, the DB is PT, two standards drift apart."
// fullTzLabel:true so the label reads "미국 서부 시간" / "US Pacific Time",
// not the bare "PT" abbreviation -- this text is read out of context (a
// system prompt, an email), unlike the on-page UI's compact "PT" suffix.
//
// ★ABSENT IS NOT A BLANK ([[feedback-absent-is-not-zero]]). A token that
// cannot resolve returns null; resolveChatbotText's contract is: null
// anywhere in an entry -> that whole Q&A entry is dropped from the prompt,
// never rendered with a blank or a literal "{{token}}" showing. This is
// deliberately closer to the FAQ page than to a plain string-replace: an
// LLM shown "{{application_open}}" verbatim would likely just repeat it back
// to a user, which is worse than the fact being silently absent.

import { formatDeadlinePT, advanceCountLabel, type Season, type ThemeDisplay } from './seasons'

// ★Deliberately NOT the full MembershipLandingData (app/membership/types.ts)
// -- that type carries per-visitor personalization (signedIn, isActiveCreator)
// sourced from the request's cookies, which this context has no business
// depending on: the chatbot's facts are the same for every visitor. Only the
// platform-wide fields it actually quotes.
export type ChatbotMembership = {
  price: number | null
  interval: string
  founding: { cap: number }
}

export const CHATBOT_TOKENS = [
  'now', // "today" in PT -- system-prompt grounding, not a season fact
  'application_open',
  'application_close', // registration_close_at -- matches FAQ_TOKENS' meaning
  'prelim_submit_close', // application_close_at -- the video hard-cut
  'prelim_results',
  'main_round_start',
  'voting_open',
  'voting_close',
  'winners_announced',
  'first_ranking_date', // platform_config.championship_points_reveal_at
  'prize_pool',
  'prize_first',
  'prize_second',
  'prize_third',
  'membership_price',
  'founding_cap',
  'video_length_range', // prelim
  'main_round_video_length_range',
  'aspect_ratio',
  'intent_weight',
  'execution_weight',
  'originality_weight',
  'advance_label',
  'min_participants',
  'max_postponements',
  'floor_participants', // absolute_min_participants -- E6's "final floor"
  // ★Both fail-closed to null until getRevealedTheme() says the reveal has
  // actually happened -- the ONE gate every other surface (Watch/Studio/
  // profile) reads through (lib/seasons-theme.ts). Never resolved from
  // anything else, and never guessed when twistRevealed is false.
  'main_theme',
  'required_element',
] as const

export type ChatbotToken = (typeof CHATBOT_TOKENS)[number]

export interface ChatbotTokenContext {
  season: Season
  membership: ChatbotMembership | null
  championshipRevealAt: string | null // platform_config.championship_points_reveal_at
  revealedTheme: ThemeDisplay // lib/seasons-theme.ts getRevealedTheme() -- already fail-closed
  now: Date
}

const usd = (n: unknown): string | null => {
  const v = Number(n)
  return Number.isFinite(v) ? `$${v.toLocaleString()}` : null
}

// PT-only per the 2026-08-30 ruling -- every date token goes through this one
// call shape, never formatDeadlinePT called bare elsewhere in this file.
const pt = (iso: string | null | undefined, lang: 'ko' | 'en'): string | null =>
  formatDeadlinePT(iso, lang, { withKst: false, fullTzLabel: true })

function resolveToken(token: ChatbotToken, ctx: ChatbotTokenContext, lang: 'ko' | 'en'): string | null {
  const { season, membership, championshipRevealAt, now } = ctx
  switch (token) {
    case 'now':
      return pt(now.toISOString(), lang)
    case 'application_open':
      return pt(season.application_open_at, lang)
    case 'application_close':
      return pt(season.registration_close_at, lang)
    case 'prelim_submit_close':
      return pt(season.application_close_at, lang)
    case 'prelim_results':
      return pt(season.prelim_results_announcement_at, lang)
    case 'main_round_start':
      return pt(season.main_round_start_at, lang)
    case 'voting_open':
      return pt(season.community_vote_start_at, lang)
    case 'voting_close':
      return pt(season.community_vote_end_at, lang)
    case 'winners_announced':
      return pt(season.awards_announcement_at, lang)
    case 'first_ranking_date':
      return pt(championshipRevealAt, lang)
    case 'prize_pool':
      return usd(season.total_prize_pool)
    case 'prize_first':
      return usd(season.prize_first)
    case 'prize_second':
      return usd(season.prize_second)
    case 'prize_third':
      return usd(season.prize_third)
    case 'membership_price': {
      if (!membership?.price) return null
      const interval = membership.interval === 'year' ? (lang === 'ko' ? '년' : '/year') : lang === 'ko' ? '월' : '/month'
      return lang === 'ko' ? `${usd(membership.price)}/${interval}` : `${usd(membership.price)}${interval}`
    }
    case 'founding_cap':
      return Number.isFinite(membership?.founding.cap) ? String(membership?.founding.cap) : null
    case 'video_length_range': {
      const min = season.application_video_min_seconds
      const max = season.application_video_max_seconds
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null
      return lang === 'ko' ? `${min}~${max}초` : `${min}–${max} seconds`
    }
    case 'main_round_video_length_range': {
      const min = season.main_round_video_min_seconds
      const max = season.main_round_video_max_seconds
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null
      return lang === 'ko' ? `${min}~${max}초` : `${min}–${max} seconds`
    }
    case 'aspect_ratio':
      return season.aspect_ratio ?? null
    case 'intent_weight':
      return Number.isFinite(season.scoring_intent_clarity_weight)
        ? `${Math.round(season.scoring_intent_clarity_weight * 100)}%`
        : null
    case 'execution_weight':
      return Number.isFinite(season.scoring_execution_weight)
        ? `${Math.round(season.scoring_execution_weight * 100)}%`
        : null
    case 'originality_weight':
      return Number.isFinite(season.scoring_originality_weight)
        ? `${Math.round(season.scoring_originality_weight * 100)}%`
        : null
    case 'advance_label':
      return advanceCountLabel(season)
    case 'min_participants':
      return Number.isFinite(season.min_participants) ? String(season.min_participants) : null
    case 'max_postponements':
      return Number.isFinite(season.max_defer_count) ? String(season.max_defer_count) : null
    case 'floor_participants':
      return Number.isFinite(season.absolute_min_participants) ? String(season.absolute_min_participants) : null
    case 'main_theme':
      return ctx.revealedTheme.twistRevealed ? ctx.revealedTheme.mainTheme : null
    case 'required_element':
      return ctx.revealedTheme.twistRevealed ? ctx.revealedTheme.twist : null
  }
}

const TOKEN_RE = /\{\{(\w+)\}\}/g

// ★Why line-by-line, not one resolveFaqText-style pass over the whole
// document: unlike a FAQ item (one language per rendered page), this
// document interleaves "- KR: ..." and "- EN: ..." lines for the SAME
// fact, in the SAME string, because a system prompt is one document, not a
// per-request rendered page. A single-language pass over the whole thing
// would format every date in only one locale's month/day style even on the
// lines in the other language. So: track which language each line is
// currently inside (switching on a leading "- KR:"/"- EN:" or "**KR**"/
// "**EN**" marker) and resolve that line's tokens in that language; every
// other line (headers, the W-section's own English scaffolding, this
// module's instructions) defaults to English formatting.
//
// ★ABSENT IS NOT A BLANK, adapted for an LLM-consumed document rather than a
// human-facing page: resolveFaqText hides the whole item when a token can't
// resolve (right for a rendered FAQ card). Here the reader is the model
// itself, so an unresolved token becomes an explicit English marker --
// "(not available -- do not guess)" -- regardless of the surrounding
// language, so the instruction to the model is unambiguous. The document is
// prose with many independent facts per paragraph; dropping an entire
// multi-sentence Q&A over one missing date would throw away the sentences
// around it that still hold.
const UNAVAILABLE_MARKER = '(not available -- do not guess)'
const KR_LINE_RE = /^\s*[-*]?\s*\*{0,2}KR\*{0,2}\s*:/
const EN_LINE_RE = /^\s*[-*]?\s*\*{0,2}EN\*{0,2}\s*:/

export function resolveChatbotDocument(raw: string, ctx: ChatbotTokenContext): string {
  let lang: 'ko' | 'en' = 'en'
  return raw
    .split('\n')
    .map((line) => {
      if (KR_LINE_RE.test(line)) lang = 'ko'
      else if (EN_LINE_RE.test(line)) lang = 'en'
      return line.replace(TOKEN_RE, (whole, name: string) => {
        if (!(CHATBOT_TOKENS as readonly string[]).includes(name)) return whole
        const v = resolveToken(name as ChatbotToken, ctx, lang)
        return v ?? UNAVAILABLE_MARKER
      })
    })
    .join('\n')
}
