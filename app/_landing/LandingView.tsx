'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getCurrentSeason,
  resolveSeasonCta,
  advanceCountLabel,
  formatAccessCopy,
  formatDeadlinePT,
  formatModelName,
  formatPanelLabel,
  formatWeightPercent,
  isApplicationClosed,
  type Season,
} from '@/lib/seasons'
import { getCurrentSeasonStage } from '@/app/_actions/season-stage'
import { getWatchNavVisible } from '@/app/_actions/watch-nav'
import type { BannerContent } from '@/lib/watch'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { getSessionUser } from '@/app/_actions/auth'
import { getStudioApplicationFlag } from '@/app/apply/actions'
import { getMembershipLandingData } from '@/app/membership/actions'
import type { MembershipLandingData } from '@/app/membership/types'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { useT, useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'

type TimeLeft = { days: string; hours: string; minutes: string; seconds: string }
const ZERO_TIME: TimeLeft = { days: '00', hours: '00', minutes: '00', seconds: '00' }

export function LandingView() {
  const t = useT()
  const lang = useAdminLang()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [membership, setMembership] = useState<MembershipLandingData | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(ZERO_TIME)
  // Lifecycle stage of the current season, from the same resolver /watch uses.
  // Null until it arrives -- the countdown's own visibility is date-driven and
  // does not wait for it, so there is no window where a stale state is on screen.
  const [stage, setStage] = useState<BannerContent | null>(null)
  // When the studio funnel is active (session6 on + studio application round),
  // a direct "Studio" link lets returning participants skip the /apply intro.
  const [studioFunnel, setStudioFunnel] = useState(false)
  // The Watch link. Derived, not declared (lib/watch-nav): Watch has to actually
  // serve in this environment AND the current season has to have something public
  // in it. Starts hidden so the first paint never offers a link the rule will take
  // back a moment later.
  const [watchNav, setWatchNav] = useState(false)

  useEffect(() => {
    getCurrentSeason().then((s) => {
      setSeason(s)
      if (s) getStudioApplicationFlag(s.id).then(setStudioFunnel).catch(() => setStudioFunnel(false))
    })
    getMembershipLandingData().then(setMembership).catch(() => setMembership(null))
    getCurrentSeasonStage().then(setStage).catch(() => setStage(null))
    getWatchNavVisible().then(setWatchNav).catch(() => setWatchNav(false))
  }, [])

  // Reflect the cookie-session sign-in state in the nav.
  useEffect(() => {
    getSessionUser().then((u) => setUser(u ? { email: u.email } : null))
  }, [])

  const targetDate = useMemo(() => {
    if (!season?.application_close_at) return null
    return new Date(season.application_close_at)
  }, [season])

  // The countdown is about ONE deadline: applications closing. Past that instant
  // it was still rendering "Application Closes In / 00 00 00 00" -- through the
  // main round, the vote and the results -- under a CTA that already read "Join
  // the waitlist". Recomputed every render, and the timer below re-renders every
  // second, so it goes away on the tick the deadline passes.
  const SHOW_COUNTDOWN = !!targetDate && !!season && !isApplicationClosed(season)
  // What replaces it: the stage the season is actually in. Same content /watch's
  // banner shows ('accepting' is the open-applications default, which on the
  // landing is the countdown above -- nothing extra to say).
  const stageNote = stage && stage.stage !== 'accepting' ? stage : null

  // Hero/nav CTA gates on the application window (same logic as /tournament/[id]).
  // Before the season loads, show a neutral label; once loaded it is date-driven:
  // before open -> "Get notified" (pre-register), open -> "Apply to <season>".
  const cta = season
    ? resolveSeasonCta(season)
    : { href: '/apply', label: t.landing.cta_default, state: 'waitlist' as const }
  // ★ctaLabel (2026-08-11, TK found on prod): cta.label is resolveSeasonCta's
  // OWN English default (unchanged, other callers like /tournament still read
  // it directly) -- this is the translated text landing actually renders,
  // picked off cta.state rather than duplicating the open/close-window logic.
  const ctaLabel = season
    ? cta.state === 'open'
      ? t.landing.cta_open(season.name)
      : cta.state === 'before_open'
        ? t.landing.cta_before_open
        : t.landing.cta_waitlist
    : t.landing.cta_default

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
    { icon: '⚡', title: t.landing.feat1_title, desc: t.landing.feat1_desc },
    { icon: '✦', title: t.landing.feat2_title, desc: t.landing.feat2_desc },
    { icon: '♛', title: t.landing.feat3_title, desc: t.landing.feat3_desc },
    { icon: '◎', title: t.landing.feat4_title, desc: t.landing.feat4_desc },
    { icon: '❖', title: t.landing.feat5_title, desc: t.landing.feat5_desc },
  ]

  const modelCount = season?.ai_models.length ?? 3
  const panelLabel = season ? formatPanelLabel(season.ai_models) : 'multi-AI'

  return (
    <main className="relative bg-[#030305] text-white">

      {/* The header is one row at h-20 on every viewport -- the hero below hardcodes
          that 80px (`h-[calc(100vh-80px)]`), so nothing here may change its height.
          Under md the row has ~327px to spend at the common 375px floor, and the
          brand alone was taking ~259px of it: the auth controls had no width to be
          shown in. The two brand shrinks below buy it back, and the header CTA
          folds away because the hero already renders the same button (see there). */}
      <header className="relative z-30 flex h-20 items-center justify-between px-12 max-md:px-6">
        {/* href="#" did nothing anywhere, and this view is not only the root:
            app/welcome/page.tsx renders the same LandingView, and /welcome is where
            Watch's sidebar "Tournament" link lands -- so on that URL the brand was
            simply dead. "/" is what the four existing back-links already use
            (/tournament, /about, /faq, /guidelines), and it stays correct if
            watch_as_home is ever turned on: the root becomes Watch, which is then
            what home means. On the root itself this reloads, which is what a logo
            does on a homepage. */}
        <Link href="/" className="flex items-center gap-3">
          {/* h-24 is 96px inside an 80px header -- it overflows the row on every
              viewport. max-md:h-14 both fixes that on mobile and returns ~60px. */}
          <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-24 max-md:h-14 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
          {/* Dropping the wordmark under md returns ~115px and the logo still reads
              as the brand. Same trade ArenaTopBar.tsx:45 already makes at max-sm. */}
          <span className="text-[26px] font-black tracking-wide text-[#8b22ff] max-md:hidden">OXXOVO</span>
        </Link>

        <nav className="flex items-center gap-9 text-[14px] font-medium text-white/75 max-md:hidden">
          <a className="transition hover:text-[#b66cff]" href="/tournament">{t.landing.nav_tournament}</a>
          {studioFunnel && (
            <a className="transition hover:text-[#b66cff]" href="/studio">{t.landing.nav_studio}</a>
          )}
          {watchNav && (
            <a className="transition hover:text-[#b66cff]" href="/watch">{t.landing.nav_watch}</a>
          )}
          <a className="transition hover:text-[#b66cff]" href="#how">{t.landing.nav_how}</a>
          <a className="transition hover:text-[#b66cff]" href="#about">{t.landing.nav_about}</a>
          <a className="transition hover:text-[#b66cff]" href="/membership">{t.landing.nav_membership}</a>
          <a className="transition hover:text-[#b66cff]" href="#faq">{t.landing.nav_faq}</a>
        </nav>

        <div className="flex items-center gap-5">
          <LangSwitch />
          {user ? (
            <>
              {/* Shown on mobile: this is the only /profile link on the page, and
                  /profile carries the Studio entry (:208, same studioFunnel gate)
                  and Log out (:317) with no viewport gates of its own.

                  ★122px is measured, not chosen. An email local-part is one
                  unbreakable word, so this never wraps -- flex sacrifices its
                  siblings instead, and the row hides that until it is ugly. Swept
                  at 375px in Chrome: at 13 characters everything is still at its
                  natural size (logo 84px, Log out 93x43). At 14 the Log out label
                  breaks to two lines (43 -> 64px tall). From 15 the logo starts
                  shrinking, and by 31 it is 0px -- the brand is gone and only then
                  does anything overflow. 122px is the widest this link measured
                  while all three were still untouched (13 ch = 122.2px), so the
                  cap is the last pristine state rather than the first broken one.
                  It leaves ~17 characters readable, which names the account.
                  Capped under md only: >=md has its own overflow, which predates
                  this and belongs with the (6)A drawer work. */}
              <a
                href="/profile"
                className="text-[14px] text-white/70 hover:text-white transition cursor-pointer max-md:max-w-[122px] max-md:truncate"
              >
                {t.landing.greeting(user.email.split('@')[0])}
              </a>
              {/* Stays hidden under md, deliberately: a fourth item does not fit
                  (~296px against a ~243px budget). Reached via /profile instead. */}
              {studioFunnel && (
                <a
                  href="/studio"
                  className="rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] px-5 py-2.5 text-[14px] font-bold text-white/90 transition hover:bg-[#8b22ff]/[.16] max-md:hidden"
                >
                  {t.landing.nav_studio}
                </a>
              )}
              {/* Folded under md -- not removed: the hero renders the same cta.href
                  and cta.label as a full-width h-[64px] button one screenful down,
                  ungated. Keeping both costs 191-342px depending on the label, and
                  the pre-open label alone is wider than the whole mobile row. */}
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110 max-md:hidden" href={cta.href}>
                {ctaLabel}
              </a>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white"
              >
                {t.landing.logout}
              </button>
            </>
          ) : (
            <>
              {/* Shown on mobile. Without it a phone visitor has no way to sign in
                  from here whenever the CTA is not /apply -- before the window
                  opens and after it closes, /pre-register has no login link. */}
              <a className="text-[14px] text-white/60" href="/login">{t.landing.login}</a>
              <a className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] transition hover:brightness-110 max-md:hidden" href={cta.href}>
                {ctaLabel}
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
              {t.landing.eyebrow}
            </div>

            <h1
              className={`text-[clamp(32px,3.2vw,54px)] font-black uppercase leading-[.96] ${
                lang === 'ko' ? 'tracking-[-.02em]' : 'tracking-[-.04em]'
              }`}
            >
              {t.landing.h1_line1}<br />
              <span className="text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)]">{t.landing.h1_line2}</span>
            </h1>

            <div className="mt-8 max-w-[460px]">
              <p className="text-[18px] font-black text-white uppercase tracking-[0.055em]">{t.landing.sub1}</p>
              <p className="mt-2 text-[16px] italic font-semibold text-gray-400">{t.landing.sub2}</p>
            </div>

            <div className="mt-7 w-[min(100%,500px)]">
              <a
                href={cta.href}
                className="flex h-[64px] items-center justify-center rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-8 text-[16px] font-extrabold uppercase tracking-wide text-white shadow-[0_0_28px_rgba(139,34,255,.5)] transition hover:brightness-110"
              >
                {ctaLabel}
              </a>
              <a
                href="/tournament"
                className="mt-3 flex h-[52px] items-center justify-center rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.06] px-8 text-[15px] font-bold uppercase tracking-wide text-white/90 transition hover:bg-[#8b22ff]/[.12]"
              >
                {t.landing.hero_tournament_btn}
              </a>
              <p className="mt-2.5 text-xs text-white/50">
                {t.landing.hero_submit_prefix} {season ? (
                  <>{t.landing.hero_submit_scoring(panelLabel)}</>
                ) : (
                  <>{t.landing.hero_submit_fallback}</>
                )}
              </p>
            </div>

            {SHOW_COUNTDOWN && (
              <div className="mt-7 w-[min(100%,500px)] border-t border-white/10 pt-5">
                <div className="mb-1 text-[12px] font-bold uppercase tracking-widest text-[#b66cff]">
                  {t.landing.countdown_label}
                </div>
                {formatDeadlinePT(season?.application_close_at, lang) && (
                  <div className="mb-3.5 text-[12px] text-white/50">
                    {formatDeadlinePT(season?.application_close_at, lang)}
                  </div>
                )}
                <div className="grid max-w-[400px] grid-cols-4">
                  {[[t.landing.countdown_days, timeLeft.days], [t.landing.countdown_hrs, timeLeft.hours], [t.landing.countdown_min, timeLeft.minutes], [t.landing.countdown_sec, timeLeft.seconds]].map(([label, val], i) => (
                    <div key={label} className={`${i > 0 ? 'border-l border-white/10 pl-5' : ''} ${i < 3 ? 'pr-5' : ''}`}>
                      <strong className="block text-[28px] font-semibold tracking-wide">{val}</strong>
                      <span className="mt-1 block text-[11px] uppercase text-white/50">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stageNote && (
              <div className="mt-7 w-[min(100%,500px)] border-t border-white/10 pt-5">
                <div className="flex items-center gap-4">
                  <span aria-hidden className="text-[34px] leading-none">{stageNote.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold leading-snug text-white">{stageNote.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/60">{stageNote.subtitle}</p>
                  </div>
                </div>
                {/* These stages tell the audience to come and watch, so the link
                    belongs -- but only under the same rule as the header entry, so
                    the landing can never invite someone to a 404 or an empty grid.
                    One rule, two places (lib/watch-nav).
                    ★stageNote.title/subtitle are NOT wired here -- getBannerStage()
                    (lib/watch.ts) returns them as literal English, out of this
                    pass's scope (제니3 소관, per reports/
                    lane_c_i18n_translation_list_2026-08-10.md). */}
                {watchNav && (
                  <a
                    href="/watch"
                    className="mt-3 inline-flex text-[13px] font-bold text-[#b66cff] transition hover:text-white"
                  >
                    {t.landing.watch_link}
                  </a>
                )}
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

      <section id="how" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24">
        <div className="text-center mb-14">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">{t.landing.how_eyebrow}</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3">{t.landing.how_h2}</h2>
        </div>

        {season ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Step
              num="01"
              title={t.landing.step1_title}
              body={t.landing.step1_body(season.application_video_min_seconds, season.application_video_max_seconds)}
            />
            <Step
              num="02"
              title={t.landing.step2_title(panelLabel)}
              body={t.landing.step2_body(modelCount)}
            />
            <Step
              num="03"
              title={t.landing.step3_title}
              body={t.landing.step3_body(
                formatWeightPercent(season.scoring_intent_clarity_weight),
                formatWeightPercent(season.scoring_execution_weight),
                formatWeightPercent(season.scoring_originality_weight),
              )}
            />
            <Step
              num="04"
              title={t.landing.step4_title}
              body={t.landing.step4_body(
                advanceCountLabel(season),
                season.name,
                Number(season.total_prize_pool).toLocaleString(),
                Number(season.prize_first).toLocaleString(),
                Number(season.prize_second).toLocaleString(),
                Number(season.prize_third).toLocaleString(),
              )}
            />
          </div>
        ) : (
          <SectionLoading />
        )}
      </section>

      <section id="about" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">{t.landing.about_eyebrow}</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3 mb-6">
            {t.landing.about_h2_line1}<br />{t.landing.about_h2_line2}
          </h2>
          <p className="text-white/70 leading-relaxed text-lg">
            {t.landing.about_body(panelLabel)}
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/10">
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">{modelCount}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">{t.landing.stat1_label}</div>
            </div>
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">{t.landing.stat2_value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">{t.landing.stat2_label}</div>
            </div>
            <div>
              <div className="text-[#8b22ff] text-3xl font-black">{t.landing.stat3_value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider mt-1.5">{t.landing.stat3_label}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-20 mx-auto max-w-6xl px-6 py-24 scroll-mt-24 border-t border-white/5">
        <div className="text-center mb-14">
          <span className="text-[#b66cff] uppercase tracking-widest text-sm font-bold">{t.landing.faq_eyebrow}</span>
          <h2 className="text-4xl md:text-5xl font-black mt-3">{t.landing.faq_h2}</h2>
        </div>

        {season ? (
          <div className="max-w-3xl mx-auto space-y-3">
            <Faq q={t.landing.faq_q1(season.name)}>
              {t.landing.faq_a1(season.application_video_min_seconds, season.application_video_max_seconds)}
            </Faq>

            {/* ★FAQ #2's answer stays English-only regardless of language toggle --
                formatAccessCopy() (lib/seasons.ts) is a dynamic function whose
                Korean text was never approved (the translation doc explicitly
                marks it "동적 함수, 별도 처리" and its own 3-branch draft copy
                doesn't match this function's actual 2-branch logic). Only the
                question is translated. */}
            <Faq q={t.landing.faq_q2}>
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

            <Faq q={t.landing.faq_q3}>
              {t.landing.faq_a3}
            </Faq>

            <Faq q={t.landing.faq_q4}>
              {t.landing.faq_a4_intro(modelCount)}
              <span className="block mt-3 text-white/55 text-sm leading-relaxed">
                {season.ai_models.map((m) => (
                  <span key={m.name} className="block">
                    • {formatModelName(m.name)}{m.provider ? ` (${m.provider})` : ''}
                  </span>
                ))}
              </span>
              <span className="block mt-4">
                {t.landing.faq_a4_outro(
                  formatWeightPercent(season.scoring_intent_clarity_weight),
                  formatWeightPercent(season.scoring_execution_weight),
                  formatWeightPercent(season.scoring_originality_weight),
                )}
              </span>
            </Faq>

            <Faq q={t.landing.faq_q5(modelCount)}>
              {t.landing.faq_a5(modelCount, panelLabel)}
            </Faq>

            <Faq q={t.landing.faq_q6(season.max_applicants)}>
              {t.landing.faq_a6(season.name, season.max_applicants)}
            </Faq>

            <Faq q={t.landing.faq_q7}>
              {t.landing.faq_a7(
                season.name,
                Number(season.total_prize_pool).toLocaleString(),
                Number(season.prize_first).toLocaleString(),
                Number(season.prize_second).toLocaleString(),
                Number(season.prize_third).toLocaleString(),
                advanceCountLabel(season),
              )}
            </Faq>

            <Faq q={t.landing.faq_q8}>
              {t.landing.faq_a8}
            </Faq>

            <Faq q={t.landing.faq_q9}>
              {t.landing.faq_a9}
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
            <span className="text-[#b66cff]">{t.landing.footer_tagline}</span>
          </div>
          <span>OXXOVO Labs Inc. · Las Vegas, Nevada, USA · oxxovo.ai</span>
          <div className="flex items-center gap-4">
            <a href="/tournament" className="hover:text-white/70">{t.landing.footer_tournament}</a>
            <a href="/membership" className="hover:text-white/70">{t.landing.footer_membership}</a>
            <a href="/terms" className="hover:text-white/70">{t.landing.footer_terms}</a>
            <a href="/privacy" className="hover:text-white/70">{t.landing.footer_privacy}</a>
            <a href="/rules" className="hover:text-white/70">{t.landing.footer_rules}</a>
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
  const t = useT()
  return <div className="text-center text-white/35 text-sm">{t.landing.loading}</div>
}

// Local KO|EN toggle (mirrors the membership/profile-page pattern). Auto-
// detect (localStorage > browser language) picks the default; this overrides
// it and the choice persists via the same localStorage key useAdminLang()
// reads everywhere else (apply/profile/membership/Studio, and Watch once
// wired) -- one toggle here is enough for the choice to follow the visitor
// across pages, but Watch gets its own too (a visitor who lands there first,
// e.g. via a shared link, never having seen this page). (TK 2026-08-11: KO/EN
// are canonical; any other language is left to the browser's own translator.)
function LangSwitch() {
  const lang = useAdminLang()
  const cls = (active: boolean) =>
    `px-2 py-1 text-[11px] transition ${
      active ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'
    }`
  const set = (next: Lang) => setAdminLang(next)
  return (
    <div className="flex items-center border border-white/20 rounded overflow-hidden">
      <button type="button" onClick={() => set('ko')} className={cls(lang === 'ko')}>
        KO
      </button>
      <span className="text-white/20 text-[11px]">|</span>
      <button type="button" onClick={() => set('en')} className={cls(lang === 'en')}>
        EN
      </button>
    </div>
  )
}
