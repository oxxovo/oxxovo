// Languages of the NEW site (home + the seven section pages) -- pure, no env, no DB.
//
// Policy (HQ 2026-10-11, replaces the 2026-08-11 "KO/EN canonical, the rest left to
// the browser's translator" decision for the new site only): English is the
// canonical text; every other language is a translation layer; a screen shows ONE
// language, never a mix; any language can be added. Adding one is a line in
// LOCALES plus a catalog file registered in lib/site-messages.ts -- nothing else.
//
// Addresses: English is canonical and has NO prefix (/entertainment); every other
// language is a prefix (/ko/entertainment). /en/... is a duplicate of the
// unprefixed address and redirects to it. The prefix only applies to the routes in
// SITE_ROUTES; /ko/watch is NOT a Watch page and stays a 404.
//
// The old ko/en toggle (lib/admin-i18n.ts, localStorage `oxxovo_admin_lang`) keeps
// serving every other screen. syncLegacyLang() says what the new picker writes there
// so the two do not disagree on a ko/en visitor.

export type LocaleDef = {
  code: string
  // Shown in the picker in the language's own script, so a visitor who cannot read the
  // current language can still find theirs.
  nativeName: string
  dir: 'ltr' | 'rtl'
}

export const LOCALES: readonly LocaleDef[] = [
  { code: 'en', nativeName: 'English', dir: 'ltr' },
  { code: 'ko', nativeName: '한국어', dir: 'ltr' },
]

export const DEFAULT_LOCALE = 'en'
export const LANG_COOKIE = 'oxxovo_lang'
// Request headers set by proxy.ts for SITE_ROUTES only, and overwritten on every such
// request (a client-supplied value never reaches a page).
export const LOCALE_HEADER = 'x-oxxovo-locale'
export const PREFIXED_HEADER = 'x-oxxovo-prefixed'

export function localeCodes(locales: readonly LocaleDef[] = LOCALES): string[] {
  return locales.map((l) => l.code)
}

export function isLocale(v: unknown, locales: readonly LocaleDef[] = LOCALES): v is string {
  return typeof v === 'string' && locales.some((l) => l.code === v)
}

export function dirOf(code: string, locales: readonly LocaleDef[] = LOCALES): 'ltr' | 'rtl' {
  return locales.find((l) => l.code === code)?.dir ?? 'ltr'
}

// First path segments that belong to the new site. '' is the home page. The slugs are
// the public addresses; app/<slug> folders are listed in RESERVED_SLUGS too.
export const SITE_ROUTES: readonly string[] = [
  '', 'competition', 'entertainment', 'daily', 'market', 'education', 'jobs', 'games',
]

export function isSiteRoute(path: string): boolean {
  const seg = path.split('/')[1] ?? ''
  return SITE_ROUTES.includes(seg) && path.split('/').length <= 2
}

export type RouteDecision =
  | { action: 'pass'; locale: string; prefixed: false }
  | { action: 'rewrite'; path: string; locale: string; prefixed: true }
  | { action: 'redirect'; path: string }

// Decide what the proxy does with a pathname. Pure so it can be tested without a server.
//   /ko/entertainment -> rewrite to /entertainment, locale ko
//   /en/entertainment -> redirect to /entertainment (one address per page)
//   /ko/watch, /ko/x  -> pass (not a site route: stays whatever it was, i.e. a 404)
//   /entertainment    -> pass, default locale, unprefixed
export function decideRoute(pathname: string, locales: readonly LocaleDef[] = LOCALES): RouteDecision {
  const parts = pathname.split('/')
  const first = parts[1] ?? ''
  if (first && isLocale(first, locales)) {
    const rest = '/' + parts.slice(2).join('/')
    const path = rest === '/' || rest === '//' ? '/' : rest.replace(/\/+$/, '') || '/'
    if (!isSiteRoute(path)) return { action: 'pass', locale: DEFAULT_LOCALE, prefixed: false }
    if (first === DEFAULT_LOCALE) return { action: 'redirect', path }
    return { action: 'rewrite', path, locale: first, prefixed: true }
  }
  return { action: 'pass', locale: DEFAULT_LOCALE, prefixed: false }
}

// "/entertainment" + "ko" -> "/ko/entertainment"; the default language has no prefix.
export function withLocale(path: string, code: string, locales: readonly LocaleDef[] = LOCALES): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!isLocale(code, locales) || code === DEFAULT_LOCALE) return p
  return p === '/' ? `/${code}` : `/${code}${p}`
}

// Accept-Language -> a supported code, or null. Highest q first; a regional tag (ko-KR)
// matches its base (ko); q=0 means "not acceptable"; garbage matches nothing.
export function negotiateLocale(header: string | null | undefined, locales: readonly LocaleDef[] = LOCALES): string | null {
  if (!header) return null
  const ranked = header
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const q = qParam === undefined ? 1 : Number(qParam.slice(2))
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, i }
    })
    .filter((x) => x.tag && x.tag !== '*' && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  for (const { tag } of ranked) {
    const base = tag.split('-')[0]
    const hit = locales.find((l) => l.code === tag) ?? locales.find((l) => l.code === base)
    if (hit) return hit.code
  }
  return null
}

// What an unprefixed visit should do: a stored choice wins (including an explicit
// English), otherwise the browser's language. null = stay on the unprefixed page.
export function preferredLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null | undefined,
  locales: readonly LocaleDef[] = LOCALES,
): string {
  if (isLocale(cookie, locales)) return cookie
  return negotiateLocale(acceptLanguage, locales) ?? DEFAULT_LOCALE
}

// The picker also writes the old ko/en toggle so /watch and the other screens follow a
// ko/en visitor. Other languages leave that toggle alone (those screens only know ko/en).
export function syncLegacyLang(code: string): 'ko' | 'en' | null {
  return code === 'ko' || code === 'en' ? code : null
}
