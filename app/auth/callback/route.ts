import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Public-site Supabase auth callback — handles magic-link redirects.
// Mirrors app/admin/auth/callback for general users.
//
// Inbound URL shapes:
//   /auth/callback?code=<pkce>&next=<path>   (explicit redirect target)
//   /auth/callback?code=<pkce>               (plain magic link)
//   /auth/callback?error=...&error_description=...
//
// We exchange the PKCE code for a cookie session, then route the browser:
//   explicit `next` (must be a safe in-app path) → that path
//   otherwise                                    → /profile
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const errorParam =
    searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', errorParam)
    return NextResponse.redirect(url)
  }

  if (!code) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(url)
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', error.message)
    return NextResponse.redirect(url)
  }

  // Best-effort: link any pre-existing email-only applications to this user
  // (Phase 6 — link_user_applications RPC, idempotent). Never block login on a
  // backfill hiccup (e.g. RPC not yet deployed); the bulk backfill / next
  // login catches up.
  try {
    await supabase.rpc('link_user_applications')
  } catch {
    // ignore
  }

  // Only honor `next` if it's a safe, relative in-app path (leading single
  // slash, not protocol-relative "//host") — never an admin path.
  const safeNext =
    nextParam &&
    nextParam.startsWith('/') &&
    !nextParam.startsWith('//') &&
    !nextParam.startsWith('/admin')
      ? nextParam
      : '/profile'
  return NextResponse.redirect(new URL(safeNext, origin))
}
