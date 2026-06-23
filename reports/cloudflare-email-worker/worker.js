// OXXOVO inbound email Worker -- runs on Cloudflare Email Routing.
//
// Flow: mail to info@oxxovo.com -> this Worker ->
//   1. parse the MIME (postal-mime) into {from, subject, text, message-id}
//   2. POST parsed JSON to the Next.js webhook (/api/email/inbound) with the
//      shared secret -> the webhook does KB v4 auto-reply / escalation
//   3. forward the ORIGINAL message to the ops inbox (FORWARD_TO) so a human
//      always has the raw email on record, independent of the webhook.
//
// Deliberately dumb: all classification, rate-limiting, loop-guarding and
// sending live in the Next.js route (one source of truth). The Worker only
// parses + relays + forwards. If the webhook is down, the forward still lands.
//
// Required env (wrangler.toml [vars] / secrets):
//   INBOUND_WEBHOOK_URL   e.g. https://www.oxxovo.ai/api/email/inbound
//   EMAIL_INBOUND_SECRET  shared secret, also set in Vercel (same value)
//   FORWARD_TO            verified Cloudflare destination addr (ops inbox)

import PostalMime from 'postal-mime'

// Header names we relay so the webhook's loop/spam guard can see them.
const RELAY_HEADERS = [
  'auto-submitted',
  'precedence',
  'list-id',
  'list-unsubscribe',
  'message-id',
]

export default {
  async email(message, env, ctx) {
    // 1. Forward the original to ops first (most important: never lose a mail).
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO)
      } catch (e) {
        console.error('forward failed:', e && e.message)
      }
    }

    // 2. Parse the MIME for a clean text body + Message-ID.
    let parsed = {}
    try {
      parsed = await new PostalMime().parse(message.raw)
    } catch (e) {
      console.error('parse failed:', e && e.message)
    }

    const headers = {}
    for (const name of RELAY_HEADERS) {
      const v = message.headers.get(name)
      if (v) headers[name] = v
    }

    const text =
      (parsed.text && parsed.text.trim()) ||
      (parsed.html ? stripHtml(parsed.html) : '') ||
      ''

    const payload = {
      messageId: message.headers.get('message-id') || (parsed.messageId ?? null),
      from: message.from, // envelope sender (bare address)
      to: message.to, // recipient alias that matched the route
      subject: (parsed.subject ?? message.headers.get('subject') ?? '').toString(),
      text,
      headers,
    }

    // 3. Relay to the webhook (best-effort; the forward above is the safety net).
    if (env.INBOUND_WEBHOOK_URL && env.EMAIL_INBOUND_SECRET) {
      ctx.waitUntil(
        fetch(env.INBOUND_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-inbound-secret': env.EMAIL_INBOUND_SECRET,
          },
          body: JSON.stringify(payload),
        })
          .then(async (r) => {
            if (!r.ok) console.error('webhook non-2xx:', r.status, await r.text())
          })
          .catch((e) => console.error('webhook fetch failed:', e && e.message)),
      )
    }
  },
}

// Minimal HTML -> text fallback for senders that ship HTML-only bodies.
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
