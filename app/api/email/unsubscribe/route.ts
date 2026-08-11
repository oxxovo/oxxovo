// One-click email unsubscribe (RFC 8058), linked from every outbound email's
// List-Unsubscribe header (lib/email/send.tsx unsubscribeHeaders).
//
// POST = List-Unsubscribe-Post one-click. Mail providers (Gmail, Yahoo, ...)
// call this directly with no user-visible page -- must act immediately, no
// confirmation step, per RFC 8058.
// GET  = the link a human clicks (from the email body, or a mail client that
// only supports the legacy mailto/http GET form). Renders a confirm page
// instead of unsubscribing immediately -- a GET can be hit by a link
// prefetcher/scanner, which must not silently unsubscribe someone.
//
// Keyed by email (see lib/email/send.tsx unsubscribeHeaders for why a signed
// token was skipped). Only touches email_opt_in/email_opt_out_at -- same
// columns app/profile/actions.ts unsubscribeEmail() writes, so profile
// settings and this link are two doors to the same state.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

async function unsubscribeByEmail(email: string): Promise<boolean> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return false
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('profiles')
    .update({ email_opt_in: false, email_opt_out_at: new Date().toISOString() })
    .eq('email', trimmed)
  return !error
}

export async function POST(request: NextRequest) {
  const email = new URL(request.url).searchParams.get('email') ?? ''
  await unsubscribeByEmail(email)
  // One-click unsubscribe must return 200 regardless of match (no oracle for
  // whether an address exists in the system).
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const email = new URL(request.url).searchParams.get('email') ?? ''
  const safeEmail = email.replace(/[<>"]/g, '')

  return new NextResponse(
    `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribe - OXXOVO</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background:#030305;color:#fff;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:420px;padding:32px;text-align:center">
<h1 style="font-size:20px;margin-bottom:12px">Unsubscribe from OXXOVO announcement emails?</h1>
<p style="color:#999;font-size:14px;line-height:1.6;margin-bottom:24px">${safeEmail ? `${safeEmail} ` : ''}will stop receiving tournament and season announcement emails. Notices about your own application or account still arrive regardless of this setting.</p>
<form method="POST" action="/api/email/unsubscribe?email=${encodeURIComponent(email)}">
<button type="submit" style="background:#8b22ff;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-weight:700;font-size:14px;cursor:pointer">Unsubscribe</button>
</form>
</div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
