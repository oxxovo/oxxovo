'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

// Watch top bar (arena design): purple OXXOVO wordmark, hamburger, in-page
// search, notifications + profile. Logo + search stay inside /watch.
export function ArenaTopBar({
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
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 items-center gap-3 border-b border-white/10 bg-[#0a0810]/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="rounded p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        ☰
      </button>

      <Link href="/watch" aria-label="Watch home" className="flex shrink-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/oxxovo_logo.png"
          alt="OXXOVO"
          className="h-16 brightness-200 saturate-150 drop-shadow-[0_0_18px_rgba(199,155,255,.85)]"
        />
        {/* Purple wordmark (8_final) -- #8B22FF family, brightened for contrast. */}
        <span className="text-xl font-black tracking-wide text-[#a855ff] drop-shadow-[0_0_12px_rgba(139,34,255,.6)] max-sm:hidden">
          OXXOVO
        </span>
      </Link>

      <form onSubmit={submitSearch} className="mx-auto max-w-xl flex-1">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search videos & creators"
          aria-label="Search videos and creators"
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#8b22ff]"
        />
      </form>

      <div className="flex shrink-0 items-center gap-3">
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
