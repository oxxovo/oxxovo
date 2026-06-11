import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isPostizEnabled, PROMO_CHANNELS } from '@/lib/postiz'
import { PromoView, type PromoRow } from './PromoView'

export default async function PromoPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data } = await admin
    .from('promo_videos')
    .select(
      'id, created_at, theme_note, status, source, video_url, duration_seconds, postiz_post_id, posted_channels, posted_at',
    )
    .order('created_at', { ascending: false })
    .limit(100)

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
  }))

  return (
    <PromoView
      rows={rows}
      channels={[...PROMO_CHANNELS]}
      postizEnabled={isPostizEnabled()}
    />
  )
}
