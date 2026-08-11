'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WatchSort, WatchRound } from '@/lib/watch'
import { WatchTopBar } from './WatchTopBar'
import { useT, type Messages } from '@/lib/admin-i18n'

// Shell for the Watch surface: fixed top bar + left sidebar (desktop fixed /
// mobile drawer, opened from the top-bar hamburger) + main grid (children).
// Server passes the season list, current sort/season, and the signed-in user.
export type SidebarSeason = {
  seasonId: string
  label: string
  count: number
}

export type SidebarSubscription = {
  creatorUserId: string
  name: string
}

const SORTS: { key: WatchSort; labelKey: keyof Pick<Messages['watch'], 'sort_trending' | 'sort_latest' | 'sort_award'> }[] = [
  { key: 'trending', labelKey: 'sort_trending' },
  { key: 'latest', labelKey: 'sort_latest' },
  { key: 'award', labelKey: 'sort_award' },
]

const ROUNDS: { key: WatchRound; labelKey: keyof Pick<Messages['watch'], 'round_prelim' | 'round_main'> }[] = [
  { key: 'application', labelKey: 'round_prelim' },
  { key: 'main', labelKey: 'round_main' },
]
const WINNERS: { rank: number; labelKey: keyof Pick<Messages['watch'], 'winner_1st' | 'winner_2nd' | 'winner_3rd'> }[] = [
  { rank: 1, labelKey: 'winner_1st' },
  { rank: 2, labelKey: 'winner_2nd' },
  { rank: 3, labelKey: 'winner_3rd' },
]

