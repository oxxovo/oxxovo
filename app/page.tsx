'use client'

import { useEffect, useMemo, useState } from 'react'
export default function OXXOVOLandingPage() {
  const targetDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 12)
    date.setHours(date.getHours() + 8)
    date.setMinutes(date.getMinutes() + 34)
    date.setSeconds(date.getSeconds() + 27)
    return date
  }, [])

  const [timeLeft, setTimeLeft] = useState({ days: '12', hours: '08', minutes: '34', seconds: '27' })
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const update = () => {
      const distance = targetDate.getTime() - Date.now()
      if (distance <= 0) { setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' }); return }
      const d = Math.floor(distance / 86400000)
      const h = Math.floor((distance % 86400000) / 3600000)
      const m = Math.floor((distance % 3600000) / 60000)
      const s = Math.floor((distance % 60000) / 1000)
      setTimeLeft({ days: String(d).padStart(2,'0'), hours: String(h).padStart(2,'0'), minutes: String(m).padStart(2,'0'), seconds: String(s).padStart(2,'0') })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])
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
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    if (res.ok) setSubmitted(true)
  } catch (err) {
    console.error(err)
  }
  setLoading(false)
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
              <a href="/profile" className="text-[14px] text-white/70 max-md:hidden">
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
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110" href="#waitlist">
                Join Waitlist
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

          {!submitted ? (
            <form id="waitlist" onSubmit={handleSubmit} className="mt-7 flex h-[56px] w-[min(100%,500px)] overflow-hidden rounded-lg border border-white/12 bg-[#080b12]/85">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="min-w-0 flex-1 bg-transparent px-5 text-[15px] text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="min-w-[140px] bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 text-[14px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? '...' : 'Join Waitlist'}
              </button>
            </form>
          ) : (
            <div className="mt-7">
              <p className="text-xl font-bold text-[#b66cff]">You are in!</p>
              <p className="mt-1 text-sm text-white/60">Welcome, Pioneer. We will be in touch soon.</p>
            </div>
          )}
          <p className="mt-2.5 text-xs text-white/40">No spam. Unsubscribe anytime.</p>

          <div className="mt-7 w-[min(100%,500px)] border-t border-white/10 pt-5">
            <div className="mb-3.5 text-[12px] font-bold uppercase tracking-widest text-[#b66cff]">Launching Soon</div>
            <div className="grid max-w-[400px] grid-cols-4">
              {[['Days', timeLeft.days], ['Hrs', timeLeft.hours], ['Min', timeLeft.minutes], ['Sec', timeLeft.seconds]].map(([label, val], i) => (
                <div key={label} className={`${i > 0 ? 'border-l border-white/10 pl-5' : ''} ${i < 3 ? 'pr-5' : ''}`}>
                  <strong className="block text-[28px] font-semibold tracking-wide">{val}</strong>
                  <span className="mt-1 block text-[11px] uppercase text-white/50">{label}</span>
                </div>
              ))}
            </div>
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