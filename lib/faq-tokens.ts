// Token allowlist for admin-authored FAQ content (app/admin/faq). Design:
// reports/admin_faq_editor_design_2026-08-12.md §4. A FAQ answer/question may
// contain `{{token}}` placeholders from the fixed list below -- never free
// JS, never a raw column name -- so an admin cannot accidentally (or
// deliberately) print something the platform doesn't already show publicly
// elsewhere. Every value here is read from the SAME sources LandingView.tsx
// already reads (season columns, membership config) -- no new data path.
//
// ★ABSENT IS NOT A BLANK ([[feedback-absent-is-not-zero]]). A token that
// cannot resolve returns null, and the caller's contract (resolveFaqText) is:
// null anywhere -> the WHOLE item is unresolved, never rendered with a blank
// or a literal "{{token}}" showing. Some underlying helpers (advanceCountLabel,
// formatAccessCopy) already have their own "value not decided yet" copy baked
// in and never return null themselves -- that is intentional and is not
// bypassed here.

import type { Lang } from './admin-i18n'
import {
  advanceCountLabel,
  formatAccessCopy,
  formatDeadlinePT,
  type Season,
} from './seasons'
import type { MembershipLandingData } from '@/app/membership/types'

export const FAQ_TOKENS = [
  'prize_pool',
  'prize_first',
  'prize_second',
  'prize_third',
  'max_applicants',
  'video_length_range',
  'advance_label',
  'membership_access',
  'application_close',
] as const

export type FaqToken = (typeof FAQ_TOKENS)[number]

export interface FaqTokenContext {
  season: Season
  membership: MembershipLandingData | null
  lang: Lang
}

const usd = (n: unknown): string | null => {
  const v = Number(n)
  return Number.isFinite(v) ? `$${v.toLocaleString()}` : null
}

/** One token's resolved value, or null if it cannot be resolved right now. */
function resolveToken(token: FaqToken, ctx: FaqTokenContext): string | null {
  const { season, membership, lang } = ctx
  switch (token) {
    case 'prize_pool':
      return usd(season.total_prize_pool)
    case 'prize_first':
      return usd(season.prize_first)
    case 'prize_second':
      return usd(season.prize_second)
    case 'prize_third':
      return usd(season.prize_third)
    case 'max_applicants':
      return Number.isFinite(season.max_applicants) ? String(season.max_applicants) : null
    case 'video_length_range': {
      const min = season.application_video_min_seconds
      const max = season.application_video_max_seconds
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null
      return lang === 'ko' ? `${min}~${max}초` : `${min}–${max} seconds`
    }
    // ★English text regardless of `lang` -- same known limitation as the
    // hardcoded FAQ #7 answer (LandingView.tsx), which already passes this
    // exact helper's output straight into the KR answer variant. Not solved
    // here; not made worse either.
    case 'advance_label':
      return advanceCountLabel(season)
    // ★English text regardless of `lang` -- mirrors the hardcoded FAQ #2
    // comment in LandingView.tsx ("formatAccessCopy()'s Korean text was
    // never approved"). Same limitation, not re-solved per token.
    case 'membership_access':
      return formatAccessCopy({
        seasonName: season.name,
        entryFee: Number(season.entry_fee),
        membershipEnabled: membership?.enabled ?? false,
        price: membership?.price ?? null,
        interval: membership?.interval ?? 'month',
        foundingMonths: membership?.foundingMonths ?? null,
        foundingCap: membership?.founding.cap ?? 0,
      })
    case 'application_close':
      return formatDeadlinePT(season.registration_close_at, lang)
  }
}

export type FaqTextResolution = { ok: true; text: string } | { ok: false; missingTokens: string[] }

const TOKEN_RE = /\{\{(\w+)\}\}/g

/**
 * Substitute every `{{token}}` in `raw`. Unknown tokens (typo, or a token
 * name that isn't in FAQ_TOKENS) and tokens that resolve to null are both
 * "missing" -- the design does not distinguish them, because both mean the
 * same thing to a reader: this text is not safe to show as-is.
 */
export function resolveFaqText(raw: string, ctx: FaqTokenContext): FaqTextResolution {
  const missing: string[] = []
  const text = raw.replace(TOKEN_RE, (whole, name: string) => {
    if (!(FAQ_TOKENS as readonly string[]).includes(name)) {
      missing.push(name)
      return whole
    }
    const v = resolveToken(name as FaqToken, ctx)
    if (v === null) {
      missing.push(name)
      return whole
    }
    return v
  })
  if (missing.length > 0) return { ok: false, missingTokens: [...new Set(missing)] }
  return { ok: true, text }
}
