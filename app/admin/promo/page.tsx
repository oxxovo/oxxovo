import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isPostizEnabled, PROMO_CHANNELS } from '@/lib/postiz'
import { getPlatformConfigMap } from '@/lib/partners'
import { parseCadence } from '@/lib/promo-schedule'
import { PromoView, type PromoRow, type PublishLogEntry } from './PromoView'

// ★force-dynamic -- without it this page can get baked into the static
// build, same class of bug as the /studio 404 (2026-08-13, session6 switch
// baked into a static shell). This page shows approved/caption/channels and
// the cadence-driven cron's output, all of which change without a redeploy.
export const dynamic = 'force-dynamic'

export default async function PromoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()

  let query = admin
    .from('promo_videos')
    .select(
      'id, created_at, theme_note, status, source, video_url, duration_seconds, postiz_post_id, posted_channels, posted_at, approved, approved_at, caption, channels',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (q) query = query.ilike('theme_note', `%${q}%`)
  const { data } = await query

  const rows: PromoRow[] = (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    label: r.theme_note,
    status: r.status,
    source: r.source,
    videoUrl: r.video_url,
    durationSeconds: r.duration_seconds,
    postizPostId: r.postiz_post_id,
    postedChannels: r.posted_channels ?? null,
    postedAt: r.posted_at,
    approved: r.approved,
    approvedAt: r.approved_at,
    caption: r.caption ?? '',
    channels: r.channels ?? [],
  }))

  // Publish history for the videos on this page only -- small volume (<=100
  // videos * a handful of attempts each), one extra query beats N+1.
  const ids = rows.map((r) => r.id)
  const logByVideo: Record<string, PublishLogEntry[]> = {}
  if (ids.length > 0) {
    const { data: logRows } = await admin
      .from('promo_publish_log')
      .select('promo_video_id, attempted_at, triggered_by, channels, status, error_message')
      .in('promo_video_id', ids)
      .order('attempted_at', { ascending: false })
    for (const l of logRows ?? []) {
      const key = l.promo_video_id as string
      ;(logByVideo[key] ??= []).push({
        attemptedAt: l.attempted_at,
        triggeredBy: l.triggered_by,
        channels: l.channels ?? [],
        status: l.status,
        errorMessage: l.error_message,
      })
    }
  }

  const cadence = parseCadence(await getPlatformConfigMap())

  return (
    <PromoView
      rows={rows}
      channels={[...PROMO_CHANNELS]}
      postizEnabled={isPostizEnabled()}
      publishLog={logByVideo}
      q={q}
      cadence={cadence}
    />
  )
}
