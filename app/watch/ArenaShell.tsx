'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArenaTopBar } from './ArenaTopBar'
import { useT } from '@/lib/admin-i18n'

// Watch chrome (top bar + left sidebar + main), arena design. The
// sort/season/champion filters live in the filter bar above the grid, so the
// sidebar is a static nav: a WATCH badge, icon+title+subtitle platform links, a
// (pre-launch, disabled) Library, and a helper footer. Uses ArenaTopBar.

type Item = { href: string; icon: string; titleKey: 'nav_home' | 'nav_tournament' | 'nav_how' | 'nav_membership' | 'nav_faq' | 'nav_about'; subKey: 'nav_home_sub' | 'nav_tournament_sub' | 'nav_how_sub' | 'nav_membership_sub' | 'nav_faq_sub' | 'nav_about_sub' }

// Menu items open in a new tab (the footer tells the user so) -- keeps WATCH open.
const NAV: Item[] = [
  { href: '/', icon: '🏠', titleKey: 'nav_home', subKey: 'nav_home_sub' },
  { href: '/welcome', icon: '🏆', titleKey: 'nav_tournament', subKey: 'nav_tournament_sub' },
  { href: '/welcome#how', icon: '📖', titleKey: 'nav_how', subKey: 'nav_how_sub' },
  { href: '/membership', icon: '💎', titleKey: 'nav_membership', subKey: 'nav_membership_sub' },
  { href: '/welcome#faq', icon: '❓', titleKey: 'nav_faq', subKey: 'nav_faq_sub' },
  { href: '/welcome#about', icon: 'ℹ️', titleKey: 'nav_about', subKey: 'nav_about_sub' },
]

// Personal library -- disabled placeholders until launch (no data yet).
const LIBRARY: { icon: string; labelKey: 'lib_myvideos' | 'lib_mylikes' | 'lib_watchlater' | 'lib_history' }[] = [
  { icon: '🎬', labelKey: 'lib_myvideos' },
  { icon: '❤️', labelKey: 'lib_mylikes' },
  { icon: '🕒', labelKey: 'lib_watchlater' },
  { icon: '📜', labelKey: 'lib_history' },
]

export function ArenaShell({
  user,
  children,
}: {
  user: { email: string } | null
  children: React.ReactNode
}) {
  const t = useT()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const toggleMenu = () => {
    setDrawerOpen((o) => !o)
    setRailCollapsed((c) => !c)
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {/* WATCH badge */}
      <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-[#8b22ff]/50 bg-[#8b22ff]/[.18] px-3 py-2.5">
        <span aria-hidden className="text-sm text-[#a855ff]">▶</span>
        <div className="leading-tight">
          <div className="text-base font-black tracking-wide text-white">{t.watch.badge_watch}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">{t.watch.badge_subtitle}</div>
        </div>
      </div>

      {NAV.map((n) => (
        <NavItem key={n.href} item={n} title={t.watch[n.titleKey]} subtitle={t.watch[n.subKey]} />
      ))}

      <SectionLabel label={t.watch.library_label} />
      {LIBRARY.map((l) => (
        <LibraryItem key={l.labelKey} icon={l.icon} label={t.watch[l.labelKey]} />
      ))}

      {/* Helper footer */}
      <div className="mt-6 rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.06] px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a855ff]">{t.watch.footer_tip_title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          {t.watch.footer_tip_body}
        </p>
      </div>
    </nav>
  )

  return (
    <>
      <ArenaTopBar onMenu={toggleMenu} user={user} />

      <div className="mx-auto flex max-w-[1600px] pt-20">
        {/* Desktop rail -- always present on desktop; hamburger collapses it. */}
        <aside className={`${railCollapsed ? 'md:hidden' : 'md:block'} hidden w-60 shrink-0 px-2 py-4`}>
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

// icon + title (white bold) + subtitle (gray). Opens in a new tab.
function NavItem({ item, title, subtitle }: { item: Item; title: string; subtitle: string }) {
  return (
    <Link
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg px-3 py-2 transition hover:bg-white/5"
    >
      <span aria-hidden className="mt-0.5 text-base">{item.icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="block text-[11px] leading-tight text-white/45">{subtitle}</span>
      </span>
    </Link>
  )
}

// Library entries are inert until launch: icon + title only, greyed and
// non-interactive (no "Soon" label -- clicking simply does nothing yet).
function LibraryItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      aria-disabled
      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-white/40"
    >
      <span aria-hidden className="text-base">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

// Purple section label (LIBRARY etc.).
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a855ff]">{label}</p>
  )
}
