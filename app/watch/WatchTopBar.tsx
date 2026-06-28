'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/watch?q=${encodeURIComponent(term)}` : '/watch')
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-white/10 bg-[#0a0810]/95 backdrop-blur">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="rounded p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        ☰
      </button>

      <Link href="/watch" className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-7 drop-shadow-[0_0_12px_rgba(139,34,255,.6)]" />
        <span className="text-base font-black tracking-wide text-[#8b22ff] max-sm:hidden">OXXOVO</span>
      </Link>

      <form onSubmit={submitSearch} className="flex-1 max-w-xl mx-auto">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search videos & creators"
          aria-label="Search videos and creators"
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#8b22ff]"
        />
      </form>

      <div className="flex items-center gap-3 shrink-0">
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
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
