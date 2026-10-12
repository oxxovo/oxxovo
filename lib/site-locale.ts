// Entry gate + language for every page of the new site -- SERVER ONLY.
//
//  1. The whole new site sits behind watch_as_home (default off): off = notFound(),
//     for the /ko/... addresses too. Nothing new is reachable before TK switches it on.
//  2. The language comes from the proxy (lib/locales decideRoute): a prefixed address
//     carries it in a header the proxy sets on every request to these routes (a client
//     cannot supply it). An UNprefixed address is English -- unless the visitor has a
//     stored choice (cookie) or a browser language that is supported, in which case it
//     redirects once to that language's address. A stored choice of English stays put.
import 'server-only'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { isWatchHome } from '@/lib/watch-home'
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALE_HEADER,
  PREFIXED_HEADER,
  dirOf,
  isLocale,
  preferredLocale,
  withLocale,
} from '@/lib/locales'

export type SiteContext = { locale: string; dir: 'ltr' | 'rtl'; path: string }

// `path` = the unprefixed address of this page, `search` = its query string (with '?').
export async function enterSite(path: string, search = ''): Promise<SiteContext> {
  if (!(await isWatchHome())) notFound()
  const h = await headers()
  const prefixed = h.get(PREFIXED_HEADER) === '1'
  const fromProxy = h.get(LOCALE_HEADER)
  if (prefixed && isLocale(fromProxy)) return { locale: fromProxy, dir: dirOf(fromProxy), path }
  const pref = preferredLocale((await cookies()).get(LANG_COOKIE)?.value, h.get('accept-language'))
  if (pref !== DEFAULT_LOCALE) redirect(withLocale(path, pref) + search)
  return { locale: DEFAULT_LOCALE, dir: dirOf(DEFAULT_LOCALE), path }
}
