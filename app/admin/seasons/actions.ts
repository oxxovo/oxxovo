'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { seasonSchema, type SeasonInput } from '@/lib/season-schema'

export type SeasonFormState = {
  ok: boolean
  // i18n key for canned messages — client looks up the translation.
  // Untranslated raw text (DB error, unknown failures) goes into errorMessage.
  messageKey?: 'validation_failed' | 'saved'
  errorMessage?: string
  fieldErrors?: Record<string, string[]>
}

function parseFormData(formData: FormData): unknown {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key === 'ai_models') {
      try {
        raw[key] = JSON.parse(value as string)
      } catch {
        raw[key] = []
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

export async function deleteSeason(id: string): Promise<void> {
  await requireAdmin()
  if (!id) throw new Error('Season id required')

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('seasons').delete().eq('id', id)
  if (error) throw new Error(error.message)

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
