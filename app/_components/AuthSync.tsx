'use client'

// Bridges the cookie auth session -> localStorage (oxxovo_token / oxxovo_email),
// the identity /studio reads via lib/use-local-user. Completes the integration
// deferred in 51dfe38 ("cookie-auth integration deferred per session6 todo"):
// magic-link login sets a cookie session, but /studio reads localStorage. This
// mirrors the session's access_token so a normally-logged-in participant is
// recognized in Studio. Stays in sync on token refresh; clears on sign-out.
import { useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type MiniSession = { access_token?: string; user?: { email?: string } } | null

export default function AuthSync() {
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const apply = (session: MiniSession) => {
      try {
        const prev = localStorage.getItem('oxxovo_token')
        if (session?.access_token) {
          localStorage.setItem('oxxovo_token', session.access_token)
          if (session.user?.email) localStorage.setItem('oxxovo_email', session.user.email)
        } else {
          localStorage.removeItem('oxxovo_token')
          localStorage.removeItem('oxxovo_email')
        }
        // Wake same-tab useSyncExternalStore subscribers (the 'storage' event
        // does not fire in the tab that mutated localStorage).
        if (localStorage.getItem('oxxovo_token') !== prev) {
          window.dispatchEvent(new Event('storage'))
        }
      } catch {
        // localStorage unavailable (SSR/private mode) -- ignore.
      }
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session as MiniSession))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session as MiniSession))
    return () => sub.subscription.unsubscribe()
  }, [])
  return null
}
