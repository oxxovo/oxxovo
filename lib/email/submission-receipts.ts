// ⑤ -- the one place that decides whether a submission receipt is owed and
// sends it. SERVER ONLY.
//
// ★Two callers, one function, on purpose. The participant's own submit action
// calls it for their row so the receipt is immediate; email-tick calls it for the
// whole season so a send that failed (or a submission that arrived through a path
// nobody wired) is picked up later. Both go through executeSend's dedup, so the
// sweep is a no-op whenever the immediate send worked, and neither caller can
// produce a second receipt.
//
// This is the shape lib/studio already uses for finalize: the tick sweeps every
// pending row hourly, and a participant looking at their own render triggers it
// for their own row so they are not waiting on the cron. Copying that shape here
// means the receipt has a retry without the submit path having to own one.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { canSend } from './log'
import { sendSubmissionReceived, sendMainRoundSubmissionReceived } from './send'
import {
  submissionReceiptRounds,
  submissionReceiptTemplate,
  submissionFileState,
} from '@/lib/submission-receipt'
import { formatDeadlinePT } from '@/lib/seasons'

export type ReceiptTally = { sent: number; skipped: number; failed: number; deferred: number }

// Same reasoning as VIDEO_LIVE_MAX_PER_TICK: the sweep runs inside a cron
// function with a declared budget, and a truncated run must say so rather than
// look complete. Ignored for the single-row call.
const RECEIPTS_MAX_PER_SWEEP = 120

type ReceiptRow = {
  id: string
  email: string
  creator_name: string | null
  country: string | null
  video_title: string | null
  studio_application_submitted_at: string | null
  free_entry_url: string | null
  main_round_submitted_at: string | null
  main_round_video_url: string | null
}

export async function sendSubmissionReceipts(opts: {
  seasonId: string
  seasonName: string
  // Either narrows the run to one participant -- the immediate path. The submit
  // action knows the address it authenticated with, not the application id, and
  // matching by email (case-insensitive) is how every other caller in this repo
  // finds an entry.
  applicationId?: string
  email?: string
}): Promise<ReceiptTally> {
  const tally: ReceiptTally = { sent: 0, skipped: 0, failed: 0, deferred: 0 }
  const single = !!(opts.applicationId || opts.email)
  const admin = createSupabaseAdmin()

  let q = admin
    .from('genesis_applications')
    .select(
      'id, email, creator_name, country, video_title, studio_application_submitted_at, free_entry_url, main_round_submitted_at, main_round_video_url',
    )
    .eq('season_id', opts.seasonId)
    // The rule still runs per row; this only keeps the sweep from reading every
    // application in the season on every tick. ★Both columns, or the main-round
    // receipt would never reach a Finalist who submitted through the URL form
    // and therefore has no studio_application_submitted_at.
    .or('studio_application_submitted_at.not.is.null,main_round_submitted_at.not.is.null')
  if (opts.applicationId) q = q.eq('id', opts.applicationId)
  if (opts.email) q = q.ilike('email', opts.email)

  const { data: rowsRaw, error } = await q
  if (error) {
    console.error('[receipts] entry load failed:', error.message)
    tally.failed++
    return tally
  }
  const rows = (rowsRaw ?? []) as ReceiptRow[]
  if (rows.length === 0) return tally

  // Bulk "already sent" read, so the steady state is one query per sweep instead
  // of one per row. Only worth it for the sweep; the single-row path goes
  // straight to canSend, which is one query either way.
  const already = new Set<string>()
  if (!single) {
    const { data: sentRaw } = await admin
      .from('email_logs')
      .select('application_id, template_key')
      .eq('season_id', opts.seasonId)
      .in('template_key', ['studio_submission_received', 'main_round_submission_received'])
      .eq('status', 'sent')
    for (const r of (sentRaw ?? []) as { application_id: string; template_key: string }[]) {
      already.add(`${r.application_id}:${r.template_key}`)
    }
  }

  let budget = single ? rows.length : RECEIPTS_MAX_PER_SWEEP

  for (const row of rows) {
    for (const round of submissionReceiptRounds(row)) {
      const template = submissionReceiptTemplate(round)
      if (already.has(`${row.id}:${template}`)) {
        tally.skipped++
        continue
      }
      if (budget <= 0) {
        tally.deferred++
        continue
      }
      const verdict = await canSend(row.id, template)
      if (!verdict.ok) {
        tally.skipped++
        continue
      }
      budget--

      const input = {
        toEmail: row.email,
        country: row.country,
        // creator_name is what the entry publishes under; the address local part
        // is the last resort so the greeting is never blank.
        creatorName: row.creator_name?.trim() || row.email.split('@')[0],
        seasonName: opts.seasonName,
        videoTitle: row.video_title?.trim() || null,
        // ★Per round. Stamping a main-round receipt with the preliminary
        // submission time would put a date a week earlier on it.
        submittedAtLabel: formatDeadlinePT(
          round === 'main' ? row.main_round_submitted_at : row.studio_application_submitted_at,
        ),
        fileState: submissionFileState(row, round),
        applicationId: row.id,
        seasonId: opts.seasonId,
      }
      const result =
        round === 'main'
          ? await sendMainRoundSubmissionReceived(input)
          : await sendSubmissionReceived(input)
      if (!result.ok) tally.failed++
      else if ('skipped' in result && result.skipped) tally.skipped++
      else tally.sent++
    }
  }

  if (tally.deferred > 0) {
    console.warn(
      `[receipts] ${opts.seasonId}: ${tally.deferred} receipts deferred to the next tick (cap ${RECEIPTS_MAX_PER_SWEEP}).`,
    )
  }
  return tally
}
