// Resend client — SERVER ONLY.
//
// RESEND_API_KEY must be present in env (Vercel + .env.local).
// EMAIL_FROM defaults to info@oxxovo.com (verified at Resend with Cloudflare
// DKIM/SPF/DMARC).

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
