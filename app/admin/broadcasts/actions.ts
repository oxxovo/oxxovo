'use server'

// /admin/broadcasts server actions. requireAdmin() gate + service_role
// (createSupabaseAdmin) throughout, same pattern as /admin/promo.
//
// Deliberately does NOT support manual recipient add/remove: the segment is
// the single source of truth for who a campaign targets. A hand-edit path
// would be a second door around the consent gate (lib/email/consent.ts
// canSendMarketingEmail) that the send loop cannot see, since the loop only
// re-checks consent for whoever ends up in recipient_emails.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type BroadcastSegment = 'all' | 'not_selected' | 'founding' | 'season'

export type SeasonOption = { id: string; name: string; season_number: number }

// Non-fixture seasons only -- same guard as /admin/contacts and the Winners
// design (rehearsal seasons must never become a real send target).
export async function listBroadcastSeasons(): Promise<SeasonOption[]> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('seasons')
    .select('id, name, season_number')
    .eq('is_fixture', false)
    .order('season_number', { ascending: false })
  return (data ?? []) as SeasonOption[]
}

// The one place segment -> recipient list is computed. Used by both the
// preview count (read-only) and the final queue (which re-runs this fresh
// rather than trusting anything the browser sent back).
async function resolveSegmentRecipients(
  segment: BroadcastSegment,
  seasonId: string | null,
): Promise<string[]> {
  const admin = createSupabaseAdmin()
  const emails = new Set<string>()

  if (segment === 'all') {
    const { data } = await admin.from('profiles').select('email')
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) emails.add(r.email.trim().toLowerCase())
    }
  } else if (segment === 'not_selected') {
    // Defined by delivery, not by status string (HQ 2026-08-12): the
    // canonical "didn't advance" cohort is whoever actually RECEIVED the
    // not_selected email, not whoever currently holds a given status value.
    const { data } = await admin
      .from('email_logs')
      .select('to_email')
      .eq('template_key', 'not_selected')
      .eq('status', 'sent')
    for (const r of (data ?? []) as { to_email: string }[]) {
      emails.add(r.to_email.trim().toLowerCase())
    }
  } else if (segment === 'founding') {
    const { data } = await admin
      .from('profiles')
      .select('email')
      .not('founding_creator_number', 'is', null)
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) emails.add(r.email.trim().toLowerCase())
    }
  } else if (segment === 'season') {
    if (!seasonId) return []
    // Defense in depth: even though the season picker only lists non-fixture
    // seasons, refuse a fixture season_id here too rather than trust the
    // dropdown alone.
    const { data: seasonRow } = await admin
      .from('seasons')
      .select('is_fixture')
      .eq('id', seasonId)
      .maybeSingle()
    if (!seasonRow || seasonRow.is_fixture) return []

    const { data } = await admin
      .from('genesis_applications')
      .select('email')
      .eq('season_id', seasonId)
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) emails.add(r.email.trim().toLowerCase())
    }
  }

  return [...emails]
}

export type PreviewBroadcastInput = {
  segment: BroadcastSegment
  seasonId: string | null
}

export type PreviewBroadcastResult = {
  count: number
  sample: string[]
}

// Read-only -- computes the count for the confirm step. Nothing is written.
export async function previewBroadcastRecipients(
  input: PreviewBroadcastInput,
): Promise<PreviewBroadcastResult> {
  await requireAdmin()
  const recipients = await resolveSegmentRecipients(input.segment, input.seasonId)
  return { count: recipients.length, sample: recipients.slice(0, 5) }
}

export type QueueBroadcastInput = {
  segment: BroadcastSegment
  seasonId: string | null
  subject: string
  bodyText: string
  posterImageUrl: string | null
  promoVideoUrl: string | null
  scheduledAt: string | null
}

export type QueueBroadcastResult =
  | { ok: true; id: string; recipientCount: number }
  | { ok: false; error: string }

// The ONLY write path that creates a campaign. Recomputes recipients fresh
// (never trusts a count/list the browser sent back from the preview step) --
// the two clicks (preview, then this) can be minutes apart and consent state
// can move in between, though the send loop re-checks again anyway at actual
// send time.
export async function queueBroadcast(
  input: QueueBroadcastInput,
): Promise<QueueBroadcastResult> {
  await requireAdmin()

  const subject = input.subject.trim()
  const bodyText = input.bodyText.trim()
  if (!subject || !bodyText) {
    return { ok: false, error: 'Subject and body are required.' }
  }
  if (input.segment === 'season' && !input.seasonId) {
    return { ok: false, error: 'Pick a season for the "season" segment.' }
  }

  const recipients = await resolveSegmentRecipients(input.segment, input.seasonId)
  if (recipients.length === 0) {
    return { ok: false, error: 'No consenting recipients in this segment right now.' }
  }

  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('admin_broadcasts')
    .insert({
      segment: input.segment,
      segment_season_id: input.segment === 'season' ? input.seasonId : null,
      subject,
      body_text: bodyText,
      poster_image_url: input.posterImageUrl?.trim() || null,
      promo_video_url: input.promoVideoUrl?.trim() || null,
      recipient_emails: recipients,
      scheduled_at: input.scheduledAt,
      status: 'queued',
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' }
  return { ok: true, id: data.id as string, recipientCount: recipients.length }
}

export type BroadcastCampaignRow = {
  id: string
  segment: string
  segment_season_id: string | null
  subject: string
  scheduled_at: string | null
  status: string
  sent_count: number
  skipped_count: number
  failed_count: number
  recipient_count: number
  created_at: string
  updated_at: string
}

export async function listBroadcasts(): Promise<BroadcastCampaignRow[]> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('admin_broadcasts')
    .select(
      'id, segment, segment_season_id, subject, scheduled_at, status, sent_count, skipped_count, failed_count, recipient_emails, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    (data ?? []) as (Omit<BroadcastCampaignRow, 'recipient_count'> & {
      recipient_emails: string[]
    })[]
  ).map((r) => ({
    id: r.id,
    segment: r.segment,
    segment_season_id: r.segment_season_id,
    subject: r.subject,
    scheduled_at: r.scheduled_at,
    status: r.status,
    sent_count: r.sent_count,
    skipped_count: r.skipped_count,
    failed_count: r.failed_count,
    recipient_count: r.recipient_emails.length,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

export type CancelBroadcastResult = { ok: true } | { ok: false; error: string }

// Takes effect from the next unprocessed recipient onward -- the tick
// (lib/email/broadcast-tick.ts) re-checks campaign status between recipients
// within the SAME invocation, so a cancel lands within that tick, not just on
// the next cron firing. It cannot recall a send already handed to Resend.
export async function cancelBroadcast(id: string): Promise<CancelBroadcastResult> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('admin_broadcasts')
    .update({ status: 'canceled' })
    .in('status', ['queued', 'sending'])
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Already done or already canceled.' }
  }
  return { ok: true }
}
