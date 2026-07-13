// Next.js 16 proxy (formerly middleware). Renamed from middleware.ts.
// Responsibilities:
//   1. Refresh Supabase Auth session cookies on routes that need a fresh server
//      session ([[feedback-auth-pattern]]) — public-site AND admin cookie
//      sessions. getUser() below performs the refresh; setAll persists rotated
//      tokens.
//   2. Gate /admin/* routes — unauthenticated or non-admin users go to
//      /admin/login.
//   3. Site-wide public gate — when SITE_PUBLIC_ENABLED=false, every public
//      page is rewritten to /coming-soon so external visitors see nothing about
//      the product. Logged-in admins pass through (so ops + internal testing on
//      prod keep working); /api/* and static assets are excluded via the
//      matcher so payments/webhooks/admin are never affected. Flipped by env
//      only — no date logic (patent filing may slip; TK lifts it manually).

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Reachable even while the site is gated. None of these reveal the product,
// and /login + /auth are required so an admin can sign in to bypass the gate.
function isGateExempt(pathname: string): boolean {
  return (
    pathname === '/coming-soon' ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname.startsWith('/auth')
  )
}

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
  const gated = process.env.SITE_PUBLIC_ENABLED === 'false'

  // Fast path: site is public and this route doesn't need a session refresh —
  // do nothing (no Supabase call), just like before the gate existed.
  if (!gated && !needsSessionRefresh(pathname)) {
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

  // Resolve admin role once — needed by both the admin gate and the site gate.
  // Only queried when a decision actually depends on it, to keep plain
  // refresh-only routes (profile/apply) as cheap as before.
  let isAdmin = false
  const needAdminRole =
    !!user &&
    (gated || (isAdminRoute && !isLoginRoute && !isCallbackRoute) || isLoginRoute)
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

  // ── Site-wide public gate ──
  // Gated + not exempt + not an admin → show Coming Soon (rewrite keeps the URL
  // so the requested path never leaks anything). noindex header as a backstop.
  if (gated && !isGateExempt(pathname) && !isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    const rewrite = NextResponse.rewrite(url)
    rewrite.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return rewrite
  }

  return response
}

export const config = {
  matcher: [
    // Run on every route EXCEPT API, Next internals, and the two metadata files.
    // Everything else (pages AND raw public assets like /arena_image.png) passes
    // through the gate, so business images can't be reached directly while gated.
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)',
  ],
}
