'use server'

// admin 홍보영상 서버액션. 모두 requireAdmin 게이트 + service_role(createSupabaseAdmin).
// 업로드는 signed upload URL 발급(서버) -> 브라우저 직행(Vercel 4.5MB 우회) -> 행 생성.
// video_url 은 서버가 path 에서 도출(서버 권위, 클라이언트 URL 불신).

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isValidPromoTimezone, normalizePromoTime } from '@/lib/promo-schedule'

const BUCKET = 'promo-videos'

// 확장자 화이트리스트 (버킷 allowed_mime_types 와 정합).
const EXT_OK = new Set(['mp4', 'mov', 'webm'])

function safeExt(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return EXT_OK.has(ext) ? ext : 'mp4'
}

export type CreateUploadUrlState =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string }

// 1) 브라우저가 직행 업로드할 signed URL 발급. path 는 서버가 정함.
export async function createUploadUrlAction(filename: string): Promise<CreateUploadUrlState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const path = `${randomUUID()}.${safeExt(filename)}`
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, error: error?.message ?? 'signed url failed' }
  return { ok: true, path, token: data.token }
}

export type CreatePromoState = { ok: true; id: string } | { ok: false; error: string }

// 2) 업로드 완료 후 promo_videos 행 생성. video_url 은 path 에서 서버가 도출.
export async function createPromoVideoAction(input: {
  path: string
  label?: string
  durationSeconds?: number
}): Promise<CreatePromoState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  // path 안전성: 우리 버킷이 발급한 형태(uuid.ext)만 허용.
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(input.path)) {
    return { ok: false, error: 'invalid path' }
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(input.path)
  const videoUrl = pub.publicUrl

  const { data, error } = await admin
    .from('promo_videos')
    .insert({
      source: 'uploaded',
      status: 'ready',
      video_url: videoUrl,
      theme_note: input.label?.trim() || null,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' }
  revalidatePath('/admin/promo')
  return { ok: true, id: data.id as string }
}

export type UpdatePromoMetaState = { ok: true } | { ok: false; error: string }

// Persist caption + channel selection, decoupled from both approval and
// publish. "Saved" is not "approved" -- two separate commits (HQ 2026-08-14).
export async function updatePromoMetaAction(input: {
  id: string
  caption: string
  channels: string[]
}): Promise<UpdatePromoMetaState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('promo_videos')
    .update({ caption: input.caption.trim() || null, channels: input.channels })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type SetApprovedState = { ok: true } | { ok: false; error: string }

// The one write that flips promo_videos.approved. Un-approving clears
// approved_by/approved_at too -- a re-approval always records who did it and
// when, rather than leaving a stale attribution from a prior approval.
export async function setPromoApprovedAction(id: string, approved: boolean): Promise<SetApprovedState> {
  const admin_profile = await requireAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('promo_videos')
    .update(
      approved
        ? { approved: true, approved_by: admin_profile.id, approved_at: new Date().toISOString() }
        : { approved: false, approved_by: null, approved_at: null },
    )
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type UpdateCadenceState = { ok: true } | { ok: false; error: string }

// platform_config writer for the publish cadence. TK sets these from this
// screen -- never seeded by SQL (HQ 2026-08-14): an empty `weekdays` IS the
// pause state, so an operator can stop auto-publish just by clearing it here.
//
// ★value_type IS ALWAYS PASSED. platform_config.value_type is NOT NULL with
// no default -- an upsert() compiles to `INSERT ... ON CONFLICT DO UPDATE`,
// and Postgres validates the proposed INSERT row against NOT NULL
// constraints before it even looks at the conflict, so omitting value_type
// fails EVEN THOUGH the row already exists and the statement would only ever
// UPDATE it in practice (reproduced live 2026-08-14: TK's save hit exactly
// this — "null value in column value_type ... violates not-null
// constraint" — and because all 3 rows are one upsert() call/one SQL
// statement, the failure was atomic: weekdays and time were not saved
// either, not just timezone).
//
// ★timezone is server-validated against the same closed list the <select>
// renders (lib/promo-schedule.PROMO_TIMEZONES) -- not free text. TK typed
// "korea" once; that is not an IANA name, would have saved silently, and the
// cron would then just never fire with no error anywhere.
export async function updatePromoCadenceAction(input: {
  weekdays: string[]
  time: string
  timezone: string
}): Promise<UpdateCadenceState> {
  await requireAdmin()

  const time = input.time.trim() ? normalizePromoTime(input.time) : ''
  if (input.time.trim() && time === null) {
    return { ok: false, error: `invalid time "${input.time}" -- use HH:MM` }
  }
  if (input.timezone.trim() && !isValidPromoTimezone(input.timezone.trim())) {
    return { ok: false, error: `invalid timezone "${input.timezone}"` }
  }

  const admin = createSupabaseAdmin()
  const rows = [
    { key: 'promo_publish_weekdays', value: input.weekdays.join(','), value_type: 'text' },
    { key: 'promo_publish_time', value: time ?? '', value_type: 'text' },
    { key: 'promo_publish_timezone', value: input.timezone.trim(), value_type: 'text' },
  ]
  const { error } = await admin.from('platform_config').upsert(rows, { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type DeletePromoState = { ok: true } | { ok: false; error: string }

// 3) Soft delete -- HQ 2026-08-16: "삭제를 잘못하면 항상 지수를 찾아야 되나?
// 아니다." Sets deleted_at only; the row and its file are both left exactly
// as they were. Nothing here touches Storage or R2 -- file cleanup happens
// ONLY at permanentlyDeletePromoVideoAction, and only after this soft
// delete already moved the row out of the visible archive.
export async function deletePromoVideoAction(id: string): Promise<DeletePromoState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { error } = await admin
    .from('promo_videos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type RestorePromoState = { ok: true } | { ok: false; error: string }

// Undo for the above -- the whole point of soft delete. Trash-only UI action.
export async function restorePromoVideoAction(id: string): Promise<RestorePromoState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { error } = await admin
    .from('promo_videos')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type PermanentDeleteState = { ok: true; fileDeleted: boolean } | { ok: false; error: string }

// Real, irreversible delete -- only reachable from inside the Trash view
// (requires deleted_at already set, so a video can never be permanently
// deleted in one step from the live archive). Deletes the Supabase Storage
// object when the video is hosted there; R2-hosted videos (the vast
// majority -- 92/93 measured 2026-08-16) can NOT be deleted from this app,
// because R2 credentials live only in the separate worker repo's env, never
// this app's. Rather than silently leaving an orphan (the original bug,
// backlog #31), that case is logged to promo_video_orphan_files so the file
// is never simply lost track of.
export async function permanentlyDeletePromoVideoAction(id: string): Promise<PermanentDeleteState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data: row, error: readErr } = await admin
    .from('promo_videos')
    .select('video_url, deleted_at')
    .eq('id', id)
    .single()
  if (readErr || !row) return { ok: false, error: readErr?.message ?? 'not found' }
  if (!row.deleted_at) return { ok: false, error: 'not in trash -- soft delete first' }

  let fileDeleted = false
  const videoUrl = row.video_url as string | null
  if (videoUrl) {
    const marker = `/${BUCKET}/`
    const idx = videoUrl.indexOf(marker)
    if (idx >= 0) {
      const path = videoUrl.slice(idx + marker.length)
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([path])
      fileDeleted = !rmErr
    } else {
      await admin.from('promo_video_orphan_files').insert({
        promo_video_id: id,
        video_url: videoUrl,
        reason: 'r2_hosted_no_app_credentials',
      })
    }
  }

  const { error } = await admin.from('promo_videos').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true, fileDeleted }
}
