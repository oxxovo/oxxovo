import 'server-only'

// ★WHERE ALERTS GO. The company mailbox is info@oxxovo.ai (thomas@ / support@
// are aliases into the same inbox — TK, 2026-08-01). This used to say .com,
// which meant an unset OPS_ALERT_EMAIL sent every operational alert to the wrong
// domain. OPS_ALERT_EMAIL still overrides, so escalations can be routed OUTSIDE
// the inbox the inbound Worker reads.
const ALERT_TO = process.env.OPS_ALERT_EMAIL || 'info@oxxovo.ai'

// ★WHO THEY COME FROM, and that is a different question with a different answer.
// Resend refuses a from-address whose domain is not verified in the account. On
// 2026-08-01 the account held exactly one domain (oxxovo.com), so the sender had
// to stay there while the recipient moved. **oxxovo.ai was verified on
// 2026-08-02** (Cloudflare auto-configure, on the `send` subdomain so the root
// Google MX is untouched — Resend "Enable Receiving" stays OFF deliberately;
// switching it on would repoint the root MX and break the receiving that works
// today). So the sender moves now too. EMAIL_FROM still wins, so the deploy
// decides and this is only what a machine without that variable falls back to.
const ALERT_FROM = process.env.EMAIL_FROM || 'info@oxxovo.ai'

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
    // ★Log the Resend message id on success. "Accepted" and "delivered" are
    // different claims, and without the id there is no way to look up which one
    // this send turned into -- the dashboard's Emails log is keyed by it.
    const id = await res
      .json()
      .then((j: { id?: string }) => j?.id)
      .catch(() => undefined)
    console.log(`[admin-alert] sent to ${ALERT_TO} (resend id ${id ?? 'unknown'}): ${subject}`)
    return true
  } catch (e) {
    console.error('[admin-alert] send failed:', e instanceof Error ? e.message : e)
    return false
  }
}
