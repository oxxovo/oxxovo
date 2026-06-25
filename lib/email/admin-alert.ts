import 'server-only'

// Where operational alerts go. Same mailbox the application notifications use
// (/api/notify), so no new infra — Cloudflare Email Routing + Resend domain
// verification already cover info@oxxovo.com.
const ADMIN_EMAIL = 'info@oxxovo.com'

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
        from: `OXXOVO Ops <${ADMIN_EMAIL}>`,
        // Send alerts to OPS_ALERT_EMAIL when set so escalations land OUTSIDE the
        // info@ inbox that routes to the inbound Worker (breaks the loop at the
        // recipient). Falls back to info@ when unset -- still safe because of the
        // Auto-Submitted tag below + the inbound self/auto-submitted guards.
        to: [process.env.OPS_ALERT_EMAIL || ADMIN_EMAIL],
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
      console.error('[admin-alert] Resend returned', res.status, detail)
      return false
    }
    return true
  } catch (e) {
    console.error('[admin-alert] send failed:', e instanceof Error ? e.message : e)
    return false
  }
}
