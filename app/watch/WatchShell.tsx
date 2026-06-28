'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WatchSort, WatchRound } from '@/lib/watch'
import { WatchTopBar } from './WatchTopBar'

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

const SORTS: { key: WatchSort; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
  { key: 'award', label: 'Award Winners' },
]

// Build a /watch URL preserving the other active filters; pass only the fields
// you want for this link (omit one to clear it).
function buildHref(
  sort: WatchSort,
  opts: { season?: string; round?: WatchRound; awardRank?: number } = {},
): string {
  const p = new URLSearchParams()
  if (sort !== 'latest') p.set('sort', sort)
  if (opts.season) p.set('season', opts.season)
  if (opts.round) p.set('round', opts.round)
  if (opts.awardRank) p.set('award_rank', String(opts.awardRank))
  const qs = p.toString()
  return qs ? `/watch?${qs}` : '/watch'
}

const ROUNDS: { key: WatchRound; label: string }[] = [
  { key: 'application', label: 'Preliminary' },
  { key: 'main', label: 'Main Round' },
]
const WINNERS: { rank: number; label: string }[] = [
  { rank: 1, label: '🥇 1st Place' },
  { rank: 2, label: '🥈 2nd Place' },
  { rank: 3, label: '🥉 3rd Place' },
]

export function WatchShell({
  seasons,
  sort,
  activeSeason,
  activeRound,
  activeAwardRank,
  user,
  subscriptions = [],
  logoHref = '/watch',
  children,
}: {
  seasons: SidebarSeason[]
  sort: WatchSort
  activeSeason?: string
  activeRound?: WatchRound
  activeAwardRank?: number
  user: { email: string } | null
  subscriptions?: SidebarSubscription[]
  logoHref?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  // Every filter link preserves the other active filters (season/round/winner).
  const keep = { season: activeSeason, round: activeRound, awardRank: activeAwardRank }

  const nav = (
    <nav className="flex flex-col gap-1">
      <NavLink href="/watch" label="Home" icon="🎬" />
      <NavLink href="/welcome" label="Tournament" icon="🏆" />

      <Divider label="Sort" />
      {SORTS.map((s) => (
        <RailLink key={s.key} href={buildHref(s.key, keep)} label={s.label} active={s.key === sort} />
      ))}

      <Divider label="Seasons" />
      <RailLink
        href={buildHref(sort, { round: activeRound, awardRank: activeAwardRank })}
        label="All"
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

      <Divider label="Round" />
      <RailLink
        href={buildHref(sort, { season: activeSeason, awardRank: activeAwardRank })}
        label="All rounds"
        active={!activeRound}
      />
      {ROUNDS.map((r) => (
        <RailLink
          key={r.key}
          href={buildHref(sort, { season: activeSeason, round: r.key, awardRank: activeAwardRank })}
          label={r.label}
          active={activeRound === r.key}
        />
      ))}

      <Divider label="Winners" />
      <RailLink
        href={buildHref(sort, { season: activeSeason, round: activeRound })}
        label="All"
        active={!activeAwardRank}
      />
      {WINNERS.map((w) => (
        <RailLink
          key={w.rank}
          href={buildHref(sort, { season: activeSeason, round: activeRound, awardRank: w.rank })}
          label={w.label}
          active={activeAwardRank === w.rank}
        />
      ))}

      <Divider label="More" />
      <NavLink href="/membership" label="Membership" icon="💎" />
      <NavLink href="/welcome#about" label="About" icon="ℹ️" />
      <NavLink href="/welcome#how" label="How It Works" icon="📖" />
      <NavLink href="/welcome#faq" label="Q&A" icon="❓" />

      {subscriptions.length > 0 && (
        <>
          <Divider label="Subscriptions" />
          {subscriptions.map((s) => (
            <RailLink
              key={s.creatorUserId}
              href={`/watch?q=${encodeURIComponent(s.name)}`}
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
      <WatchTopBar onMenu={() => setOpen((o) => !o)} user={user} logoHref={logoHref} />

      <div className="flex pt-14 max-w-[1600px] mx-auto">
        {/* Desktop fixed rail */}
        <aside className="hidden md:block w-56 shrink-0 px-2 py-4">
          <div className="sticky top-16">{nav}</div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto border-r border-white/10 bg-[#0a0810] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mb-2 ml-auto block text-white/50 hover:text-white"
              >
                ✕
              </button>
              <div onClick={() => setOpen(false)}>{nav}</div>
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
    <Link
      href={href}
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

function Divider({ label }: { label: string }) {
  return (
    <p className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
  )
}
