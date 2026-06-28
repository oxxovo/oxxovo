'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WatchSort } from '@/lib/watch'

// YouTube-style left rail: logo -> Watch home, Home / Tournament nav, sort
// (Trending/Latest/Award), then season split. Fixed on desktop, a slide-in
// drawer on mobile (hamburger).
export type SidebarSeason = {
  seasonId: string
  label: string
  count: number
}

const SORTS: { key: WatchSort; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
  { key: 'award', label: 'Award Winners' },
]

function buildHref(sort: WatchSort, season?: string): string {
  const p = new URLSearchParams()
  if (sort !== 'latest') p.set('sort', sort)
  if (season) p.set('season', season)
  const qs = p.toString()
  return qs ? `/watch?${qs}` : '/watch'
}

export function WatchSidebar({
  seasons,
  sort,
  activeSeason,
}: {
  seasons: SidebarSeason[]
  sort: WatchSort
  activeSeason?: string
}) {
  const [open, setOpen] = useState(false)

  const body = (
    <nav className="flex flex-col gap-1">
      <Link href="/watch" className="flex items-center gap-2 px-3 py-2.5 mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-8 drop-shadow-[0_0_12px_rgba(139,34,255,.6)]" />
        <span className="text-lg font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
      </Link>

      <NavLink href="/watch" label="Home" icon="▶" />
      <NavLink href="/welcome" label="Tournament" icon="🏆" />

      <Divider label="Sort" />
      {SORTS.map((s) => (
        <RailLink
          key={s.key}
          href={buildHref(s.key, activeSeason)}
          label={s.label}
          active={s.key === sort}
        />
      ))}

      <Divider label="Seasons" />
      <RailLink href={buildHref(sort)} label="All" active={!activeSeason} />
      {seasons.map((g) => (
        <RailLink
          key={g.seasonId}
          href={buildHref(sort, g.seasonId)}
          label={g.label}
          active={activeSeason === g.seasonId}
          count={g.count}
        />
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden mb-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-white/80"
      >
        <span aria-hidden>☰</span> Menu
      </button>

      {/* Desktop fixed rail */}
      <aside className="hidden md:block w-56 shrink-0">
        <div className="sticky top-24">{body}</div>
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
            <div onClick={() => setOpen(false)}>{body}</div>
          </div>
        </div>
      )}
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
    <p className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
      {label}
    </p>
  )
}
