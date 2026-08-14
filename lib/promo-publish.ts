import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { publishPost, type PromoChannel } from '@/lib/postiz'

// The single place that actually calls Postiz for a promo_videos row. Both
// the manual publish route (app/api/admin/promo/publish) and the
// promo-schedule cron call this -- neither bypasses it, so the approval gate
// and the promo_publish_log write happen exactly once, regardless of trigger.
// See reports/promo_auto_publish_design_2026-08-14.md.
//
// Caption/channels are read from the DB row, never accepted as arguments --
// the persisted values (set via updatePromoMetaAction) are the only source,
// so a caller cannot slip in different content than what was approved.

export type PublishOutcome =
  | { ok: true; postIds: string[]; channels: string[] }
  | { ok: false; error: 'not_found' | 'not_approved' | 'no_video' | 'no_channels' | string }

export async function publishPromoVideo(
  promoVideoId: string,
  triggeredBy: 'cron' | 'manual',
): Promise<PublishOutcome> {
  const admin = createSupabaseAdmin()

  const { data: pv, error } = await admin
    .from('promo_videos')
    .select('id, video_url, approved, caption, channels')
    .eq('id', promoVideoId)
    .single()
  if (error || !pv) return { ok: false, error: 'not_found' }
  // ★The one gate. Neither trigger can publish an unapproved video.
  if (!pv.approved) return { ok: false, error: 'not_approved' }
  if (!pv.video_url) return { ok: false, error: 'no_video' }
  const channels = ((pv.channels ?? []) as string[]) as PromoChannel[]
  if (channels.length === 0) return { ok: false, error: 'no_channels' }
  const caption = (pv.caption as string | null) ?? ''

  try {
    const r = await publishPost({ channels, mediaUrl: pv.video_url as string, caption })
    await admin
      .from('promo_videos')
      .update({
        postiz_post_id: r.postIds.join(','),
        posted_channels: r.channels,
        posted_at: new Date().toISOString(),
      })
      .eq('id', promoVideoId)
    await admin.from('promo_publish_log').insert({
      promo_video_id: promoVideoId,
      triggered_by: triggeredBy,
      channels: r.channels,
      caption,
      status: 'success',
      postiz_post_id: r.postIds.join(','),
    })
    return { ok: true, postIds: r.postIds, channels: r.channels }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    await admin.from('promo_publish_log').insert({
      promo_video_id: promoVideoId,
      triggered_by: triggeredBy,
      channels,
      caption,
      status: 'failed',
      error_message: detail,
    })
    return { ok: false, error: detail }
  }
}
