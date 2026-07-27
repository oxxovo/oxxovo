// /admin/watch-videos -- video moderation queue: anything reported by the
// audience, AI-flagged by pre-moderation, or already hidden. Admin can Hide /
// Unhide a video from Watch without touching its competition status. Admin only.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getDisplayNames } from '@/lib/nickname'
import { WatchVideoModRow, type ModVideo } from './WatchVideoModRow'
import { PrelimHoldPanel, type HeldSeason } from './PrelimHoldPanel'

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

// Seasons that still have prelim entries under the anti-copy hold, newest
// first. Held rows are invisible on /watch, so this panel is the only place the
// cohort is visible to an operator before release.
async function loadHeldSeasons(
  admin: ReturnType<typeof createSupabaseAdmin>,
): Promise<HeldSeason[]> {
  const { data: held, error } = await admin
    .from('genesis_applications')
    .select('season_id')
    .eq('watch_hold', true)
  if (error || !held || held.length === 0) return []

  const counts = new Map<string, number>()
  for (const r of held as { season_id: string | null }[]) {
    if (!r.season_id) continue
    counts.set(r.season_id, (counts.get(r.season_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  const { data: seasons } = await admin
    .from('seasons')
    .select('id, display_name, name, season_number, application_close_at, studio_prelim_hold_enabled, studio_prelim_auto_publish')
    .in('id', [...counts.keys()])

  const bySeason = new Map(
    ((seasons ?? []) as {
      id: string
      display_name: string | null
      name: string | null
      season_number: number | null
      application_close_at: string | null
      studio_prelim_hold_enabled: boolean | null
      studio_prelim_auto_publish: boolean | null
    }[]).map((s) => [s.id, s]),
  )

  return [...counts.entries()]
    .map(([seasonId, heldCount]) => {
      const s = bySeason.get(seasonId)
      return {
        seasonId,
        displayName: s?.display_name?.trim() || s?.name?.trim() || seasonId,
        heldCount,
        holdEnabled: !!s?.studio_prelim_hold_enabled,
        autoPublish: !!s?.studio_prelim_auto_publish,
        closeAt: s?.application_close_at ?? null,
      }
    })
    .sort((a, b) => b.heldCount - a.heldCount)
}

export default async function AdminWatchVideosPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const heldSeasons = await loadHeldSeasons(admin)

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

        <PrelimHoldPanel seasons={heldSeasons} />

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
