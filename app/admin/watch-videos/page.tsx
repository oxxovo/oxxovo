// /admin/watch-videos -- video moderation queue: anything reported by the
// audience, AI-flagged by pre-moderation, or already hidden. Admin can Hide /
// Unhide a video from Watch without touching its competition status. Admin only.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getDisplayNames } from '@/lib/nickname'
import { WatchVideoModRow, type ModVideo } from './WatchVideoModRow'

export const dynamic = 'force-dynamic'

type AppRow = {
  id: string
  user_id: string | null
  creator_name: string | null
  status: string
  moderation_status: string
  moderation_flags: unknown
  watch_hidden: boolean | null
  watch_hidden_reason: string | null
  free_entry_url: string | null
  main_round_video_url: string | null
}

function flagsToList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (raw && typeof raw === 'object') return Object.keys(raw as Record<string, unknown>)
  return []
}

export default async function AdminWatchVideosPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const [reportsRes, flagHiddenRes] = await Promise.all([
    admin.from('watch_video_reports').select('application_id'),
    admin
      .from('genesis_applications')
      .select('id')
      .or('moderation_status.eq.flagged,watch_hidden.eq.true'),
  ])

  const reportByApp = new Map<string, number>()
  for (const r of (reportsRes.data ?? []) as { application_id: string }[]) {
    reportByApp.set(r.application_id, (reportByApp.get(r.application_id) ?? 0) + 1)
  }

  const ids = [
    ...new Set([
      ...reportByApp.keys(),
      ...((flagHiddenRes.data ?? []) as { id: string }[]).map((r) => r.id),
    ]),
  ]

  let apps: AppRow[] = []
  if (ids.length > 0) {
    const { data } = await admin
      .from('genesis_applications')
      .select(
        'id, user_id, creator_name, status, moderation_status, moderation_flags, watch_hidden, watch_hidden_reason, free_entry_url, main_round_video_url',
      )
      .in('id', ids)
    apps = (data ?? []) as AppRow[]
  }

  const names = await getDisplayNames(apps.map((a) => a.user_id))

  const rows: ModVideo[] = apps
    .map((a) => ({
      id: a.id,
      displayName: (a.user_id ? names.get(a.user_id) : undefined) ?? a.creator_name?.trim() ?? 'Creator',
      status: a.status,
      moderationStatus: a.moderation_status,
      moderationFlags: flagsToList(a.moderation_flags),
      watchHidden: !!a.watch_hidden,
      watchHiddenReason: a.watch_hidden_reason,
      reportCount: reportByApp.get(a.id) ?? 0,
      prelimUrl: a.free_entry_url,
      mainUrl: a.main_round_video_url,
    }))
    .sort((a, b) => b.reportCount - a.reportCount)

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black">Video moderation</h1>
        <p className="mt-2 text-sm text-white/50">
          Reported, AI-flagged, or hidden videos. Hide removes a video from Watch without changing
          its competition status (scoring/awards are unaffected).
        </p>

        {rows.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">Nothing to review. 🎉</p>
        ) : (
          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-semibold">Reports</th>
                <th className="py-2 pr-3 font-semibold">Creator</th>
                <th className="py-2 pr-3 font-semibold">Flags</th>
                <th className="py-2 pr-3 font-semibold">Video</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <WatchVideoModRow key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
