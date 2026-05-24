import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Supabase auth callback — handles password recovery and magic-link redirects.
//
// Inbound URL shapes:
//   /admin/auth/callback?code=<pkce>&type=recovery   (Dashboard "Send password recovery")
//   /admin/auth/callback?code=<pkce>&next=<path>     (Explicit redirect target)
//   /admin/auth/callback?code=<pkce>                 (Plain magic link / signup confirm)
//   /admin/auth/callback?error=...&error_description=...
//
// We exchange the PKCE code for a session, then route the browser:
//   type=recovery     → /admin/reset-password
//   explicit `next`   → that path (must start with `/admin/` for safety)
//   otherwise         → /admin

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next')
  const errorParam = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    const url = new URL('/admin/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', errorParam)
    return NextResponse.redirect(url)
  }

  if (!code) {
    const url = new URL('/admin/login', origin)
    url.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(url)
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL('/admin/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', error.message)
    return NextResponse.redirect(url)
  }

  // Recovery flow always wins — user came from "reset password" email.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/admin/reset-password', origin))
  }

  // Only honor `next` if it's a safe in-app path.
  const safeNext =
    nextParam && nextParam.startsWith('/admin/') ? nextParam : '/admin'
  return NextResponse.redirect(new URL(safeNext, origin))
}
