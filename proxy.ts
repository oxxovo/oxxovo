// Next.js 16 proxy (formerly middleware). Renamed from middleware.ts.
// Responsibilities:
//   1. Refresh Supabase Auth session cookies on routes that need a fresh server
//      session ([[feedback-auth-pattern]]) — public-site AND admin cookie
//      sessions. getUser() below performs the refresh; setAll persists rotated
//      tokens.
//   2. Gate /admin/* routes — unauthenticated or non-admin users go to
//      /admin/login.
//
// ★Site-wide "Coming Soon" gate REMOVED (HQ 2026-08-19, public launch): the
// site is public now, permanently -- no re-gating planned. The gate used to
// rewrite every public page to /coming-soon while SITE_PUBLIC_ENABLED=false
// (patent-filing novelty concern, resolved). That page and this branch are
// gone, not just switched off, per explicit instruction not to leave a
// reachable "Coming Soon" state behind.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { LOCALE_HEADER, PREFIXED_HEADER, decideRoute, isSiteRoute } from '@/lib/locales'

// Routes whose server code relies on a freshly-refreshed cookie session. We do
// the getUser() refresh only here (matches pre-gate behavior) so the ungated
// site pays no extra Supabase round-trip on plain page loads.
function needsSessionRefresh(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/auth') ||
    pathname === '/login'
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // New site language (lib/locales): /ko/<site route> is served by the unprefixed page
  // with the language in a request header; /en/<...> is a duplicate address and
  // redirects. The two headers are DELETED from every incoming request first, so only
  // this code can set them -- a client-supplied value never reaches a page. Only the
  // new site's own routes are touched; every other path (e.g. /ko/watch) is unchanged.
  const route = decideRoute(pathname)
  if (route.action === 'redirect') {
    const url = request.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.redirect(url, 308)
  }
  if (route.action === 'rewrite' || isSiteRoute(pathname)) {
    const headers = new Headers(request.headers)
    headers.delete(LOCALE_HEADER)
    headers.delete(PREFIXED_HEADER)
    if (route.action === 'rewrite') {
      headers.set(LOCALE_HEADER, route.locale)
      headers.set(PREFIXED_HEADER, '1')
      const url = request.nextUrl.clone()
      url.pathname = route.path
      return NextResponse.rewrite(url, { request: { headers } })
    }
    return NextResponse.next({ request: { headers } })
  }

  // Fast path: this route doesn't need a session refresh — do nothing (no
  // Supabase call).
  if (!needsSessionRefresh(pathname)) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminRoute = pathname.startsWith('/admin')
  const isLoginRoute = pathname === '/admin/login'
  // /admin/auth/callback runs the code-for-session exchange itself; no session
  // exists yet when the user arrives, so the auth gate must skip it.
  const isCallbackRoute = pathname === '/admin/auth/callback'

  // Resolve admin role once — needed by the admin gate. Only queried when a
  // decision actually depends on it, to keep plain refresh-only routes
  // (profile/apply) as cheap as before.
  let isAdmin = false
  const needAdminRole =
    !!user && ((isAdminRoute && !isLoginRoute && !isCallbackRoute) || isLoginRoute)
  if (needAdminRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  // ── /admin gate (unchanged behavior) ──
  if (isAdminRoute && !isLoginRoute && !isCallbackRoute) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('error', 'not_admin')
      return NextResponse.redirect(url)
    }
  }

  if (isLoginRoute && user && isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.searchParams.delete('redirect')
    url.searchParams.delete('error')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Run on every route EXCEPT API, Next internals, and the two metadata files
    // -- needsSessionRefresh() above decides which of those actually do work.
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)',
  ],
}
