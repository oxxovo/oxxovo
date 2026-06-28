// /watch -- the public video gallery ("YouTube-lite + tournament"). Thumbnail
// grid + sort tabs (Trending / Latest / Award Winners) + a left rail that splits
// videos by season (Season 0 / Season 1 / Partner Hosted). Click a card -> play.
//
// 100% data-driven ([[feedback-no-hardcode]]): every card comes from
// genesis_applications via lib/watch (service-role, server only). Submit-
// immediately policy means a video is public the moment its URL exists, except
// flagged/rejected. Likes/views/comments/votes attach on the detail page.

import Link from 'next/link'
import { getWatchSeasonGroups, type WatchRound, type WatchVideo, type WatchSort } from '@/lib/watch'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { formatFooterStatusLine } from '@/lib/ip-info'

export const dynamic = 'force-dynamic'

const SORTS: { key: WatchSort; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
  { key: 'award', label: 'Award Winners' },
]

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

function sortHref(sort: WatchSort, season?: string): string {
  const p = new URLSearchParams()
  if (sort !== 'latest') p.set('sort', sort)
  if (season) p.set('season', season)
  const qs = p.toString()
  return qs ? `/watch?${qs}` : '/watch'
}

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; season?: string }>
}) {
  const sp = await searchParams
  const sort: WatchSort =
    sp.sort === 'trending' || sp.sort === 'award' ? sp.sort : 'latest'
  const activeSeason = sp.season

  const groups = await getWatchSeasonGroups(sort)
  const visibleGroups = activeSeason
    ? groups.filter((g) => g.seasonId === activeSeason)
    : groups
  const totalVideos = visibleGroups.reduce((n, g) => n + g.videos.length, 0)

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-6 md:pt-28 border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="inline-flex items-center gap-2.5 mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            Watch
          </p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">Watch the competition</h1>
          <p className="mt-3 max-w-2xl text-base text-white/65 leading-relaxed">
            Every entry, the moment it&apos;s submitted. AI decides the score — you decide what you love.
          </p>

          {/* Sort tabs */}
          <div className="mt-7 flex flex-wrap gap-2">
            {SORTS.map((s) => {
              const active = s.key === sort
              return (
                <Link
                  key={s.key}
                  href={sortHref(s.key, activeSeason)}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                    active
                      ? 'bg-[#8b22ff] text-white'
                      : 'border border-white/15 text-white/70 hover:border-white/40'
                  }`}
                >
                  {s.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-10 max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Left rail: season split */}
        <aside className="md:w-52 shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 mb-3">Seasons</p>
          <nav className="flex md:flex-col gap-1.5 flex-wrap">
            <RailLink href={sortHref(sort)} label="All" active={!activeSeason} />
            {groups.map((g) => (
              <RailLink
                key={g.seasonId}
                href={sortHref(sort, g.seasonId)}
                label={g.hostType === 'partner' ? `${g.displayName} · Host` : g.displayName}
                active={activeSeason === g.seasonId}
                count={g.videos.length}
              />
            ))}
          </nav>
        </aside>

        {/* Grid */}
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
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">← OXXOVO</Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>

      <ChatWidget />
    </main>
  )
}

function RailLink({
  href,
  label,
  active,
  count,
}: {
  href: string
  label: string
  active: boolean
  count?: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
        active ? 'bg-white/10 text-white font-bold' : 'text-white/65 hover:bg-white/5'
      }`}
    >
      <span className="truncate">{label}</span>
      {count != null && <span className="text-[11px] text-white/40">{count}</span>}
    </Link>
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
