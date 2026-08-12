'use client'

// Keeps <html lang> in step with the ko/en toggle (lib/admin-i18n.ts), which
// is otherwise purely a localStorage value the rest of the page never
// reflects back onto the document -- root layout hardcodes lang="en" and
// stays that way regardless of what's on screen.
//
// ★Known gap, left as-is by design (TK/제니2, 2026-08-12): the server always
// renders lang="en" first (admin-i18n's SERVER_DEFAULT, for hydration
// safety), and this effect only flips it AFTER hydration once the client
// reads localStorage. So the very first HTML byte still says "en" even for
// a returning ko visitor -- same limitation every other string on the page
// already has under this localStorage-driven toggle. Fixing that for real
// needs a server-readable lang cookie (SSR-time <html lang>), which is a
// bigger, cross-cutting change and out of scope here -- don't re-diagnose
// this as a bug without that context.
import { useEffect } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'

export default function HtmlLangSync() {
  const lang = useAdminLang()
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}
