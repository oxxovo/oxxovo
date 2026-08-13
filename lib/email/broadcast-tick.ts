// Admin recipient-console send loop -- consumes admin_broadcasts rows that
// were already queued (recipient_emails populated) by the /admin/broadcasts
// screen (not yet built; this loop is built first on purpose -- see HQ
// 2026-08-12: a screen in front of a loop that doesn't run yet is a screen
// that lies about what it just did).
//
// One campaign per tick, sliced by the SAME TickBudget pattern email-tick
// uses (lib/email/deferral.ts) -- 450 recipients at the measured per-send
// cost do not fit in one 300s Vercel invocation, so this tick sends as many
// as the budget allows and leaves the rest for the next tick. That is
// "carrying over", not "stuck" -- see runBroadcastTick's status handling.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { makeTickBudget, budgetAllows, budgetRecord } from './deferral'
import { planBroadcastSend } from './broadcast'
import { sendAdminBroadcast } from './send'
import { logEmail } from './log'
import type { EmailConsentRow } from './consent'

type CampaignRow = {
  id: string
  segment: string
  segment_season_id: string | null
  subject: string
  body_text: string
  poster_image_url: string | null
  promo_video_url: string | null
  recipient_emails: string[]
  status: string
}

export type BroadcastTickReport = {
  ranAt: string
  campaignId: string | null
  processedThisTick: number
  sentThisTick: number
  skippedThisTick: number
  failedThisTick: number
  // Counts recomputed from email_logs after this tick -- the durable totals,
  // not "however far this invocation personally got".
  totalSent: number
  totalSkipped: number
  totalFailed: number
  totalRecipients: number
  remaining: number
  campaignStatus: string | null
}

const EMPTY_REPORT = (ranAt: string): BroadcastTickReport => ({
  ranAt,
  campaignId: null,
  processedThisTick: 0,
  sentThisTick: 0,
  skippedThisTick: 0,
  failedThisTick: 0,
  totalSent: 0,
  totalSkipped: 0,
  totalFailed: 0,
  totalRecipients: 0,
  remaining: 0,
  campaignStatus: null,
})

