'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WatchTopBar } from '../watch/WatchTopBar'

// Arena-only chrome (top bar + left sidebar + main). Deliberately SEPARATE from
// the shared WatchShell so the redesigned sidebar never touches the live /watch.
// The sort/season/round filters live in the filter bar above the grid now, so
// the sidebar is a static nav: platform links + a (pre-launch, disabled) Library.
// Reuses WatchTopBar (unchanged, shared).

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/welcome', label: 'Tournament Info' },
  { href: '/welcome#how', label: 'How It Works' },
  { href: '/welcome#about', label: 'About' },
  { href: '/membership', label: 'Membership' },
  { href: '/welcome#faq', label: 'FAQ' },
]

// Personal library -- disabled placeholders until launch (no data yet).
const LIBRARY = ['My Videos', 'My Likes', 'Watch Later', 'History']

export function ArenaShell({
  user,
  children,
}: {
  user: { email: string } | null
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const toggleMenu = () => {
    setDrawerOpen((o) => !o)
    setRailCollapsed((c) => !c)
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      <div className="mb-3 px-3">
        <div className="text-lg font-black tracking-wide text-white">WATCH</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b794ff]">AI Creator League</div>
      </div>

      {NAV.map((n) => (
        <SideLink key={n.href} href={n.href} label={n.label} />
      ))}

      <Divider label="Library" />
      {LIBRARY.map((l) => (
        <SidePlaceholder key={l} label={l} />
      ))}
    </nav>
  )

  return (
    <>
      <WatchTopBar onMenu={toggleMenu} user={user} />

      <div className="mx-auto flex max-w-[1600px] pt-20">
        {/* Desktop rail -- always present on desktop; hamburger collapses it. */}
        <aside className={`${railCollapsed ? 'md:hidden' : 'md:block'} hidden w-56 shrink-0 px-2 py-4`}>
          <div className="sticky top-24">{nav}</div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
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

        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </>
  )
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/5"
    >
      {label}
    </Link>
  )
}

// Library entries are inert until launch: greyed, non-interactive, with a hint.
function SidePlaceholder({ label }: { label: string }) {
  return (
    <div
      aria-disabled
      className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-white/35"
    >
      <span>{label}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">Soon</span>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
  )
}