export function WatchShell({
  seasons,
  sort,
  activeSeason,
  activeRound,
  activeAwardRank,
  user,
  subscriptions = [],
  showRound = false,
  showWinners = false,
  basePath = '/watch',
  children,
}: {
  seasons: SidebarSeason[]
  sort: WatchSort
  activeSeason?: string
  activeRound?: WatchRound
  activeAwardRank?: number
  user: { email: string } | null
  subscriptions?: SidebarSubscription[]
  // Data-driven declutter: only show the Round filter once main-round videos
  // exist, and Winners (+ the Award sort) once placed winners exist.
  showRound?: boolean
  showWinners?: boolean
  // Route the filter links target. Defaults to '/watch' (live); the arena
  // preview passes '/watch-arena' so the sidebar stays on the preview.
  basePath?: string
  children: React.ReactNode
}) {
  const t = useT()
  // Build a filter URL on basePath, preserving the other active filters.
  const buildHref = (
    sortKey: WatchSort,
    opts: { season?: string; round?: WatchRound; awardRank?: number } = {},
  ): string => {
    const p = new URLSearchParams()
    if (sortKey !== 'latest') p.set('sort', sortKey)
    if (opts.season) p.set('season', opts.season)
    if (opts.round) p.set('round', opts.round)
    if (opts.awardRank) p.set('award_rank', String(opts.awardRank))
    const qs = p.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  // One hamburger drives both viewports: on mobile it opens the drawer; on
  // desktop it collapses the always-on rail. Toggling both lets each breakpoint
  // react to only its own (the other is hidden by responsive classes).
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const toggleMenu = () => {
    setDrawerOpen((o) => !o)
    setRailCollapsed((c) => !c)
  }

  // Every filter link preserves the other active filters (season/round/winner).
  const keep = { season: activeSeason, round: activeRound, awardRank: activeAwardRank }
  const sorts = showWinners ? SORTS : SORTS.filter((s) => s.key !== 'award')

  const nav = (
    <nav className="flex flex-col gap-1">
      <NavLink href="/watch" label={t.watch.sidebar_home} icon="🎬" />
      <NavLink href="/welcome" label={t.watch.sidebar_tournament} icon="🏆" />

      <Divider label={t.watch.sidebar_sort_label} />
      {sorts.map((s) => (
        <RailLink key={s.key} href={buildHref(s.key, keep)} label={t.watch[s.labelKey]} active={s.key === sort} />
      ))}

      <Divider label={t.watch.sidebar_seasons_label} />
      <RailLink
        href={buildHref(sort, { round: activeRound, awardRank: activeAwardRank })}
        label={t.watch.sidebar_all}
        active={!activeSeason}
      />
      {seasons.map((g) => (
        <RailLink
          key={g.seasonId}
          href={buildHref(sort, { season: g.seasonId, round: activeRound, awardRank: activeAwardRank })}
          label={g.label}
          active={activeSeason === g.seasonId}
          count={g.count}
        />
      ))}

      {showRound && (
        <>
          <Divider label={t.watch.sidebar_round_label} />
          <RailLink
            href={buildHref(sort, { season: activeSeason, awardRank: activeAwardRank })}
            label={t.watch.sidebar_allrounds}
            active={!activeRound}
          />
          {ROUNDS.map((r) => (
            <RailLink
              key={r.key}
              href={buildHref(sort, { season: activeSeason, round: r.key, awardRank: activeAwardRank })}
              label={t.watch[r.labelKey]}
              active={activeRound === r.key}
            />
          ))}
        </>
      )}

      {showWinners && (
        <>
          <Divider label={t.watch.sidebar_winners_label} />
          <RailLink
            href={buildHref(sort, { season: activeSeason, round: activeRound })}
            label={t.watch.sidebar_all}
            active={!activeAwardRank}
          />
          {WINNERS.map((w) => (
            <RailLink
              key={w.rank}
              href={buildHref(sort, { season: activeSeason, round: activeRound, awardRank: w.rank })}
              label={t.watch[w.labelKey]}
              active={activeAwardRank === w.rank}
            />
          ))}
        </>
      )}

      <Divider label={t.watch.sidebar_more_label} />
      <NavLink href="/membership" label={t.watch.sidebar_membership} icon="💎" />
      <NavLink href="/welcome#about" label={t.watch.sidebar_about} icon="ℹ️" />
      <NavLink href="/welcome#how" label={t.watch.sidebar_how} icon="📖" />
      <NavLink href="/welcome#faq" label={t.watch.sidebar_qa} icon="❓" />

      {subscriptions.length > 0 && (
        <>
          <Divider label={t.watch.sidebar_subs_label} />
          {subscriptions.map((s) => (
            <RailLink
              key={s.creatorUserId}
              href={`${basePath}?q=${encodeURIComponent(s.name)}`}
              label={s.name}
              active={false}
            />
          ))}
        </>
      )}
    </nav>
  )

  return (
    <>
      <WatchTopBar onMenu={toggleMenu} user={user} />

      <div className="flex pt-20 max-w-[1600px] mx-auto">
        {/* Desktop rail -- always present on desktop; hamburger collapses it. */}
        <aside className={`${railCollapsed ? 'md:hidden' : 'md:block'} hidden w-56 shrink-0 px-2 py-4`}>
          <div className="sticky top-24">{nav}</div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto border-r border-white/10 bg-[#0a0810] p-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="mb-2 ml-auto block text-white/50 hover:text-white"
              >
                ✕
              </button>
              <div onClick={() => setDrawerOpen(false)}>{nav}</div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
      </div>
    </>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    // Sidebar nav items also open in a new tab (logo is the only same-tab
    // exception -- it lives in WatchTopBar, not here).
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/5"
    >
      <span aria-hidden className="text-base">{icon}</span>
      {label}
    </Link>
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
    // Filter links open in a new tab (like the video cards) so the current Watch
    // view is preserved while the chosen filter opens alongside it.
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
        active ? 'bg-white/10 text-white font-bold' : 'text-white/65 hover:bg-white/5'
      }`}
    >
      <span className="truncate">{label}</span>
      {count != null && <span className="text-[11px] text-white/40">{count}</span>}
    </Link>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <p className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
  )
}
