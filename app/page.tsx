'use client'

import { useEffect, useState } from 'react'

export default function OXXOVOLandingPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('oxxovo_token')
    const email = localStorage.getItem('oxxovo_email')
    if (token && email) {
      setUser({ email })
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('oxxovo_token')
    localStorage.removeItem('oxxovo_email')
    setUser(null)
    window.location.reload()
  }

  const features = [
    { icon: '⚡', title: 'Real-time', desc: 'Live tournaments. Feel the pressure.' },
    { icon: '✦', title: 'Verified', desc: 'Same prompt. Same conditions.' },
    { icon: '♛', title: 'Ranked', desc: 'Global leaderboard. Earn your reputation.' },
    { icon: '◎', title: 'Global', desc: 'Creators from around the world.' },
    { icon: '❖', title: 'Built for Creators', desc: 'Made by creators. For creators.' },
  ]

  return (
    <main className="relative h-screen overflow-hidden bg-[#030305] text-white flex flex-col">

      <div className="absolute right-0 top-0 z-0 h-full w-[50vw]">
        <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,#030305_0%,rgba(3,3,5,.95)_4%,rgba(3,3,5,.1)_22%,transparent_60%)]" />
        <img src="/arena_image.png" alt="" className="h-full w-full object-cover" style={{ objectPosition: '50% 25%', filter: 'brightness(1.3) saturate(1.6)' }} />
      </div>

      <header className="relative z-20 flex h-20 shrink-0 items-center justify-between px-12">
        <a href="#" className="flex items-center gap-3">
          <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-24 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
          <span className="text-[26px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </a>
        <nav className="flex items-center gap-9 text-[14px] font-medium text-white/75 max-md:hidden">
          <a className="transition hover:text-[#b66cff]" href="#how">How It Works</a>
          <a className="transition hover:text-[#b66cff]" href="#about">About</a>
          <a className="transition hover:text-[#b66cff]" href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-5">
          {user ? (
            <>
              <a href="/profile" className="text-[14px] text-white/70 hover:text-white max-md:hidden transition cursor-pointer">
                Hi, {user.email.split('@')[0]}
              </a>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a className="text-[14px] text-white/60 max-md:hidden" href="/login">Log in</a>
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110" href="/apply">
                Apply to GENESIS
              </a>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 flex flex-1 items-center px-12">
        <div className="w-[min(100%,580px)]">

          <div className="mb-6 inline-flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.055em] text-[#b66cff]">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-[#8b22ff] shadow-[inset_0_0_0_2px_#050507,0_0_16px_rgba(139,34,255,.7)]" />
            AI Competitive Creation Platform
          </div>

          <h1 className="text-[clamp(32px,3.2vw,54px)] font-black uppercase leading-[.96] tracking-[-.04em]">
            The Global Arena<br />
            for <span className="text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)]">AI Creators.</span>
          </h1>

          <div className="mt-8 max-w-[460px]">
            <p className="text-[18px] font-black text-white uppercase tracking-[0.055em]">AI is easy. Winning is hard.</p>
            <p className="mt-2 text-[16px] italic font-semibold text-gray-400">Same prompt. Same time. No excuses.</p>
          </div>

          <div className="mt-7">
            
              href="/apply"
              className="inline-flex h-[56px] items-center justify-center rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-10 text-[15px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110"
            >
              Apply to GENESIS →
            </a>
            <p className="mt-3 text-xs text-white/40">
              Season 0 · GENESIS — the free launch tournament. Entry is free.
            </p>
          </div>

        </div>
      </section>

      <section className="relative z-20 mx-6 mb-4 grid grid-cols-5 overflow-hidden rounded-lg border border-[#8b22ff]/20 bg-[#0a0812]/80 backdrop-blur-xl">
        {features.map((f, i) => (
          <div key={f.title} className={`grid min-h-[88px] grid-cols-[44px_1fr] items-center gap-3 px-5 py-4 ${i < 4 ? 'border-r border-white/10' : ''}`}>
            <div className="text-[28px] leading-none text-[#8b22ff]">{f.icon}</div>
            <div>
              <h3 className="mb-1 text-[13px] font-extrabold">{f.title}</h3>
              <p className="text-[11px] leading-relaxed text-white/55">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="relative z-20 border-t border-white/10 px-12 py-3 text-[11px] text-white/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-6 opacity-70" />
            <span className="text-[#b66cff]">The New Standard for AI Creativity</span>
          </div>
          <span>OXXOVO Labs Inc. · Las Vegas, Nevada, USA · oxxovo.com · oxxovo.ai</span>
          <div className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white/70">Terms</a>
            <a href="/privacy" className="hover:text-white/70">Privacy</a>
            <a href="/rules" className="hover:text-white/70">Rules</a>
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] text-white/20">Copyright 2026 OXXOVO Labs Inc. All Rights Reserved.</p>
      </footer>

    </main>
  )
}
