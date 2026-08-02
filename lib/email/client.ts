// Resend client — SERVER ONLY.
//
// RESEND_API_KEY must be present in env (Vercel + .env.local).
//
// ★EMAIL_FROM defaults to info@oxxovo.com, and that is NOT the same typo as the
// alert RECIPIENT that was corrected to .ai on 2026-08-01. A from-address must
// be on a domain verified in the Resend account, and measured that day the
// account holds exactly one: oxxovo.com (verified 2026-05-19, DKIM/SPF/DMARC via
// Cloudflare). oxxovo.ai is not registered there at all. Changing this line
// before verifying .ai in Resend does not move our mail to the new domain -- it
// stops our mail. Order: verify oxxovo.ai in Resend -> set EMAIL_FROM -> then
// this fallback can follow. See Phase B of reports/studio_go_live_checklist.

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
  : 'OXXOVO <info@oxxovo.com>'

export const APP_URL = process.env.APP_URL ?? 'https://www.oxxovo.ai'
