// Resend client — SERVER ONLY.
//
// RESEND_API_KEY must be present in env (Vercel + .env.local).
//
// ★EMAIL_FROM defaults to info@oxxovo.ai as of 2026-08-02, when oxxovo.ai was
// verified in Resend (Cloudflare auto-configure, `send` subdomain, root Google MX
// untouched). The order mattered and is worth keeping written down: a
// from-address on a domain the Resend account has not verified is rejected, so
// changing this line first would not have moved our mail to the new domain, it
// would have stopped our mail. Verify the domain -> set EMAIL_FROM -> then the
// fallback. See Phase B of reports/studio_go_live_checklist_2026-07.md.

import 'server-only'
import { Resend } from 'resend'

let cached: Resend | null = null

export function getResend(): Resend {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      'getResend: RESEND_API_KEY is missing. Set it in .env.local (dev) and Vercel Environment Variables (prod).',
    )
  }
  cached = new Resend(key)
  return cached
}

export const EMAIL_FROM = process.env.EMAIL_FROM
  ? `OXXOVO <${process.env.EMAIL_FROM}>`
  : 'OXXOVO <info@oxxovo.ai>'

export const APP_URL = process.env.APP_URL ?? 'https://www.oxxovo.ai'
