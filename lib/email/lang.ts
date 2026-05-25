// Language detection for outgoing emails. Phase 5 decision (TK approved):
// country='Korea' → ko, everything else → en. Phase 6+ will add an explicit
// language preference field to the /apply form.

export type EmailLang = 'ko' | 'en'

const KOREAN_COUNTRY_TOKENS = ['korea', 'south korea', '한국', '대한민국', 'kr']

export function detectEmailLang(country: string | null | undefined): EmailLang {
  if (!country) return 'en'
  const c = country.trim().toLowerCase()
  if (KOREAN_COUNTRY_TOKENS.includes(c)) return 'ko'
  return 'en'
}
