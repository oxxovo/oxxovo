import 'server-only'

// ★WHERE ALERTS GO. The company mailbox is info@oxxovo.ai (thomas@ / support@
// are aliases into the same inbox — TK, 2026-08-01). This used to say .com,
// which meant an unset OPS_ALERT_EMAIL sent every operational alert to the wrong
// domain. OPS_ALERT_EMAIL still overrides, so escalations can be routed OUTSIDE
// the inbox the inbound Worker reads.
const ALERT_TO = process.env.OPS_ALERT_EMAIL || 'info@oxxovo.ai'

// ★WHO THEY COME FROM, and that is a different question with a different answer.
// Resend refuses a from-address whose domain is not verified in the account, and
// the account has exactly ONE: `oxxovo.com`, verified 2026-05-19 (measured via
// the Resend API on 2026-08-01 — oxxovo.ai is not registered there at all).
// Moving the SENDER to .ai before .ai is verified would turn every alert into a
// rejected send whose only trace is a console.error nobody reads: strictly worse
// than an alert with an odd return address, because it looks like silence rather
// than failure. So the recipient moves now and the sender waits for the Resend
// side of the Workspace migration. EMAIL_FROM (already set in Vercel for
// participant mail) is reused, so the day .ai is verified, one env var moves both.
const ALERT_FROM = process.env.EMAIL_FROM || 'info@oxxovo.com'

// Lightweight admin alert over Resend for background jobs (cron) that have no
// user in the loop. Returns true on a 2xx send and NEVER throws — a failed
// alert must not crash the job that is trying to report. The caller logs the
// boolean if it cares.
export async function sendAdminAlert(subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[admin-alert] RESEND_API_KEY missing; cannot send:', subject)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `OXXOVO Ops <${ALERT_FROM}>`,
        // Safe to land in the info@ inbox even though the inbound Worker reads
        // it: the Auto-Submitted tag below plus the inbound self/auto-submitted
        // guards break the loop at the recipient.
        to: [ALERT_TO],
        subject,
        html,
        // Mark as auto-generated so that if this alert ever lands back in info@,
        // the inbound loopGuard skips it instead of re-escalating.
        headers: {
          'Auto-Submitted': 'auto-replied',
          'X-Auto-Response-Suppress': 'All',
        },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      // ★Name both addresses. A 403 here is almost always "the from-domain is not
      // verified in this Resend account", and without the pair in the log that
      // reads as a generic outage instead of a one-line fix.
      console.error(
        `[admin-alert] Resend returned ${res.status} (from=${ALERT_FROM} to=${ALERT_TO}):`,
        detail,
      )
      return false
    }
    return true
  } catch (e) {
    console.error('[admin-alert] send failed:', e instanceof Error ? e.message : e)
    return false
  }
}
