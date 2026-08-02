#!/usr/bin/env node
/**
 * ★Send ONE real operational alert, to prove the alert path actually delivers.
 *
 * "We fixed the address" is not "the mail arrives" -- the same shape as a CI job
 * that never installed dependencies and a parity harness measuring a copy of the
 * code. The only proof is a human opening an inbox. This script produces the one
 * message to look for.
 *
 * ★It calls the REAL sendAdminAlert (lib/email/admin-alert.ts). It does not
 * rebuild the send, so what it proves is what production does -- including the
 * from-address, the recipient, and the Auto-Submitted headers.
 *
 *   DRY RUN (default -- sends nothing):
 *     node --env-file=.env.local --import ./scripts/test-register.mjs scripts/send-test-alert.mjs
 *
 *   SEND FOR REAL (one email):
 *     node --env-file=.env.local --import ./scripts/test-register.mjs scripts/send-test-alert.mjs --send
 *
 * Then open the inbox and look for the subject printed below. If it is not there
 * within a couple of minutes, the address is right and the DELIVERY is not --
 * check the Resend dashboard's Emails log for that message id.
 */
const send = process.argv.includes('--send')

// Same resolution the library does, printed so the operator sees WHERE it goes
// before anything is sent.
const to = process.env.OPS_ALERT_EMAIL || 'info@oxxovo.ai'
const from = process.env.EMAIL_FROM || 'info@oxxovo.com'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const subject = `[OXXOVO] alert delivery test ${stamp}`

console.log('  from :', from, process.env.EMAIL_FROM ? '(EMAIL_FROM)' : '(fallback)')
console.log('  to   :', to, process.env.OPS_ALERT_EMAIL ? '(OPS_ALERT_EMAIL)' : '(fallback)')
console.log('  key  :', process.env.RESEND_API_KEY ? 'RESEND_API_KEY present' : '★RESEND_API_KEY MISSING -- send will fail')
console.log('  subj :', subject)

if (!send) {
  console.log('\nDRY RUN -- nothing sent. Re-run with --send to send this one email.')
  process.exit(0)
}

const { sendAdminAlert } = await import('../lib/email/admin-alert.ts')
const ok = await sendAdminAlert(
  subject,
  `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
    <h2 style="color: #8B22FF;">Alert delivery test</h2>
    <p>This is a deliberate test of the operational alert path — the one the
       season-tick cron uses for pricing problems, deferrals, and integrity
       blocks. Nothing is wrong.</p>
    <p>Sent ${stamp} to <strong>${to}</strong> from <strong>${from}</strong>.</p>
    <p>If you are reading this in the inbox, the path works end to end. If it
       never arrived, the address is right and the delivery is not.</p>
  </div>`,
)
console.log(ok ? '\nResend accepted the send (2xx).' : '\n★Resend did NOT accept it -- see the error above.')
console.log('★Accepted is not delivered. The line above carries the Resend message id:')
console.log('   status: curl -s -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails/<id>')
console.log('   -> last_event: delivered | bounced | complained. Then confirm the inbox anyway.')
// Set the code rather than calling process.exit(): an immediate exit while the
// keep-alive socket is still closing aborts the process on Windows (libuv
// assertion), which looks exactly like a crashed send.
process.exitCode = ok ? 0 : 1
