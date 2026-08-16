// Inbound email auto-responder webhook -- SERVER ONLY.
//
// Fed by the Cloudflare Email Worker (reports/cloudflare-email-worker.js), which
// receives mail to info@oxxovo.com, parses the MIME, and POSTs parsed JSON here
// with the shared secret. This route is the brain + mouth:
//   1. Auth: constant shared secret in the x-inbound-secret header.
//   2. Loop / spam guard: never reply to ourselves, auto-replies, bulk/list
//      mail, no-reply senders, or "Auto:"/"Out of office" subjects. These are
//      the classic auto-responder footguns (infinite loops, list blasts).
//   3. Dedup: Message-ID is the unique key in email_inbound_log.
//   4. Rate cap: per-sender daily limit on actioned messages.
//   5. classifyAndDraft (KB v4): in-scope -> Resend auto-reply (threaded);
//      out-of-scope / sensitive -> escalate to ops AND send the sender a neutral
//      "received, a human will reply" ack (no outcome stated, idempotent).
//   6. Every decision is logged to email_inbound_log (admin transparency).
//
// Fail safe everywhere: a parsing/model/DB hiccup escalates or no-ops rather
// than silently dropping a customer email.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getResend, EMAIL_FROM } from '@/lib/email/client'
import { sendAdminAlert } from '@/lib/email/admin-alert'
import { classifyAndDraft } from '@/lib/email/inbound-reply'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Max auto-replies OR escalations per sender per UTC day. Beyond this we skip
// (someone hammering info@ can't turn us into their personal reply bot).
const PER_SENDER_DAILY_CAP = 6

type InboundBody = {
  messageId?: string
  from?: string
  to?: string
  subject?: string
  text?: string
  // Lowercased header map from the Worker (auto-submitted, precedence, list-id...).
  headers?: Record<string, string>
}

type Action = 'replied' | 'escalated' | 'skipped'

// Extract a bare lowercased address from "Name <a@b.com>" or "a@b.com".
function normalizeAddr(raw: string | undefined): string {
  if (!raw) return ''
  const m = raw.match(/<([^>]+)>/)
  const addr = (m ? m[1] : raw).trim().toLowerCase()
  return addr
}

// Decide whether this message must NOT receive an auto-reply (loop/spam guard).
// Returns a skip_reason string, or null if it's safe to process.
function loopGuard(from: string, subject: string, headers: Record<string, string>): string | null {
  if (!from) return 'no_sender'
  // Never reply to ourselves or the team -> would loop with our own sends.
  // Match the registrable domain AND any subdomain: our escalation alerts go out
  // via Resend whose envelope sender is on send.oxxovo.com (a subdomain), so a
  // plain endsWith('@oxxovo.com') missed them and caused an infinite loop.
  const domain = from.split('@')[1] ?? ''
  if (
    domain === 'oxxovo.com' || domain.endsWith('.oxxovo.com') ||
    domain === 'oxxovo.ai' || domain.endsWith('.oxxovo.ai')
  ) {
    return 'self_send'
  }
  // Our own escalation notifications -- never re-process them (loop breaker).
  if (/\[inbound\]\s*(needs human|auto-reply failed)/i.test(subject)) return 'escalation_loop'
  // Unattended / system senders.
  if (/(^|[._-])(no-?reply|donotreply|mailer-daemon|postmaster|bounce)/.test(from)) {
    return 'no_reply_sender'
  }
  // RFC 3834: any auto-generated mail marks itself. Only 'no' means human.
  const autoSub = (headers['auto-submitted'] ?? '').toLowerCase()
  if (autoSub && autoSub !== 'no') return 'auto_submitted'
  // Bulk / mailing-list traffic.
  const prec = (headers['precedence'] ?? '').toLowerCase()
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return 'bulk'
  if (headers['list-id'] || headers['list-unsubscribe']) return 'list'
  // Vacation / auto-reply subjects (EN + KR).
  if (/^\s*(re:\s*)?(auto(matic)?(\s|-)?(reply|response)|out of office|부재중|자동\s*(회신|응답))/i.test(subject)) {
    return 'auto_subject'
  }
  return null
}

async function logInbound(row: {
  messageId: string | null
  from: string
  to: string
  subject: string
  action: Action
  skipReason?: string | null
  replySent?: boolean
}): Promise<void> {
  try {
    const admin = createSupabaseAdmin()
    await admin.from('email_inbound_log').insert({
      message_id: row.messageId,
      from_email: row.from,
      to_email: row.to,
      subject: row.subject.slice(0, 500),
      action: row.action,
      skip_reason: row.skipReason ?? null,
      reply_sent: row.replySent ?? false,
    })
  } catch (e) {
    // Table missing / unique race -> never break the request path.
    console.error('[inbound] log failed:', e instanceof Error ? e.message : e)
  }
}

