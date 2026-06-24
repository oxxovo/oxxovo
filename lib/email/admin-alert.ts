import 'server-only'

// Where operational alerts go. Same mailbox the application notifications use
// (/api/notify), so no new infra — Cloudflare Email Routing + Resend domain
// verification already cover info@oxxovo.com.
const ADMIN_EMAIL = 'info@oxxovo.com'

// Lightweight admin alert over Resend for background jobs (cron) that have no
// user in the loop. Returns true on a 2xx send and NEVER throws — a failed
// alert must not crash the job that is trying to report. The caller logs the
// boolean if it cares.
//
// `to` defaults to the ops mailbox. Pass an explicit recipient list to fan an
// alert out to staff (admin + manager) — the ops mailbox is always kept in the
// list so an alert never goes nowhere even if no staff rows resolve.
export async function sendAdminAlert(
  subject: string,
  html: string,
  to?: string[],
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[admin-alert] RESEND_API_KEY missing; cannot send:', subject)
    return false
  }
  // Dedupe + always include the ops mailbox as a backstop.
  const recipients = [...new Set([ADMIN_EMAIL, ...(to ?? [])].map((e) => e.trim().toLowerCase()).filter(Boolean))]
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `OXXOVO Ops <${ADMIN_EMAIL}>`,
        to: recipients,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[admin-alert] Resend returned', res.status, detail)
      return false
    }
    return true
  } catch (e) {
    console.error('[admin-alert] send failed:', e instanceof Error ? e.message : e)
    return false
  }
}
