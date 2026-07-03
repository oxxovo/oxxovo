'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

// Filter bar above the grid (arena-only). Fixed pill labels match 8_final exactly
// -- "Current Competition" / "Newest First" / "🏆 Champions" -- each opening a
// small menu. NO Trending / Staff Picks / Featured, ever (fairness policy): the
// only orderings offered are submission-order ("Newest First") and the neutral
// season/champion filters. Champions has no winners yet (Season 0), so its menu
// shows the reveal-date note instead of names.

export type FilterSeason = { id: string; label: string }

export function ArenaFilterBar({
  seasons,
  activeSeason,
  basePath = '/watch-arena',
}: {
  seasons: FilterSeason[]
  activeSeason?: string
  basePath?: string
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Dropdown label="Current Competition">
        <MenuLink href={basePath} label="All Competitions" active={!activeSeason} />
        {seasons.map((s) => (
          <MenuLink key={s.id} href={`${basePath}?season=${s.id}`} label={s.label} active={activeSeason === s.id} />
        ))}
      </Dropdown>

      <Dropdown label="Newest First">
        {/* Submission order is the only ordering (no curation). */}
        <MenuLink href={basePath} label="Newest First" active />
      </Dropdown>

      <Dropdown label="🏆 Champions">
        <p className="px-3 py-2 text-[12px] leading-relaxed text-white/55">Season 0 Champions revealed Sep 8</p>
        <div aria-disabled className="cursor-not-allowed px-3 py-2 text-[12px] text-white/30">
          All Champions
        </div>
      </Dropdown>

      <Link
        href={basePath}
        className="ml-auto text-[13px] font-bold text-[#c9a9ff] transition hover:text-white"
      >
        View All →
      </Link>
    </div>
  )
}

function Dropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-[13px] font-bold text-white/85 transition hover:bg-white/[.08]"
      >
        {label}
        <span className="text-[10px] text-white/50">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[210px] overflow-hidden rounded-lg border border-white/10 bg-[#0c0a14] py-1 shadow-[0_10px_30px_rgba(0,0,0,.5)]">
          {children}
        </div>
      )}
    </div>
  )
}

function MenuLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 text-[12px] transition ${
        active ? 'bg-white/5 font-bold text-white' : 'text-white/70 hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  )
}
