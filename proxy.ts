// Next.js 16 proxy (formerly middleware). Renamed from middleware.ts.
// Two responsibilities:
//   1. Refresh Supabase Auth session cookies on every request (so server components see fresh tokens).
//   2. Gate /admin/* routes — unauthenticated or non-admin users are sent to /admin/login.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname
  const isAdminRoute = pathname.startsWith('/admin')
  const isLoginRoute = pathname === '/admin/login'
  // /admin/auth/callback runs the code-for-session exchange itself; no session
  // exists yet when the user arrives, so the auth gate must skip it.
  const isCallbackRoute = pathname === '/admin/auth/callback'

  if (isAdminRoute && !isLoginRoute && !isCallbackRoute) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('error', 'not_admin')
      return NextResponse.redirect(url)
    }
  }

  if (isLoginRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      url.searchParams.delete('redirect')
      url.searchParams.delete('error')
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Run on /admin/* only (skip everything else — static, API, public pages).
    '/admin/:path*',
  ],
}
