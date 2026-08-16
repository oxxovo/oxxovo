// /admin/watch-videos -- video moderation queue: anything reported by the
// audience, AI-flagged by pre-moderation, or already hidden. Admin can Hide /
// Unhide a video from Watch without touching its competition status. Admin only.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getDisplayNames } from '@/lib/nickname'
import { WatchVideosView } from './WatchVideosView'
import { type ModVideo } from './WatchVideoModRow'
import { type HeldSeason } from './PrelimHoldPanel'
import { countPrelimEntries, type PrelimEntry } from '@/lib/prelim-release'

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

// ⑤E -- every season the anti-copy hold applies to, whether or not anything is
// still held.
//
// ★It used to start from `watch_hold = true` and return [] when that was empty,
// which meant the panel VANISHED the moment the release succeeded. That is
// exactly backwards: before the release the operator can see the cohort on this
// page, and after it -- when the only remaining questions are "did it run" and
// "what has arrived since" -- there was no surface at all. The auto release is
// armed for 11/4, so the first time it fires nobody would have seen it happen.
//
// So the set is now "seasons where the hold is configured OR has already been
// released", and the panel reports the release instead of disappearing with it.
async function loadHeldSeasons(
  admin: ReturnType<typeof createSupabaseAdmin>,
): Promise<HeldSeason[]> {
  const { data: seasonRows } = await admin
    .from('seasons')
    .select('id, display_name, name, application_close_at, studio_prelim_hold_enabled, studio_prelim_auto_publish')

  type SeasonRow = {
    id: string
    display_name: string | null
    name: string | null
    application_close_at: string | null
    studio_prelim_hold_enabled: boolean | null
    studio_prelim_auto_publish: boolean | null
  }
  const seasons = (seasonRows ?? []) as SeasonRow[]
  if (seasons.length === 0) return []

  // ★Read in a SECOND query, the same shape as lib/watch-hold.shouldHoldPrelim.
  // PostgREST rejects an entire select for one unknown column, so naming
  // prelim_released_at in the query above would return NOTHING -- including the
  // switches -- on any environment where that migration has not run, and the
  // panel would silently show no seasons at all rather than a degraded row.
  const { data: releaseRows, error: relErr } = await admin
    .from('seasons')
    .select('id, prelim_released_at')
  if (relErr) {
    console.warn(`[admin] prelim_released_at unreadable, showing holds only: ${relErr.message}`)
  }
  const releasedAtById = new Map(
    ((releaseRows ?? []) as { id: string; prelim_released_at: string | null }[]).map((r) => [
      r.id,
      r.prelim_released_at,
    ]),
  )

  const relevant = seasons.filter(
    (s) => s.studio_prelim_hold_enabled || releasedAtById.get(s.id),
  )
  if (relevant.length === 0) return []
  const seasonIds = relevant.map((s) => s.id)

  const { data: appRows } = await admin
    .from('genesis_applications')
    .select('season_id, watch_hold, watch_hold_released_at, free_entry_url, studio_application_render_id')
    .in('season_id', seasonIds)
  const apps = (appRows ?? []) as {
    season_id: string | null
    watch_hold: boolean | null
    watch_hold_released_at: string | null
    free_entry_url: string | null
    studio_application_render_id: string | null
  }[]

  // ★The film's own timestamp, which is what decides 'late' vs 'cohort'. It
  // lives on render_jobs -- genesis_applications has no per-entry finalize
  // column -- so it is fetched by id rather than derived from the release stamp.
  const renderIds = [
    ...new Set(apps.map((a) => a.studio_application_render_id).filter((x): x is string => !!x)),
  ]
  const finalizedById = new Map<string, string | null>()
  if (renderIds.length > 0) {
    const { data: renders } = await admin
      .from('render_jobs')
      .select('id, finalized_at')
      .in('id', renderIds)
    for (const r of (renders ?? []) as { id: string; finalized_at: string | null }[]) {
      finalizedById.set(r.id, r.finalized_at)
    }
  }

  const bySeason = new Map<string, PrelimEntry[]>()
  for (const a of apps) {
    if (!a.season_id) continue
    const list = bySeason.get(a.season_id) ?? []
    list.push({
      watch_hold: a.watch_hold,
      watch_hold_released_at: a.watch_hold_released_at,
      free_entry_url: a.free_entry_url,
      finalizedAt: a.studio_application_render_id
        ? finalizedById.get(a.studio_application_render_id) ?? null
        : null,
    })
    bySeason.set(a.season_id, list)
  }

  return relevant
    .map((s) => {
      const releasedAt = releasedAtById.get(s.id) ?? null
      const counts = countPrelimEntries(bySeason.get(s.id) ?? [], releasedAt)
      return {
        seasonId: s.id,
        displayName: s.display_name?.trim() || s.name?.trim() || s.id,
        heldCount: counts.held,
        cohortCount: counts.cohort,
        lateCount: counts.late,
        releasedAt,
        holdEnabled: !!s.studio_prelim_hold_enabled,
        autoPublish: !!s.studio_prelim_auto_publish,
        closeAt: s.application_close_at ?? null,
      }
    })
    // Anything still held first (there is a decision to make), then the most
    // recent release.
    .sort((a, b) => b.heldCount - a.heldCount || (b.releasedAt ?? '').localeCompare(a.releasedAt ?? ''))
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
      displayName: (a.user_id ? names.get(a.user_id) : undefined) ?? a.creator_name?.trim() ?? null,
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

  return <WatchVideosView rows={rows} heldSeasons={heldSeasons} />
}
