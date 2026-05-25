'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getSeasonById } from '@/lib/seasons'
import {
  sendSelectedTop50,
  sendNotSelected,
  sendAwardedContactRequest,
} from '@/lib/email/send'

export type AdminActionState = {
  ok: boolean
  messageKey?: 'notes_saved' | 'status_saved' | 'award_saved'
  errorMessage?: string
}

// Mirrors the genesis_applications.status CHECK constraint (7 values).
// 'verifying' / 'eligible' are set automatically by the oxxovo-scoring system;
// 'selected' / 'awarded' are set manually by admins.
const ALLOWED_STATUS = [
  'pending',
  'waitlist',
  'verifying',
  'eligible',
  'selected',
  'awarded',
  'rejected',
] as const
type AppStatus = (typeof ALLOWED_STATUS)[number]

export async function saveAdminNotes(id: string, notes: string): Promise<AdminActionState> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('genesis_applications')
    .update({ admin_notes: notes })
    .eq('id', id)
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath(`/admin/applications/${id}`)
  return { ok: true, messageKey: 'notes_saved' }
}

export async function saveStatus(id: string, status: string): Promise<AdminActionState> {
  await requireAdmin()
  if (!ALLOWED_STATUS.includes(status as AppStatus)) {
    return { ok: false, errorMessage: `Invalid status: ${status}` }
  }
  const supabase = await createSupabaseServer()
  // `.select().single()` returns the updated row, including email/country/
  // creator_name/season_id, which the email helpers need.
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update({ status })
    .eq('id', id)
    .select('id, email, country, creator_name, season_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)

  // Side-effect: fire status-change notifications. Per automation philosophy,
  // there is no separate "Send email" admin button — the email IS the action.
  // Dedup in executeSend() prevents double-sends if the same status is saved
  // twice. Errors do not roll back the status change.
  if (status === 'selected' || status === 'rejected') {
    try {
      const season = await getSeasonById(row.season_id)
      if (!season) {
        console.error('[saveStatus] season missing — skipping email', row.season_id)
      } else if (status === 'selected') {
        await sendSelectedTop50({
          toEmail: row.email,
          country: row.country,
          creatorName: row.creator_name,
          seasonName: season.display_name,
          topNAdvance: season.top_n_advance,
          mainRoundStartAt: season.main_round_start_at,
          applicationId: row.id,
          seasonId: season.id,
        })
      } else {
        await sendNotSelected({
          toEmail: row.email,
          country: row.country,
          creatorName: row.creator_name,
          seasonName: season.display_name,
          applicationId: row.id,
          seasonId: season.id,
        })
      }
    } catch (e) {
      console.error('[saveStatus] email send error:', e)
    }
  }

  return { ok: true, messageKey: 'status_saved' }
}

export async function saveAwardRank(
  id: string,
  rank: number | null,
): Promise<AdminActionState> {
  await requireAdmin()
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
    return { ok: false, errorMessage: 'Award rank must be 1-99 or null' }
  }
  const supabase = await createSupabaseServer()
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update({ award_rank: rank })
    .eq('id', id)
    .select('id, email, country, creator_name, season_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  revalidatePath('/admin/contacts')

  // Auto-fire the prize payout request the moment a top-3 rank is set.
  // Dedup ensures re-saving the same rank (or toggling away and back) does
  // not re-trigger the email.
  if (rank === 1 || rank === 2 || rank === 3) {
    try {
      const season = await getSeasonById(row.season_id)
      if (!season) {
        console.error('[saveAwardRank] season missing — skipping email', row.season_id)
      } else {
        const prize =
          rank === 1
            ? season.prize_first
            : rank === 2
              ? season.prize_second
              : season.prize_third
        const extras = season.award_prizes[String(rank)] ?? {}
        await sendAwardedContactRequest({
          toEmail: row.email,
          country: row.country,
          creatorName: row.creator_name,
          seasonName: season.display_name,
          awardRank: rank,
          prizeAmountUsd: prize,
          extras,
          applicationId: row.id,
          seasonId: season.id,
        })
      }
    } catch (e) {
      console.error('[saveAwardRank] email send error:', e)
    }
  }

  return { ok: true, messageKey: 'award_saved' }
}
