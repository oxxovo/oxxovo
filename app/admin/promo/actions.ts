'use server'

// admin 홍보영상 서버액션. 모두 requireAdmin 게이트 + service_role(createSupabaseAdmin).
// 업로드는 signed upload URL 발급(서버) -> 브라우저 직행(Vercel 4.5MB 우회) -> 행 생성.
// video_url 은 서버가 path 에서 도출(서버 권위, 클라이언트 URL 불신).

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

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
export async function updatePromoCadenceAction(input: {
  weekdays: string[]
  time: string
  timezone: string
}): Promise<UpdateCadenceState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const rows = [
    { key: 'promo_publish_weekdays', value: input.weekdays.join(',') },
    { key: 'promo_publish_time', value: input.time.trim() },
    { key: 'promo_publish_timezone', value: input.timezone.trim() },
  ]
  const { error } = await admin.from('platform_config').upsert(rows, { onConflict: 'key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}

export type DeletePromoState = { ok: true } | { ok: false; error: string }

// 3) 행 + Storage 객체 삭제. 이미 게시된 건은 막지 않음(원격 글은 Postiz 에서 별도 관리).
export async function deletePromoVideoAction(id: string): Promise<DeletePromoState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data: row } = await admin
    .from('promo_videos')
    .select('video_url')
    .eq('id', id)
    .single()

  // Storage 객체 경로 복원 (.../promo-videos/<path>).
  if (row?.video_url) {
    const marker = `/${BUCKET}/`
    const idx = (row.video_url as string).indexOf(marker)
    if (idx >= 0) {
      const path = (row.video_url as string).slice(idx + marker.length)
      await admin.storage.from(BUCKET).remove([path])
    }
  }

  const { error } = await admin.from('promo_videos').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/promo')
  return { ok: true }
}
