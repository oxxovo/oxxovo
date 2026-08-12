import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'

// One-shot demo SESSION INJECTOR -- SERVER ONLY, PREVIEW/LOCAL ONLY.
//
// Signs the isolated studio-demo account in with NO email / magic-link / password
// dependency (its mailbox isn't reachable). Each request MINTS a fresh OTP token
// via the service role and verifies it server-side in the SAME request, so no
// consumable token is ever placed in a URL a prefetch/scanner could burn. The
// cookie session is set and the browser lands logged-in on /studio.
//
// REUSABLE / prefetch-proof: every hit re-mints + re-verifies, so opening the URL
// many times (or a preview fetch) just logs in again -- it never reads "already
// used". The URL carries only a static gate key, never a one-time token.
//
// Triple-gated so it can NEVER work on production:
//   1. STUDIO_DEV_UNLOCK === 'true'  -- set only in local .env.local + Vercel
//      Preview, NEVER Production (mirrors lib/session6 studio gate).
//   2. ?key must equal DEMO_KEY.
//   3. The email is hardcoded to the demo account -- never arbitrary.
//   (Preview is additionally behind Vercel SSO, so only the team can reach it.)

export const dynamic = 'force-dynamic'

const DEMO_EMAIL = 'studio-demo@oxxovo.ai'
const DEMO_KEY = 'oxxovo-studio-demo-2026'

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)

  if (process.env.STUDIO_DEV_UNLOCK !== 'true') {
    return new NextResponse('Not found', { status: 404 })
  }
  if (searchParams.get('key') !== DEMO_KEY) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const fail = (reason: string) => {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'callback_failed')
    url.searchParams.set('reason', reason)
    return NextResponse.redirect(url)
  }

  // 1. Mint a fresh magic-link OTP for the demo account (service role).
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: DEMO_EMAIL })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) return fail(error?.message ?? 'mint_failed')

  // 2. Verify it right here (no verifier needed) -> sets the cookie session.
  const supabase = await createSupabaseServer()
  const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (vErr) return fail(vErr.message)

  // 3. Logged in -> Studio.
  return NextResponse.redirect(new URL('/studio', origin))
}
