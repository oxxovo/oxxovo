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
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {/* Text-only tabs (8_final): the season tab is the active one (purple +
          underline); the others are grey. No pill boxes. */}
      <Dropdown label="Current Competition" active>
        <MenuLink href={basePath} label="All Competitions" active={!activeSeason} />
        {seasons.map((s) => (
          <MenuLink key={s.id} href={`${basePath}?season=${s.id}`} label={s.label} active={activeSeason === s.id} />
        ))}
      </Dropdown>

      <Separator />

      <Dropdown label="Newest First">
        {/* Submission order is the only ordering (no curation). */}
        <MenuLink href={basePath} label="Newest First" active />
      </Dropdown>

      <Separator />

      <Dropdown label="🏆 Champions" white>
        <p className="px-3 py-2 text-[12px] leading-relaxed text-white/55">Season 0 Champions revealed Sep 8</p>
        <div aria-disabled className="cursor-not-allowed px-3 py-2 text-[12px] text-white/30">
          All Champions
        </div>
      </Dropdown>

      <Link
        href={basePath}
        className="ml-auto text-[13px] font-bold text-[#a855ff] transition hover:text-white"
      >
        View All →
      </Link>
    </div>
  )
}

function Separator() {
  return <span className="select-none text-[#a855ff]/30">|</span>
}

function Dropdown({
  label,
  active,
  white,
  children,
}: {
  label: string
  active?: boolean
  white?: boolean
  children: React.ReactNode
}) {
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
        className={`flex items-center gap-1.5 border-b-2 pb-1 text-[13px] font-bold transition ${
          active
            ? 'border-[#8b22ff] text-[#a855ff]'
            : white
              ? 'border-transparent text-white hover:text-white/80'
              : 'border-transparent text-[#a855ff]/80 hover:text-[#a855ff]'
        }`}
      >
        {label}
        <span className="text-[10px] opacity-70">▼</span>
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
