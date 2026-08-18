'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArenaTopBar } from './ArenaTopBar'
import { useT } from '@/lib/admin-i18n'

// Watch chrome (top bar + left sidebar + main), arena design. The
// sort/season/champion filters live in the filter bar above the grid, so the
// sidebar is a static nav: a Creator Ranking box (PREVIEW, replaces the old
// WATCH badge -- TK 2026-08-18: "Watch button inside Watch" redundancy),
// icon+title+subtitle platform links, a (pre-launch, disabled) Library, and a
// helper footer. Uses ArenaTopBar.
//
// ★PREVIEW ONLY (HQ 2026-08-18, second redesign after the top-bar version was
// rejected for pushing the video grid off the first screen). The sidebar box
// does not compete with grid space at all -- this is why TK moved it here.

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

// ── Creator Ranking (PREVIEW, HQ 2026-08-18) ────────────────────────────────
// Replaces the old WATCH badge. No calculation/snapshot/tie-break/eligibility
// logic exists yet (explicitly deferred to before 2027 Q1) -- this renders
// three blank numbered rows, nothing else. No pulse/motion (HQ 2026-08-18
// second pass: with nothing changing on screen there is nothing to pulse --
// the box is static). The row template (RankRow) already supports a real
// name+points once that data exists, specifically so the truncation rule
// below is exercised by the same code path production will use, not a
// separate one written later.
//
// REVEAL_PERIOD_LABEL is a literal in THIS preview file only -- production
// reads the period from a config value, never a hardcoded date string.
const REVEAL_PERIOD_LABEL = '2027 Q1' // PREVIEW literal -- prod reads a config value, never a hardcoded string

// Name truncates (ellipsis), points never shrink -- the fix for the exact bug
// class from the 2026-08-06 header incident ("an unbreakable string silently
// eats a flex sibling's space"): `min-w-0 truncate` on the name forces the
// browser to clip it instead of growing the row, and `shrink-0` pins the
// points column so it can never be pushed out. Verified 2026-08-18 with a
// long synthetic name rendered locally before this shipped (see chat report).
function RankRow({ rank, name, points }: { rank: number; name?: string; points?: number }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-4 shrink-0 text-[12px] font-black text-white/70">{rank}</span>
      {name ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{name}</span>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#c9a9ff]">
            {(points ?? 0).toLocaleString()} pts
          </span>
        </>
      ) : (
        <div className="h-px flex-1 bg-[#8b22ff]/20" />
      )}
    </div>
  )
}

// Desktop sidebar box. Height is whatever this content needs -- HQ 2026-08-18
// withdrew the earlier "roughly 2x the old badge" ask: with the pulse line
// gone the box is shorter, and that's correct, not a gap to fill.
function CreatorRankingBox() {
  return (
    <div className="mb-3 rounded-lg border border-[#8b22ff]/50 bg-[#8b22ff]/[.18] px-3 py-3">
      <div className="text-[13px] font-black uppercase tracking-wide text-white">CREATOR RANKING</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
        {REVEAL_PERIOD_LABEL} · CHAMPIONSHIP POINTS
      </div>
      <div className="mt-2.5">
        <RankRow rank={1} />
        <RankRow rank={2} />
        <RankRow rank={3} />
      </div>
      {/* "전체 랭킹 보기" -- the full ranking page (up to #500) is explicitly
          NOT built yet (HQ: before 2027 Q1). This is the LibraryItem pattern
          this file already uses for other not-yet-launched items: the slot
          exists, visually intentional, not a dead/broken link. Swap for a
          real <Link target="_blank" href="/watch/rankings"> once that page
          exists. Clicking a name (once real) opens that creator's public
          submission + score + judge notes -- OXXOVO discloses scoring by
          principle, never gated -- but there is nothing to click while every
          row is blank. */}
      <div aria-disabled className="mt-2.5 cursor-not-allowed text-[10px] font-bold text-[#a855ff]/70">
        전체 랭킹 보기 →
      </div>
    </div>
  )
}

// Mobile one-liner (HQ: sidebar is hidden on mobile, so #1-3 never appear
// there -- only this single row, tapping through to the same not-yet-built
// full ranking page). Rendered by ArenaShell below, md:hidden.
function CreatorRankingMobileBar() {
  return (
    <div
      aria-disabled
      className="mb-4 flex cursor-not-allowed items-center justify-between rounded-lg border border-[#8b22ff]/50 bg-[#8b22ff]/[.18] px-4 py-3 md:hidden"
    >
      <span className="text-[13px] font-black uppercase tracking-wide text-white">CREATOR RANKING</span>
      <span className="text-[16px] text-[#a855ff]/70">→</span>
    </div>
  )
}

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
      <CreatorRankingBox />

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

        <main className="min-w-0 flex-1 px-6 py-6">
          <CreatorRankingMobileBar />
          {children}
        </main>
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
