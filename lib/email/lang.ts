// Language detection for outgoing emails.
//
// ★2026-08-31 (HQ): country is a guess, not a language -- there are Koreans in
// the US and non-Koreans in Korea. profiles.locale is now the explicit,
// user-set value (collected at /apply, see reports/
// email_locale_explicit_design_2026-08-31.md) and always wins when it exists.
// detectEmailLang(country) below is Phase 5's original heuristic (TK approved
// then) and stays ONLY as the fallback in resolveEmailLang, for accounts that
// predate the locale column or never set it -- so nothing regresses versus
// today's behavior, it only gets a better answer when one is available.

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type EmailLang = 'ko' | 'en'

const KOREAN_COUNTRY_TOKENS = ['korea', 'south korea', '한국', '대한민국', 'kr']

export function detectEmailLang(country: string | null | undefined): EmailLang {
  if (!country) return 'en'
  const c = country.trim().toLowerCase()
  if (KOREAN_COUNTRY_TOKENS.includes(c)) return 'ko'
  return 'en'
}

// Looked up by recipient email rather than a userId/creatorUserId parameter on
// purpose: every send*() input already carries toEmail, so this slots into the
// existing `input.forceLang ?? ...` line in each of them without adding a new
// field to any of their Input types or to the callers that build those inputs
// (app/api/cron/email-tick/route.ts and friends). Best-effort, like the other
// consent/profile reads in this codebase (see recordEmailConsentForUser): a
// failed lookup falls through to the country guess rather than blocking a send.
export async function resolveEmailLang(
  toEmail: string,
  country: string | null | undefined,
): Promise<EmailLang> {
  try {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('profiles')
      .select('locale')
      .ilike('email', toEmail)
      .maybeSingle()
    const locale = data?.locale as string | null | undefined
    if (locale === 'ko' || locale === 'en') return locale
  } catch {
    // best-effort, see above
  }
  return detectEmailLang(country)
}
