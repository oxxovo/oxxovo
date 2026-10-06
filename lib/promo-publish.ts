import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { prepareMedia, publishPrepared, type PromoChannel } from '@/lib/postiz'
import { adminConfigReader } from '@/lib/config-reader'
import { readMasterSwitch, type ConfigReader } from '@/lib/dispatch-switch'

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
  | {
      ok: false
      error:
        | 'not_found'
        | 'not_approved'
        | 'no_video'
        | 'no_channels'
        | 'dispatch_disabled'
        | 'dispatch_unreadable'
        | string
    }

// Injected so the guard order can be tested without Postiz or a database.
export type PromoPublishDeps = {
  readConfig: ConfigReader
  prepare: typeof prepareMedia
  publish: typeof publishPrepared
}

const realDeps = (): PromoPublishDeps => ({ readConfig: adminConfigReader(), prepare: prepareMedia, publish: publishPrepared })

// Promo is gated by the MASTER switch only (design SS5-6): social_dispatch_enabled.
// Checked twice on purpose -- see the two call sites below.
function guardError(state: 'closed' | 'unreadable'): 'dispatch_disabled' | 'dispatch_unreadable' {
  return state === 'closed' ? 'dispatch_disabled' : 'dispatch_unreadable'
}

export async function publishPromoVideo(
  promoVideoId: string,
  triggeredBy: 'cron' | 'manual',
  deps: PromoPublishDeps = realDeps(),
): Promise<PublishOutcome> {
  // GUARD 1 -- BEFORE anything else (HQ 2026-10-06). Without this the approval
  // gate below answers first (409 not_approved), so a switch-off test could only
  // be run with an APPROVED video -- and a broken guard would then post to the
  // real accounts. Here the answer is 503 for ANY id, touching no row.
  const first = await readMasterSwitch(deps.readConfig)
  if (first !== 'open') return { ok: false, error: guardError(first) }

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
    const media = await deps.prepare(pv.video_url as string)
    // GUARD 2 -- between media prep and POST /posts (design SS5-6): the switch
    // may have been turned off while the file was downloading/uploading. Nothing
    // is posted and no failure is logged: this is a stop, not an error.
    const second = await readMasterSwitch(deps.readConfig)
    if (second !== 'open') return { ok: false, error: guardError(second) }
    const r = await deps.publish({ channels, media, caption })
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
