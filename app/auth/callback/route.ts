import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { recordEmailConsentForUser } from '@/app/login/actions'
import { hasDisplayName } from '@/lib/nickname'

// Public-site Supabase auth callback — handles magic-link redirects.
// Mirrors app/admin/auth/callback for general users.
//
// Inbound URL shapes:
//   /auth/callback?code=<pkce>&next=<path>          (browser-initiated PKCE)
//   /auth/callback?code=<pkce>                       (plain magic link)
//   /auth/callback?token_hash=<hash>&type=<t>&next=  (OTP-hash / admin-minted link)
//   /auth/callback?error=...&error_description=...
//
// Two auth mechanisms:
//   ?code       — PKCE exchange; needs the code_verifier cookie set by the browser
//                 that STARTED signInWithOtp (normal user login).
//   ?token_hash — verifyOtp; needs NO verifier, so an admin-minted link (generateLink,
//                 e.g. a demo/support login) works in any browser. Same token family
//                 Supabase email-confirmation uses.
// Then route the browser: safe in-app `next` → that path, else → /profile.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type')
  const nextParam = searchParams.get('next')
  const errorParam =
    searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', errorParam)
    return NextResponse.redirect(url)
  }

  if (!code && !tokenHash) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(url)
  }

  const supabase = await createSupabaseServer()
  const { data, error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (otpType as EmailOtpType) || 'magiclink' })
    : await supabase.auth.exchangeCodeForSession(code as string)

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

  // Email signup consent (app/privacy Section 11, app/terms Section 12) is
  // recorded HERE, not on the login form -- this is the point that proves the
  // caller actually controls this mailbox (they opened the link), not just
  // typed an address into a public form. See app/login/actions.ts for the
  // full reasoning and lib/email/signup-consent.ts for the once-only guard.
  const userId = data.user?.id ?? data.session?.user?.id
  if (userId) {
    try {
      await recordEmailConsentForUser(userId)
    } catch {
      // best-effort, never blocks login
    }
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

  // Mandatory nickname onboarding (TK 2026-08-19: no more auto-generated
  // names). Every login checks this -- cheap (one indexed lookup) and it is
  // the "eye-catching" half of the gate; app/welcome/nickname/actions.ts's
  // mint-time checks are the half that actually can't be bypassed.
  if (userId && !(await hasDisplayName(userId))) {
    const url = new URL('/welcome/nickname', origin)
    url.searchParams.set('next', safeNext)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL(safeNext, origin))
}
