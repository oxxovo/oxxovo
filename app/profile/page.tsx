'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentSeason, type Season } from '@/lib/seasons'

export default function ProfilePage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState<Season | null>(null)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('oxxovo_token')
    const email = localStorage.getItem('oxxovo_email')

    if (!token || !email) {
      router.push('/login')
      return
    }

    setUser({ email })
    setLoading(false)
    getCurrentSeason().then(setSeason)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('oxxovo_token')
    localStorage.removeItem('oxxovo_email')
    router.push('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/60">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex h-20 items-center justify-between px-12 border-b border-white/10">
        <a href="/" className="flex items-center gap-3">
          <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
          <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </a>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white"
        >
          Log out
        </button>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-3xl font-black text-white mb-4 shadow-[0_0_30px_rgba(139,34,255,.5)]">
            {user?.email.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-3xl font-black mb-2">
            {user?.email.split('@')[0]}
          </h1>
          <p className="text-white/50 text-sm">{user?.email}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-[#b66cff] mb-2">Score</p>
            <p className="text-3xl font-black text-white/30">—</p>
            <p className="text-xs text-white/40 mt-1">Coming soon</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-[#b66cff] mb-2">Rank</p>
            <p className="text-3xl font-black text-white/30">—</p>
            <p className="text-xs text-white/40 mt-1">Coming soon</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <p className="text-xs uppercase tracking-widest text-[#b66cff] mb-2">Wins</p>
            <p className="text-3xl font-black text-white/30">—</p>
            <p className="text-xs text-white/40 mt-1">Coming soon</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">🏅 Badges</h2>
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 bg-gradient-to-br from-[#7d23ff]/20 to-[#6220dc]/20 border border-[#8b22ff]/50 rounded-full px-4 py-2">
              <span className="text-[#b66cff]">✦</span>
              <span className="text-sm font-bold">Founding Member</span>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">🏆 Tournament History</h2>
          <p className="text-white/40 text-sm text-center py-8">
            No tournaments yet. {season?.name ?? 'GENESIS'} is coming soon.
          </p>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-[#8b22ff] hover:underline text-sm">
            ← Back to Home
          </a>
        </div>
      </section>
    </main>
  )
}