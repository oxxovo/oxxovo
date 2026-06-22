'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCurrentSeason,
  advanceCountLabel,
  formatAccessCopy,
  formatDeadlinePT,
  formatAiModelList,
  formatAiProviderList,
  formatModelName,
  formatPanelLabel,
  formatWeightPercent,
  getIntegrityModel,
  type Season,
} from '@/lib/seasons'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { getSessionUser } from '@/app/_actions/auth'
import { getMembershipLandingData } from '@/app/membership/actions'
import type { MembershipLandingData } from '@/app/membership/types'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { LobbySection } from './_components/LobbySection'

type TimeLeft = { days: string; hours: string; minutes: string; seconds: string }
const ZERO_TIME: TimeLeft = { days: '00', hours: '00', minutes: '00', seconds: '00' }

export default function OXXOVOLandingPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [membership, setMembership] = useState<MembershipLandingData | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(ZERO_TIME)

  useEffect(() => {
    getCurrentSeason().then(setSeason)
    getMembershipLandingData().then(setMembership).catch(() => setMembership(null))
  }, [])

  // Reflect the cookie-session sign-in state in the nav.
  useEffect(() => {
    getSessionUser().then((u) => setUser(u ? { email: u.email } : null))
  }, [])

  const targetDate = useMemo(() => {
    if (!season?.application_close_at) return null
    return new Date(season.application_close_at)
  }, [season])

  const SHOW_COUNTDOWN = !!targetDate

  useEffect(() => {
    if (!targetDate) return
    const update = () => {
      const distance = targetDate.getTime() - Date.now()
      if (distance <= 0) {
        setTimeLeft(ZERO_TIME)
        return
      }
      const d = Math.floor(distance / 86400000)
      const h = Math.floor((distance % 86400000) / 3600000)
      const m = Math.floor((distance % 3600000) / 60000)
      const s = Math.floor((distance % 60000) / 1000)
      setTimeLeft({
        days: String(d).padStart(2, '0'),
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
      })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    window.location.reload()
  }

  const features = [
    { icon: '⚡', title: 'Real-time', desc: 'Live tournaments. Feel the pressure.' },
    { icon: '✦', title: 'Verified', desc: 'Same prompt. Same conditions.' },
    { icon: '♛', title: 'Ranked', desc: 'Global leaderboard. Earn your reputation.' },
    { icon: '◎', title: 'Global', desc: 'Creators from around the world.' },
    { icon: '❖', title: 'Built for Creators', desc: 'Made by creators. For creators.' },
  ]

  const integrityModel = season ? getIntegrityModel(season.ai_models) : null
  const modelCount = season?.ai_models.length ?? 3
  const panelLabel = season ? formatPanelLabel(season.ai_models) : 'multi-AI'

  return (
    <main className="relative bg-[#030305] text-white">

      <header className="relative z-30 flex h-20 items-center justify-between px-12 max-md:px-6">
        <a href="#" className="flex items-center gap-3">
          <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-24 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
          <span className="text-[26px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </a>

        <nav className="flex items-center gap-9 text-[14px] font-medium text-white/75 max-md:hidden">
          <a className="transition hover:text-[#b66cff]" href="/tournament">Tournament</a>
          <a className="transition hover:text-[#b66cff]" href="#how">How It Works</a>
          <a className="transition hover:text-[#b66cff]" href="#about">About</a>
          <a className="transition hover:text-[#b66cff]" href="/membership">Membership</a>
          <a className="transition hover:text-[#b66cff]" href="#faq">FAQ</a>
        </nav>

        <div className="flex items-center gap-5">
          {user ? (
            <>
              <a
                href="/profile"
                className="text-[14px] text-white/70 hover:text-white max-md:hidden transition cursor-pointer"
              >
                Hi, {user.email.split('@')[0]}
              </a>
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110" href="/apply">
                Apply to {season?.name ?? 'GENESIS'}
              </a>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white max-md:hidden"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a className="text-[14px] text-white/60 max-md:hidden" href="/login">Log in</a>
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110" href="/apply">
                Apply to {season?.name ?? 'GENESIS'}
              </a>
            </>
          )}
        </div>
      </header>

      <section className="relative h-[calc(100vh-80px)] min-h-[640px] overflow-hidden">
        <div className="absolute right-0 top-0 z-0 h-full w-[50vw] max-md:w-full max-md:opacity-30">
          <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,#030305_0%,rgba(3,3,5,.95)_4%,rgba(3,3,5,.1)_22%,transparent_60%)]" />
          <img
            src="/arena_image.png"
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: '50% 25%', filter: 'brightness(1.3) saturate(1.6)' }}
          />
        </div>

        <div className="relative z-10 flex h-full items-center px-12 max-md:px-6">
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

            <div className="mt-7 w-[min(100%,500px)]">
              <a
                href="/apply"
                className="flex h-[64px] items-center justify-center rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-8 text-[16px] font-extrabold uppercase tracking-wide text-white shadow-[0_0_28px_rgba(139,34,255,.5)] transition hover:brightness-110"
              >
                Apply to {season?.name ?? 'GENESIS'}
              </a>
              <a
                href="/tournament"
                className="mt-3 flex h-[52px] items-center justify-center rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.06] px-8 text-[15px] font-bold uppercase tracking-wide text-white/90 transition hover:bg-[#8b22ff]/[.12]"
              >
                Tournament Info
              </a>
              <p className="mt-2.5 text-xs text-white/50">
                Submit your AI video. {season ? (
                  <>
                    {panelLabel} scoring by {formatAiProviderList(season.ai_models)}.
                  </>
                ) : (
                  <>AI verified scoring.</>
                )}
              </p>
            </div>

            {SHOW_COUNTDOWN && (
              <div className="mt-7 w-[min(100%,500px)] border-t border-white/10 pt-5">
                <div className="mb-1 text-[12px] font-bold uppercase tracking-widest text-[#b66cff]">
                  Application Closes In
                </div>
                {formatDeadlinePT(season?.application_close_at) && (
                  <div className="mb-3.5 text-[12px] text-white/50">
                    {formatDeadlinePT(season?.application_close_at)}
                  </div>
                )}
                <div className="grid max-w-[400px] grid-cols-4">
                  {[['Days', timeLeft.days], ['Hrs', timeLeft.hours], ['Min', timeLeft.minutes], ['Sec', timeLeft.seconds]].map(([label, val], i) => (
                    <div key={label} className={`${i > 0 ? 'border-l border-white/10 pl-5' : ''} ${i < 3 ? 'pr-5' : ''}`}>
                      <strong className="block text-[28px] font-semibold tracking-wide">{val}</strong>
                      <span className="mt-1 block text-[11px] uppercase text-white/50">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      <section className="relative z-20 mx-6 -mt-12 grid grid-cols-5 overflow-hidden rounded-lg border border-[#8b22ff]/20 bg-[#0a0812]/90 backdrop-blur-xl max-md:grid-cols-2 max-md:mx-4">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`grid min-h-[88px] grid-cols-[44px_1fr] items-center gap-3 px-5 py-4 ${
              i < features.length - 1 ? 'border-r border-white/10 max-md:border-r-0 max-md:border-b' : ''
            }`}
          >
            <div className="text-[28px] leading-none text-[#8b22ff]">{f.icon}</div>
            <div>
              <h3 className="mb-1 text-[13px] font-extrabold">{f.title}</h3>
              <p className="text-[11px] leading-relaxed text-white/55">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <LobbySection />

      <section id="how" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24">
        <div className="text-center mb-14">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3">Submit. Get Verified. Win.</h2>
        </div>

        {season ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Step
              num="01"
              title="Share Your Video"
              body={
                <>
                  Share your AI-generated video ({season.application_video_min_seconds}–{season.application_video_max_seconds} seconds) — hosted on YouTube or Vimeo. Use any AI service: Sora, Veo, Runway, Kling, Pika, or others.
                </>
              }
            />
            <Step
              num="02"
              title={`${panelLabel} Judges`}
              body={
                <>
                  {modelCount === 3 ? 'Three' : modelCount} independent AI models — {formatAiModelList(season.ai_models)} — from {modelCount === 3 ? 'three' : modelCount} different companies score your work in parallel. Eliminates single-AI bias.
                </>
              }
            />
            <Step
              num="03"
              title="Get Your Score"
              body={
                <>
                  Receive your final OXXOVO Score across four categories: Intent Clarity ({formatWeightPercent(season.scoring_intent_clarity_weight)}), Execution ({formatWeightPercent(season.scoring_execution_weight)}), Originality ({formatWeightPercent(season.scoring_originality_weight)}), Integrity ({formatWeightPercent(season.scoring_integrity_weight)}).
                </>
              }
            />
            <Step
              num="04"
              title="Earn Your Title"
              body={
                <>
                  The {advanceCountLabel(season)} advance as Finalists, competing for the {season.name} prize pool of ${Number(season.total_prize_pool).toLocaleString()} (${Number(season.prize_first).toLocaleString()} / ${Number(season.prize_second).toLocaleString()} / ${Number(season.prize_third).toLocaleString()}).
                </>
              }
            />
          </div>
        ) : (
          <SectionLoading />
        )}
      </section>

      <section id="about" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">About</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3 mb-6">
            The First Verified Arena<br />for AI Video Creators.
          </h2>
          <p className="text-white/70 leading-relaxed text-lg">
            OXXOVO is the global arena for AI video creators. We verify AI-generated content with independent {panelLabel.toLowerCase()} scoring to ensure fairness. Founded in Las Vegas, OXXOVO Labs Inc. operates the first AI-verified video tournament platform.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/10">
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">{modelCount}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">Independent AI Judges</div>
            </div>
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">Global</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">Open to All Creators</div>
            </div>
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">Verified</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">Same Rules. No Excuses.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24 border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">FAQ</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3">Common Questions</h2>
        </div>

        {season ? (
          <div className="max-w-3xl mx-auto space-y-3">
            <Faq q={`Who can participate in ${season.name}?`}>
              Anyone, anywhere. There are no nationality, age, or experience requirements. You just need an AI-generated video ({season.application_video_min_seconds}–{season.application_video_max_seconds} seconds) and a free OXXOVO account.
            </Faq>

            <Faq q="What does it cost to compete?">
              {formatAccessCopy({
                seasonName: season.name,
                entryFee: Number(season.entry_fee),
                membershipEnabled: membership?.enabled ?? false,
                price: membership?.price ?? null,
                interval: membership?.interval ?? 'month',
                foundingMonths: membership?.foundingMonths ?? null,
                foundingCap: membership?.founding.cap ?? 0,
              })}
            </Faq>

            <Faq q="What AI tools can I use?">
              Sora, Veo, Runway, Kling, Pika, or any other AI video generation service. We accept all major platforms — the focus is on your creative direction, not which tool you choose.
            </Faq>

            <Faq q="How exactly are submissions scored?">
              Each video is judged by {modelCount} AI models in parallel:
              <span className="block mt-3 text-white/55 text-sm leading-relaxed">
                {season.ai_models.map((m) => (
                  <span key={m.name} className="block">
                    • {formatModelName(m.name)}{m.provider ? ` (${m.provider})` : ''}
                  </span>
                ))}
              </span>
              <span className="block mt-4">
                Your final OXXOVO Score is a weighted average across four categories: Intent Clarity ({formatWeightPercent(season.scoring_intent_clarity_weight)}), Execution ({formatWeightPercent(season.scoring_execution_weight)}), Originality ({formatWeightPercent(season.scoring_originality_weight)}), and Integrity ({formatWeightPercent(season.scoring_integrity_weight)}). Outlier scores are automatically excluded.
              </span>
            </Faq>

            <Faq q={`Why ${modelCount === 3 ? 'three' : modelCount} AIs instead of one?`}>
              Every AI has bias. By using {modelCount} independent models from {modelCount} different companies, individual biases cancel out. When the panel agrees, the result is far more trustworthy than any single AI&apos;s verdict. This is what makes OXXOVO scoring {panelLabel} Verified.
            </Faq>

            <Faq q={`What if ${season.max_applicants} people apply before me?`}>
              {season.name} accepts up to {season.max_applicants} applicants. If the limit is reached before you apply, you&apos;ll be automatically added to the {season.name} Waitlist with priority access to the next season. We never turn anyone away.
            </Faq>

            <Faq q="What are the prizes?">
              {season.name} features a ${Number(season.total_prize_pool).toLocaleString()} prize pool (${Number(season.prize_first).toLocaleString()} for 1st, ${Number(season.prize_second).toLocaleString()} for 2nd, ${Number(season.prize_third).toLocaleString()} for 3rd). The {advanceCountLabel(season)} earn the Finalist title. Future seasons&apos; prize pools scale with participation. The Grand Final prize pool will be announced based on tournament participation.
            </Faq>

            <Faq q="How does OXXOVO prevent cheating?">
              Our Integrity score ({formatWeightPercent(season.scoring_integrity_weight)} weight{integrityModel ? `, judged solely by ${formatModelName(integrityModel.name)} to prevent AI collusion` : ''}) automatically detects misrepresentation. Submissions with Integrity scores below {season.flag_integrity_threshold} are flagged for human review. False claims about your AI tool or content origin result in automatic disqualification.
            </Faq>

            <Faq q="When do I get my results?">
              {panelLabel} scoring takes approximately 60–90 seconds per submission. Your individual score appears in your profile soon after submission. Final rankings are published after the application period closes.
            </Faq>
          </div>
        ) : (
          <SectionLoading />
        )}
      </section>

      <footer className="relative z-20 border-t border-white/10 px-12 py-3 text-[11px] text-white/40 max-md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-6 opacity-70" />
            <span className="text-[#b66cff]">The New Standard for AI Creativity</span>
          </div>
          <span>OXXOVO Labs Inc. · Las Vegas, Nevada, USA · oxxovo.ai</span>
          <div className="flex items-center gap-4">
            <a href="/tournament" className="hover:text-white/70">Tournament</a>
            <a href="/membership" className="hover:text-white/70">Membership</a>
            <a href="/terms" className="hover:text-white/70">Terms</a>
            <a href="/privacy" className="hover:text-white/70">Privacy</a>
            <a href="/rules" className="hover:text-white/70">Rules</a>
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] text-white/20">OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.</p>
        <p className="text-center text-[10px] text-white/20">{formatFooterStatusLine()}</p>
      </footer>

    </main>
  )
}

function Step({ num, title, body }: { num: string; title: string; body: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded-lg p-6 bg-white/[0.03] hover:bg-white/[0.06] transition">
      <div className="text-[#8b22ff] text-2xl font-black mb-3">{num}</div>
      <h3 className="text-lg font-bold mb-2.5">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border border-white/10 rounded-lg bg-white/[0.03] open:bg-white/[0.06] transition">
      <summary className="font-bold cursor-pointer list-none flex items-center justify-between gap-4 p-5">
        <span>{q}</span>
        <span className="text-[#8b22ff] text-xl shrink-0 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-5 pb-5 text-white/65 leading-relaxed text-[15px]">{children}</div>
    </details>
  )
}

function SectionLoading() {
  return <div className="text-center text-white/35 text-sm">Loading…</div>
}