export async function POST(req: NextRequest) {
  // 1. Shared-secret auth.
  const secret = process.env.EMAIL_INBOUND_SECRET
  if (!secret) {
    console.error('[inbound] EMAIL_INBOUND_SECRET missing')
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (req.headers.get('x-inbound-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Parse body.
  let body: InboundBody
  try {
    body = (await req.json()) as InboundBody
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const from = normalizeAddr(body.from)
  const to = normalizeAddr(body.to) || 'info@oxxovo.ai'
  const subject = (body.subject ?? '').trim()
  const text = (body.text ?? '').trim()
  const messageId = (body.messageId ?? '').trim() || null
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(body.headers ?? {})) {
    headers[k.toLowerCase()] = String(v)
  }

  const admin = createSupabaseAdmin()

  // 3. Dedup on Message-ID (Cloudflare can retry).
  // ★FAIL-CLOSED (2026-08-16, head office). A query error here (permission,
  // RLS, a dropped column, a network blip) used to be silently discarded --
  // only `data` was read, never `error` -- so "can't tell if this is a
  // duplicate" read as "not a duplicate" and the auto-reply went out anyway.
  // That is the exact failure this gate exists to prevent. Uncertain now
  // means skip, not send: a customer email that isn't auto-processed during a
  // DB hiccup can still be followed up by a human; a duplicate reply cannot be
  // un-sent.
  if (messageId) {
    const { data: existing, error: dedupErr } = await admin
      .from('email_inbound_log')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle()
    if (dedupErr) {
      console.error('[inbound] dedup check failed, skipping rather than risking a duplicate reply:', dedupErr.message)
      await logInbound({ messageId, from, to, subject, action: 'skipped', skipReason: 'db_error' })
      return NextResponse.json({ ok: true, action: 'skipped', reason: 'db_error' })
    }
    if (existing) {
      return NextResponse.json({ ok: true, action: 'skipped', reason: 'duplicate' })
    }
  }

  // 4. Loop / spam guard.
  const skip = loopGuard(from, subject, headers)
  if (skip) {
    await logInbound({ messageId, from, to, subject, action: 'skipped', skipReason: skip })
    return NextResponse.json({ ok: true, action: 'skipped', reason: skip })
  }

  // 5. Per-sender daily cap (counts actioned messages: replies + escalations).
  // ★FAIL-CLOSED (2026-08-16, head office) -- same shape as the dedup fix
  // above. `count` used to be read with the error silently dropped, so a
  // query failure produced `count = null` -> `(count ?? 0) >= CAP` was always
  // false -> the cap that exists specifically so "someone hammering info@
  // can't turn us into their personal reply bot" (this file's own comment)
  // was the one gate a DB hiccup disabled outright. Can't count -> can't
  // confirm under the cap -> treated as AT the cap.
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count, error: capErr } = await admin
    .from('email_inbound_log')
    .select('id', { count: 'exact', head: true })
    .eq('from_email', from)
    .in('action', ['replied', 'escalated'])
    .gte('created_at', since.toISOString())
  if (capErr) {
    console.error('[inbound] rate-cap check failed, treating as at-cap rather than unlimited:', capErr.message)
    await logInbound({ messageId, from, to, subject, action: 'skipped', skipReason: 'db_error' })
    return NextResponse.json({ ok: true, action: 'skipped', reason: 'db_error' })
  }
  if ((count ?? 0) >= PER_SENDER_DAILY_CAP) {
    await logInbound({ messageId, from, to, subject, action: 'skipped', skipReason: 'rate_cap' })
    return NextResponse.json({ ok: true, action: 'skipped', reason: 'rate_cap' })
  }

  // 6. Classify with KB v4.
  const decision = await classifyAndDraft({ subject, body: text })

  if (decision.action === 'escalate') {
    // Forward to ops -- a human writes the real reply (no KB answer on sensitive
    // topics). We still send the SENDER a neutral "received" ack so they aren't
    // left in silence; the ack states nothing about the outcome.
    const safeSubject = subject || '(no subject)'
    await sendAdminAlert(
      `[Inbound] Needs human: ${safeSubject}`,
      escalationHtml({ from, subject: safeSubject, reason: decision.reason, text }),
    )
    // Skip the ack for empty/system-ish escalations -- nothing to acknowledge.
    const ackEligible = decision.reason !== 'empty_body' && decision.reason !== 'no_api_key'
    const ackSent = ackEligible ? await sendReceiptAck({ from, subject, body: text, messageId }) : false
    await logInbound({ messageId, from, to, subject, action: 'escalated', replySent: ackSent })
    return NextResponse.json({ ok: true, action: 'escalated', reason: decision.reason, ack: ackSent })
  }

  // In-scope: send the threaded auto-reply via Resend.
  let replySent = false
  try {
    const resend = getResend()
    const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject || 'Your message'}`
    // Tag every auto-reply as auto-generated (RFC 3834) + suppress vacation
    // bounce-backs. If it ever loops back to info@, our loopGuard catches it.
    const replyHeaders: Record<string, string> = {
      'Auto-Submitted': 'auto-replied',
      'X-Auto-Response-Suppress': 'All',
      ...(messageId ? { 'In-Reply-To': messageId, References: messageId } : {}),
    }
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: from,
      subject: replySubject,
      text: `${decision.reply}\n\n— OXXOVO Team\ninfo@oxxovo.ai`,
      replyTo: 'info@oxxovo.ai',
      headers: replyHeaders,
    })
    if (error) {
      console.error('[inbound] resend error:', error.message)
    } else {
      replySent = true
    }
  } catch (e) {
    console.error('[inbound] reply send failed:', e instanceof Error ? e.message : e)
  }

  // If the reply failed to send, escalate so the customer isn't left hanging.
  if (!replySent) {
    await sendAdminAlert(
      `[Inbound] Auto-reply FAILED: ${subject || '(no subject)'}`,
      escalationHtml({ from, subject: subject || '(no subject)', reason: 'reply_send_failed', text }),
    )
    await logInbound({ messageId, from, to, subject, action: 'escalated', skipReason: 'reply_send_failed' })
    return NextResponse.json({ ok: true, action: 'escalated', reason: 'reply_send_failed' })
  }

  await logInbound({ messageId, from, to, subject, action: 'replied', replySent: true })
  return NextResponse.json({ ok: true, action: 'replied' })
}

// Korean if any Hangul syllable is present (subject + body), else English.
function isKorean(s: string): boolean {
  return /[가-힣]/.test(s)
}

// "We received your message" acknowledgement sent to the SENDER on escalation.
// Sensitive mail (refund/legal/etc.) is forwarded to ops with no KB answer, so
// without this the sender hears nothing. Deliberately says nothing about the
// outcome (e.g. refund yes/no) -- only that the message arrived and a human will
// reply. Idempotent: the inbound message is deduped by Message-ID and processed
// once, so exactly one ack goes out. Loop-safe: tagged Auto-Submitted +
// X-Auto-Response-Suppress, and if it ever bounces back to info@ the loopGuard
// (self_send / auto_submitted) drops it. Returns true if the ack was sent.
async function sendReceiptAck(o: {
  from: string
  subject: string
  body: string
  messageId: string | null
}): Promise<boolean> {
  const kr = isKorean(`${o.subject}\n${o.body}`)
  const text = kr
    ? '문의해 주셔서 감사합니다. 메일이 정상 접수되었으며, 담당자가 확인 후 곧 답변드리겠습니다.\n\n— OXXOVO 팀\ninfo@oxxovo.ai'
    : 'Thank you for contacting us. Your message has been received, and our team will review it and reply to you shortly.\n\n— OXXOVO Team\ninfo@oxxovo.ai'
  const replySubject = /^re:/i.test(o.subject) ? o.subject : `Re: ${o.subject || 'Your message'}`
  try {
    const resend = getResend()
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: o.from,
      subject: replySubject,
      text,
      replyTo: 'info@oxxovo.ai',
      headers: {
        'Auto-Submitted': 'auto-replied',
        'X-Auto-Response-Suppress': 'All',
        ...(o.messageId ? { 'In-Reply-To': o.messageId, References: o.messageId } : {}),
      },
    })
    if (error) {
      console.error('[inbound] ack send error:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[inbound] ack send failed:', e instanceof Error ? e.message : e)
    return false
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escalationHtml(o: { from: string; subject: string; reason: string; text: string }): string {
  return `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">
      <p><strong>An inbound email needs a human reply.</strong></p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:2px 8px;color:#888">From</td><td>${escape(o.from)}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Subject</td><td>${escape(o.subject)}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Reason</td><td>${escape(o.reason)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0" />
      <pre style="white-space:pre-wrap;font-family:inherit;background:#fafafa;padding:12px;border-radius:6px">${escape(
        o.text.slice(0, 4000),
      )}</pre>
    </div>`
}
