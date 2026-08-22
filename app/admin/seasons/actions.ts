'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { seasonSchema, type SeasonInput } from '@/lib/season-schema'
import {
  grantStudioTestAccess,
  revokeStudioTestAccess,
  listStudioTestAccess,
  type StudioTestAccessListRow,
  type GrantResult,
} from '@/lib/studio-test-access'

export type SeasonFormState = {
  ok: boolean
  // i18n key for canned messages — client looks up the translation.
  // Untranslated raw text (DB error, unknown failures) goes into errorMessage.
  messageKey?: 'validation_failed' | 'saved'
  errorMessage?: string
  fieldErrors?: Record<string, string[]>
}

// Fields the form encodes as a hidden JSON-string input (array/nullable-array
// values FormData itself cannot represent) rather than a plain form field.
const JSON_FIELDS = new Set([
  'ai_models',
  'deadline_reminder_hours',
  'registration_reminder_days',
  'allowed_video_platforms',
])

function parseFormData(formData: FormData): unknown {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (JSON_FIELDS.has(key)) {
      try {
        raw[key] = JSON.parse(value as string)
      } catch {
        raw[key] = key === 'registration_reminder_days' ? null : []
      }
      continue
    }
    raw[key] = value
  }
  return raw
}

async function persistSeason(input: SeasonInput, id?: string) {
  const supabase = createSupabaseAdmin()
  const payload = { ...input, updated_at: new Date().toISOString() }

  if (id) {
    const { error } = await supabase.from('seasons').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
    return id
  }

  const { data, error } = await supabase
    .from('seasons')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export type DeleteSeasonResult =
  | { ok: true }
  | { ok: false; reason: 'has_applications' | 'has_generation_jobs' | 'has_render_jobs'; count: number }
  | { ok: false; reason: 'unknown'; message: string }

// HQ 2026-08-16: seasons.id is referenced by genesis_applications /
// generation_jobs / render_jobs, all NO ACTION/RESTRICT (verified live --
// see reports/seasons_fk_cascade_check_2026-08-16.sql), so a season with any
// of the three can never actually be deleted -- the FK constraint refuses it
// atomically, nothing is ever partially removed. But the raw Postgres
// rejection ("violates foreign key constraint... on table
// \"genesis_applications\"") means nothing to a non-technical operator.
// Pre-checking and returning a typed reason (translated in
// DeleteSeasonButton.tsx) answers "why" the way TK actually asked for it:
// "참가자 N명이 있어 지울 수 없습니다."
export async function deleteSeason(id: string): Promise<DeleteSeasonResult> {
  await requireAdmin()
  if (!id) return { ok: false, reason: 'unknown', message: 'Season id required' }

  const supabase = createSupabaseAdmin()

  const [apps, gens, renders] = await Promise.all([
    supabase.from('genesis_applications').select('id', { count: 'exact', head: true }).eq('season_id', id),
    supabase.from('generation_jobs').select('id', { count: 'exact', head: true }).eq('season_id', id),
    supabase.from('render_jobs').select('id', { count: 'exact', head: true }).eq('season_id', id),
  ])
  if ((apps.count ?? 0) > 0) return { ok: false, reason: 'has_applications', count: apps.count as number }
  if ((gens.count ?? 0) > 0) return { ok: false, reason: 'has_generation_jobs', count: gens.count as number }
  if ((renders.count ?? 0) > 0) return { ok: false, reason: 'has_render_jobs', count: renders.count as number }

  const { error } = await supabase.from('seasons').delete().eq('id', id)
  if (error) return { ok: false, reason: 'unknown', message: error.message }

  revalidatePath('/')
  revalidatePath('/apply')
  revalidatePath('/rules')
  revalidatePath('/faq')
  revalidatePath('/about')
  revalidatePath('/admin')
  revalidatePath('/admin/seasons')

  redirect('/admin/seasons?deleted=1')
}

export async function saveSeason(
  id: string | null,
  _prev: SeasonFormState,
  formData: FormData,
): Promise<SeasonFormState> {
  await requireAdmin()

  const parsed = seasonSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    return { ok: false, messageKey: 'validation_failed', fieldErrors }
  }

  try {
    const newId = await persistSeason(parsed.data, id ?? undefined)
    revalidatePath('/')
    revalidatePath('/apply')
    revalidatePath('/rules')
    revalidatePath('/faq')
    revalidatePath('/about')
    revalidatePath('/admin')
    revalidatePath('/admin/seasons')
    if (id) revalidatePath(`/admin/seasons/${id}`)

    if (!id) {
      redirect(`/admin/seasons/${newId}?saved=1`)
    }
    return { ok: true, messageKey: 'saved' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { ok: false, errorMessage: msg }
  }
}

// ─── Studio test access (HQ 2026-08-22) ─────────────────────────────────────
// Admin-granted, season-scoped, expiry-required bypass of the registration+
// membership gate -- see lib/studio-test-access.ts / lib/studio.ts
// checkStudioAccess for why. All three actions require admin (requireAdmin
// throws/redirects otherwise, same as every other action in this file).

export async function listStudioTestAccessAction(seasonId: string): Promise<StudioTestAccessListRow[]> {
  await requireAdmin()
  return listStudioTestAccess(seasonId)
}

export async function grantStudioTestAccessAction(input: {
  seasonId: string
  email: string
  expiresAt: string
  note?: string
}): Promise<GrantResult> {
  const admin = await requireAdmin()
  const res = await grantStudioTestAccess({
    email: input.email,
    seasonId: input.seasonId,
    grantedBy: admin.id,
    expiresAt: input.expiresAt,
    note: input.note,
  })
  if (res.ok) revalidatePath(`/admin/seasons/${input.seasonId}`)
  return res
}

export async function revokeStudioTestAccessAction(
  id: string,
  seasonId: string,
): Promise<{ ok: boolean }> {
  await requireAdmin()
  const res = await revokeStudioTestAccess(id)
  if (res.ok) revalidatePath(`/admin/seasons/${seasonId}`)
  return res
}
