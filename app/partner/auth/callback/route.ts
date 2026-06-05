import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Partner-invite magic-link callback. Mirrors /admin/auth/callback: exchange
// the PKCE code for a session, then forward to the activation page. Kept
// separate from the admin callback so the redirect target is fixed to the
// partner flow (no open `next` redirect).
//
// Inbound: /partner/auth/callback?code=<pkce>
//          /partner/auth/callback?error=...&error_description=...
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorParam) {
    const url = new URL('/partner/activate', origin)
    url.searchParams.set('error', errorParam)
    return NextResponse.redirect(url)
  }
  if (!code) {
    const url = new URL('/partner/activate', origin)
    url.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(url)
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const url = new URL('/partner/activate', origin)
    url.searchParams.set('error', error.message)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL('/partner/activate', origin))
}
