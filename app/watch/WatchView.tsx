// Shared Watch surface: left rail (WatchSidebar) + video grid. Rendered by
// /watch and, when watch_as_home is on, by the root (/). 100% data-driven.

import Link from 'next/link'
import { getWatchSeasonGroups, type WatchRound, type WatchVideo, type WatchSort } from '@/lib/watch'
import { WatchSidebar, type SidebarSeason } from './WatchSidebar'

function roundLabel(r: WatchRound): string {
  return r === 'main' ? 'Main Round' : 'Preliminary'
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function formatDuration(secs: number | null): string | null {
  if (!secs || secs <= 0) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function WatchView({
  sort,
  activeSeason,
}: {
  sort: WatchSort
  activeSeason?: string
}) {
  const groups = await getWatchSeasonGroups(sort)
  const visibleGroups = activeSeason ? groups.filter((g) => g.seasonId === activeSeason) : groups
  const totalVideos = visibleGroups.reduce((n, g) => n + g.videos.length, 0)

  const seasons: SidebarSeason[] = groups.map((g) => ({
    seasonId: g.seasonId,
    label: g.hostType === 'partner' ? `${g.displayName} · Host` : g.displayName,
    count: g.videos.length,
  }))

  return (
    <div className="px-6 pt-24 pb-12 md:pt-24 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      <WatchSidebar seasons={seasons} sort={sort} activeSeason={activeSeason} />

      <div className="flex-1 min-w-0">
        {totalVideos === 0 ? (
          <p className="text-center text-white/40 text-sm py-20">
            {sort === 'award'
              ? 'No award winners to show yet.'
              : 'No videos to show yet. Entries appear here as creators submit.'}
          </p>
        ) : (
          visibleGroups.map((g) => (
            <div key={g.seasonId} className="mb-12 last:mb-0">
              {!activeSeason && (
                <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                  {g.displayName}
                  {g.hostType === 'partner' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#b66cff] border border-[#8b22ff]/40 rounded px-1.5 py-0.5">
                      Host
                    </span>
                  )}
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {g.videos.map((v) => (
                  <VideoCard key={`${v.applicationId}:${v.round}`} v={v} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function VideoCard({ v }: { v: WatchVideo }) {
  const duration = formatDuration(v.durationSeconds)
  return (
    <Link
      href={`/watch/${v.applicationId}?round=${v.round}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-[#0c0a14] transition hover:border-[#8b22ff]/50"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#0c0a14]">
        {v.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnailUrl} alt={v.creatorName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-4 text-center">
            <span className="text-sm font-black uppercase tracking-wide text-white/85">{v.creatorName}</span>
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
          {roundLabel(v.round)}
        </span>
        {v.staffPick && (
          <span className="absolute top-2 right-2 inline-flex items-center rounded bg-[#8b22ff]/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Staff Pick
          </span>
        )}
        {v.awarded && (
          <span className="absolute bottom-2 left-2 inline-flex items-center rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
            🏆 Winner
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
            {duration}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="text-sm font-bold text-white truncate">{v.creatorName}</h3>
        <p className="mt-1 text-xs text-white/45">
          {formatCount(v.viewCount)} views · {formatCount(v.likeCount)} likes
          {v.commentCount > 0 && <> · {formatCount(v.commentCount)} comments</>}
        </p>
        {v.aiService && <p className="mt-0.5 text-[11px] text-white/30 truncate">{v.aiService}</p>}
      </div>
    </Link>
  )
}