export async function runBroadcastTick(
  startedAtMs: number = Date.now(),
): Promise<BroadcastTickReport> {
  const admin = createSupabaseAdmin()
  const nowIso = new Date().toISOString()

  // Oldest due campaign first: NULL scheduled_at (send ASAP) or a past
  // scheduled_at. One at a time -- a second queued campaign waits for the
  // next tick rather than splitting this tick's budget two ways.
  const { data: due, error: dueErr } = await admin
    .from('admin_broadcasts')
    .select(
      'id, segment, segment_season_id, subject, body_text, poster_image_url, promo_video_url, recipient_emails, status',
    )
    .in('status', ['queued', 'sending'])
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(1)

  if (dueErr) {
    console.error('[broadcast-tick] load due campaign failed:', dueErr.message)
    return EMPTY_REPORT(nowIso)
  }

  const campaign = (due ?? [])[0] as CampaignRow | undefined
  if (!campaign) return EMPTY_REPORT(nowIso)

  if (campaign.status === 'queued') {
    await admin.from('admin_broadcasts').update({ status: 'sending' }).eq('id', campaign.id)
  }

  // Who this campaign has already accounted for, from any prior tick.
  // email_logs is the durable ledger -- if a previous tick was killed
  // mid-loop, whatever it DID log is still correct and must not be re-sent.
  const { data: doneRows } = await admin
    .from('email_logs')
    .select('to_email')
    .eq('template_key', 'admin_broadcast')
    .eq('metadata->>campaign_id', campaign.id)

  const alreadyProcessed = new Set(
    ((doneRows ?? []) as { to_email: string }[]).map((r) => r.to_email.trim().toLowerCase()),
  )
  const remainingEmails = campaign.recipient_emails.filter(
    (e) => !alreadyProcessed.has(e.trim().toLowerCase()),
  )

  let sentThisTick = 0
  let skippedThisTick = 0
  let failedThisTick = 0
  let processedThisTick = 0

  if (remainingEmails.length > 0) {
    const budget = makeTickBudget(startedAtMs)

    for (const email of remainingEmails) {
      if (!budgetAllows(budget)) break

      // ★Cancellation must land inside a still-running tick, not just on the
      // next cron firing -- an operator who catches a mistake mid-send needs
      // this to stop within seconds, not up to 15 more minutes. Cheap single-
      // row read; the loop already spends more than this per recipient.
      const { data: liveStatus } = await admin
        .from('admin_broadcasts')
        .select('status')
        .eq('id', campaign.id)
        .maybeSingle()
      if (liveStatus?.status === 'canceled') break

      const t0 = Date.now()

      // Fresh read, not the queue-time snapshot -- this is the entire point
      // of re-checking (HQ 2026-08-12): consent can be withdrawn between
      // queuing and this tick actually reaching the recipient.
      const { data: profileRow } = await admin
        .from('profiles')
        .select('email_opt_in, email_opt_out_at')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      const liveConsent = new Map<string, EmailConsentRow>()
      if (profileRow) liveConsent.set(email.trim().toLowerCase(), profileRow as EmailConsentRow)

      const plan = planBroadcastSend([email], liveConsent)

      if (plan.toSkip.length > 0) {
        await logEmail({
          seasonId: campaign.segment_season_id,
          toEmail: email,
          templateKey: 'admin_broadcast',
          language: 'en',
          subject: '(skipped -- no marketing consent at send time)',
          status: 'skipped',
          metadata: { campaign_id: campaign.id, segment: campaign.segment, reason: 'no_consent' },
        })
        skippedThisTick++
      } else {
        const result = await sendAdminBroadcast({
          toEmail: email,
          subject: campaign.subject,
          bodyText: campaign.body_text,
          posterImageUrl: campaign.poster_image_url,
          promoVideoUrl: campaign.promo_video_url,
          seasonId: campaign.segment_season_id,
          campaignId: campaign.id,
          segment: campaign.segment,
        })
        if (result.ok) sentThisTick++
        else failedThisTick++
      }

      processedThisTick++
      budgetRecord(budget, Date.now() - t0)
    }
  }

  // Recompute totals from email_logs (source of truth), not accumulated from
  // this invocation's in-memory counters -- if THIS tick gets killed after
  // some sends but before this final update, the next tick's read here must
  // still equal exactly what email_logs says, not "old total + however far
  // we individually got before dying".
  const { data: allLogRows } = await admin
    .from('email_logs')
    .select('status')
    .eq('template_key', 'admin_broadcast')
    .eq('metadata->>campaign_id', campaign.id)

  const totals = { sent: 0, skipped: 0, failed: 0 }
  for (const r of (allLogRows ?? []) as { status: string }[]) {
    if (r.status === 'sent') totals.sent++
    else if (r.status === 'skipped') totals.skipped++
    else if (r.status === 'failed') totals.failed++
  }

  const totalAccounted = totals.sent + totals.skipped + totals.failed
  const totalRecipients = campaign.recipient_emails.length

  // ★Re-read status rather than trust the loop's own "did I break on cancel"
  // flag -- an operator could cancel in the gap between the loop's last
  // status check and this final write. A canceled campaign must stay
  // canceled (counts still get the honest update); it is not "done" just
  // because every recipient happened to be accounted for by the time it
  // stopped, and it does not get resurrected to 'sending'.
  const { data: currentRow } = await admin
    .from('admin_broadcasts')
    .select('status')
    .eq('id', campaign.id)
    .maybeSingle()

  // "carrying over", not "stuck": status stays 'sending' with an accurate
  // remaining count so the screen reads as in-progress, not silent failure --
  // otherwise an operator re-queues the same campaign and double-sends the
  // part that already went out.
  const newStatus =
    currentRow?.status === 'canceled'
      ? 'canceled'
      : totalAccounted >= totalRecipients
        ? 'done'
        : 'sending'

  await admin
    .from('admin_broadcasts')
    .update({
      sent_count: totals.sent,
      skipped_count: totals.skipped,
      failed_count: totals.failed,
      status: newStatus,
    })
    .eq('id', campaign.id)

  return {
    ranAt: nowIso,
    campaignId: campaign.id,
    processedThisTick,
    sentThisTick,
    skippedThisTick,
    failedThisTick,
    totalSent: totals.sent,
    totalSkipped: totals.skipped,
    totalFailed: totals.failed,
    totalRecipients,
    remaining: totalRecipients - totalAccounted,
    campaignStatus: newStatus,
  }
}
