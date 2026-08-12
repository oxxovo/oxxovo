'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useT, useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'

// Fixed top bar (YouTube-style): hamburger + logo (left), video search (by
// creator name / nickname), notifications + profile (right). Submitting the
// search navigates to /watch?q=<term>; the grid filters server-side.
export function WatchTopBar({
  onMenu,
  user,
}: {
  onMenu: () => void
  user: { email: string } | null
}) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/watch?q=${encodeURIComponent(term)}` : '/watch')
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-20 flex items-center gap-3 px-4 border-b border-white/10 bg-[#0a0810]/95 backdrop-blur">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="rounded p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        ☰
      </button>

      {/* Logo always goes to the Watch home (YouTube-style: logo = current
          platform home). The landing is reachable via the sidebar "Tournament". */}
      <Link href="/watch" aria-label="Watch home" className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* Logo icon only = LIGHT purple (brightened hard so the deep-purple
            symbol reads as lavender on black); wordmark stays DEEP #8B22FF. */}
        <img
          src="/oxxovo_logo.png"
          alt="OXXOVO"
          className="h-16 brightness-200 saturate-150 drop-shadow-[0_0_18px_rgba(199,155,255,.85)]"
        />
        <span className="text-xl font-black tracking-wide text-white drop-shadow-[0_0_12px_rgba(139,34,255,.5)] max-sm:hidden">
          OXXOVO
        </span>
      </Link>

      <form onSubmit={submitSearch} className="flex-1 max-w-xl mx-auto">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.watch.search_placeholder}
          aria-label="Search videos and creators"
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#8b22ff]"
        />
      </form>

      <div className="flex items-center gap-3 shrink-0">
        <LangSwitch />
        <span aria-label="Notifications" className="text-lg text-white/50">🔔</span>
        {user ? (
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-sm font-black text-white"
          >
            {user.email.charAt(0).toUpperCase()}
          </Link>
        ) : (
          <Link href="/login" className="text-sm font-bold text-white/80 hover:text-white">
            {t.watch.signin}
          </Link>
        )}
      </div>
    </header>
  )
}

// Same KO|EN toggle as landing/membership/profile/ArenaTopBar -- shared
// localStorage key, so a choice made anywhere follows the visitor everywhere.
function LangSwitch() {
  const lang = useAdminLang()
  const cls = (active: boolean) =>
    `px-2 py-1 text-[11px] transition ${active ? 'text-[#8b22ff] font-bold' : 'text-white/40 hover:text-white/70'}`
  const set = (next: Lang) => setAdminLang(next)
  return (
    <div className="flex items-center border border-white/15 rounded overflow-hidden">
      <button type="button" onClick={() => set('ko')} className={cls(lang === 'ko')}>KO</button>
      <span className="text-white/20 text-[11px]">|</span>
      <button type="button" onClick={() => set('en')} className={cls(lang === 'en')}>EN</button>
    </div>
  )
}
