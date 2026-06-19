'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getCurrentSeason,
  getActiveApplicationCount,
  isApplicationClosed,
  isCapacityFull,
  formatAiModelList,
  formatPanelLabel,
  type Season,
} from '@/lib/seasons'
import { formatVideoPlatforms, validateVideoUrl } from '@/lib/video-url'
import { useT } from '@/lib/admin-i18n'
import type { ApplyErrorCode } from '@/app/api/apply/route'
import { getSessionUser } from '@/app/_actions/auth'
import { formatFooterStatusLine } from '@/lib/ip-info'
import {
  getStudioApplicationFlag,
  getApplyMembershipState,
  claimFoundingForCurrentUser,
  startMembershipCheckout,
} from './actions'
import type { ApplyMembershipState } from './types'

const AI_SERVICES = ['Sora', 'Veo', 'Runway', 'Kling', 'Pika', 'Other']
const ABSTRACT_WORDS = [
  'explor', 'surreal', 'experimental', 'abstract', 'ethereal',
  'transcendent', 'liminal', 'ineffable', 'journey', 'evocative',
]
const STATEMENT_MIN = 150
const STATEMENT_MAX = 250

// Application stage accepts youtube/vimeo only — main round policy lives in
// seasons.allowed_video_platforms and is a separate decision.
const APPLICATION_ALLOWED_PLATFORMS = ['youtube', 'vimeo']

type Mode = 'loading' | 'closed' | 'waitlist' | 'open'

export default function ApplyPage() {
  const router = useRouter()
  const t = useT()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [mode, setMode] = useState<Mode>('loading')
  const [season, setSeason] = useState<Season | null>(null)
  const [count, setCount] = useState(0)
  const [studioApplication, setStudioApplication] = useState(false)
  const [membership, setMembership] = useState<ApplyMembershipState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [videoUrl, setVideoUrl] = useState('')
  const [videoDuration, setVideoDuration] = useState<number | ''>('')
  const [aiService, setAiService] = useState('')
  const [statement, setStatement] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [agreeRules, setAgreeRules] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeIntegrity, setAgreeIntegrity] = useState(false)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedStatus, setSubmittedStatus] = useState<'pending' | 'waitlist' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      // Identity from the cookie session (A-1: must be signed in to apply).
      const sessionUser = await getSessionUser()
      if (!sessionUser) {
        router.push('/login?redirect=/apply')
        return
      }
      setUser({ email: sessionUser.email })

      const s = await getCurrentSeason()
      if (!s) {
        setMode('closed')
        return
      }
      setSeason(s)
      getStudioApplicationFlag(s.id).then(setStudioApplication)

      // P3 membership gate state. When the switch is off (season-0 dark launch)
      // gateActive is false and the flow is unchanged.
      getApplyMembershipState().then(setMembership)

      const c = await getActiveApplicationCount(s.id)
      setCount(c)

      if (isApplicationClosed(s)) {
        setMode('closed')
      } else if (isCapacityFull(s, c)) {
        setMode('waitlist')
      } else {
        setMode('open')
      }
    }
    init()
  }, [reloadKey])

  const platform = useMemo(() => {
    const v = validateVideoUrl(videoUrl, APPLICATION_ALLOWED_PLATFORMS)
    return v.valid ? v.platform : null
  }, [videoUrl])
  const statementLen = statement.length
  const statementValid = statementLen >= STATEMENT_MIN && statementLen <= STATEMENT_MAX
  const abstractHit = useMemo(() => {
    const lower = statement.toLowerCase()
    return ABSTRACT_WORDS.find((w) => new RegExp(`\\b${w}\\w*\\b`, 'i').test(lower))
  }, [statement])

  const minSec = season?.application_video_min_seconds ?? 0
  const maxSec = season?.application_video_max_seconds ?? 0
  const durationValid =
    !!season &&
    typeof videoDuration === 'number' &&
    videoDuration >= minSec &&
    videoDuration <= maxSec

  const allAgreed = agreeRules && agreePrivacy && agreeIntegrity

  const canSubmit =
    !!user &&
    !!season &&
    (mode === 'open' || mode === 'waitlist') &&
    !!platform &&
    durationValid &&
    !!aiService &&
    statementValid &&
    name.trim().length > 0 &&
    allAgreed &&
    !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !user || !season) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          creator_name: name.trim(),
          country: country.trim() || null,
          channel_url: channelUrl.trim() || null,
          free_entry_url: videoUrl.trim(),
          video_duration_seconds: videoDuration,
          ai_service: aiService,
          creator_statement: statement.trim(),
          agreed_to_rules: agreeRules,
          agreed_to_privacy: agreePrivacy,
          agreed_to_integrity_notice: agreeIntegrity,
          season_id: season.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setSubmitted(true)
        setSubmittedStatus(data.status === 'waitlist' ? 'waitlist' : 'pending')
      } else {
        const code: ApplyErrorCode | undefined =
          typeof data.error === 'string' ? (data.error as ApplyErrorCode) : undefined
        // Session expired between page load and submit → bounce to login.
        if (code === 'unauthenticated') {
          setLoading(false)
          router.push('/login?redirect=/apply')
          return
        }
        const errorMap: Record<ApplyErrorCode, string> = {
          missing_field: t.profile.apply_err_missing_field,
          agreements_required: t.profile.apply_err_agreements_required,
          statement_length: t.profile.apply_err_statement_length,
          duration_range: t.profile.apply_err_duration_range(minSec, maxSec),
          season_not_found: t.profile.apply_err_season_not_found,
          season_closed: t.profile.apply_err_season_closed,
          // 23505 on UNIQUE(season_id, user_id) or (season_id, email) — already
          // applied this season. Reuses the existing i18n string for now.
          already_applied_this_season: t.profile.apply_err_duplicate_email,
          unauthenticated: t.profile.apply_err_server_error, // unreachable (handled above)
          // Reachable only if membership lapses between page load and submit
          // (the gate screen otherwise precedes the form).
          membership_required: t.profile.apply_err_membership_required,
          server_error: t.profile.apply_err_server_error,
        }
        setError(code && errorMap[code] ? errorMap[code] : t.profile.apply_err_server_error)
      }
    } catch (err) {
      console.error('[apply] submit failed:', err)
      setError(t.profile.apply_err_server_error)
    }
    setLoading(false)
  }

  if (mode === 'loading') {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/60">Checking application status…</p>
      </main>
    )
  }

  if (mode === 'closed') {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)]">⏱</div>
          <h1 className="text-3xl font-black mb-3">
            {season?.name ?? 'GENESIS'} — Applications Closed
          </h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            The application period has ended. Sign up for notifications about the next season.
          </p>
          <Link href="/" className="text-white/40 text-sm hover:text-white/70">← Back to Home</Link>
        </div>
      </main>
    )
  }

  // Unauthenticated visitor -> intro + sign-in CTA (returns here after login).
  // Studio messaging only when the studio funnel is active (session6 ON).
  if (!user) {
    return <IntroScreen seasonName={season?.name ?? 'GENESIS'} studio={studioApplication} />
  }

  // P3 membership gate. Only when the switch is ON and configured as required
  // (membership?.gateActive) AND the user is not already an active creator. In
  // season-0 dark launch gateActive is false, so this never renders. Precedes
  // BOTH the studio funnel and the external form (a prerequisite to applying).
  if (membership?.gateActive && !membership.isActiveCreator) {
    return (
      <MembershipGateScreen
        seasonName={season?.name ?? 'GENESIS'}
        founding={membership.founding}
        onClaimed={() => setReloadKey((k) => k + 1)}
      />
    )
  }

  // Studio-based application round (session6 ON) -> funnel into /studio.
  if (studioApplication) {
    return <FunnelScreen email={user.email} season={season} mode={mode} count={count} />
  }

  if (submitted) {
    const isWait = submittedStatus === 'waitlist'
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)]">
            {isWait ? '⏳' : '✦'}
          </div>
          <h1 className="text-3xl font-black mb-3">
            {isWait ? 'Waitlist Joined' : 'Application Received'}
          </h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            {isWait
              ? `${season?.name ?? 'This season'} reached its capacity. You're on the waitlist — we'll notify you if a spot opens, or when the next season begins.`
              : `Thank you for applying to ${season?.name ?? 'GENESIS'}. We will review your entry and notify you by email.`}
          </p>
          <div className="flex flex-col gap-3 items-center">
            <a
              href="/profile"
              className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-6 py-3 font-bold text-white hover:brightness-110"
            >
              Go to Profile
            </a>
            <Link href="/" className="text-white/40 text-sm hover:text-white/70">← Back to Home</Link>
          </div>
        </div>
      </main>
    )
  }

  const aiModelText = season ? formatAiModelList(season.ai_models) : ''
  const isWaitlistMode = mode === 'waitlist'

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex h-20 items-center justify-between px-6 md:px-12 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/oxxovo_logo.png"
            alt="OXXOVO"
            className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]"
          />
          <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </Link>
        <span className="text-sm text-white/60 max-md:hidden">
          Signed in as <span className="text-white/80">{user?.email}</span>
        </span>
      </header>

      <section className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {season?.name ?? 'GENESIS Tournament'}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3">
            {isWaitlistMode ? 'Join the Waitlist' : `Apply to ${season?.name ?? 'GENESIS'}`}
          </h1>
          {isWaitlistMode ? (
            <p className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
              {season?.name} reached its capacity of {season?.max_applicants} applicants. Submit your entry to join the waitlist — you&apos;ll be promoted if a spot opens, or get priority access to the next season.
            </p>
          ) : (
            <p className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
              Submit your AI-generated video. {season ? formatPanelLabel(season.ai_models) : 'AI'} scoring by
              <span className="text-white/70"> {aiModelText}</span>.
            </p>
          )}
          {!isWaitlistMode && season && (
            <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/80">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b66cff]" />
              Application #{count + 1} of {season.max_applicants}
            </p>
          )}
          {isWaitlistMode && (
            <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400/90">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Capacity full — waitlist mode
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ① Video Details
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Video URL (YouTube / Vimeo)</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                {videoUrl && !platform && (
                  <p className="text-amber-400 text-xs mt-1.5">
                    Only YouTube or Vimeo URLs are accepted.
                  </p>
                )}
                {platform && (
                  <p className="text-[#b66cff] text-xs mt-1.5">
                    ✓ {formatVideoPlatforms([platform])} URL detected
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Video Duration (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={videoDuration}
                  onChange={(e) => {
                    const v = e.target.value
                    setVideoDuration(v === '' ? '' : Number(v))
                  }}
                  placeholder={`e.g. ${Math.round((minSec + maxSec) / 2)}`}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                <p className="text-white/40 text-xs mt-1.5">
                  Required: <span className="text-white/70">{minSec}–{maxSec} seconds</span>. Entries outside this range will be rejected during review.
                </p>
                {videoDuration !== '' && !durationValid && (
                  <p className="text-amber-400 text-xs mt-1">
                    Duration must be between {minSec} and {maxSec} seconds.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">AI Service</label>
                <select
                  value={aiService}
                  onChange={(e) => setAiService(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-[#8b22ff] transition"
                >
                  <option value="" className="bg-[#0a0812]">Select the AI service used…</option>
                  {AI_SERVICES.map((s) => (
                    <option key={s} value={s} className="bg-[#0a0812]">{s}</option>
                  ))}
                </select>
                <p className="text-white/40 text-xs mt-1.5">
                  Watermarks from Sora, Veo, and Runway are recognized as AI authenticity signals.
                </p>
              </div>

              <div>
                <label className="flex justify-between items-baseline text-sm text-white/60 mb-1.5">
                  <span>Creator Statement</span>
                  <span
                    className={
                      statementValid
                        ? 'text-[#b66cff] text-xs'
                        : statementLen > STATEMENT_MAX
                        ? 'text-red-400 text-xs'
                        : 'text-white/40 text-xs'
                    }
                  >
                    {statementLen} / {STATEMENT_MIN}–{STATEMENT_MAX}
                  </span>
                </label>
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  required
                  rows={5}
                  placeholder="A timelapse video of mansion restoration in cinematic style."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition resize-none"
                />
                <div className="text-xs text-white/40 mt-2 space-y-1">
                  <p>
                    <span className="text-[#b66cff]">✓</span> &ldquo;A timelapse video of mansion restoration in cinematic style&rdquo;
                  </p>
                  <p>
                    <span className="text-red-400/80">✕</span> &ldquo;An experimental exploration of decay and time&rdquo;
                  </p>
                </div>
                {abstractHit && (
                  <p className="text-amber-400 text-xs mt-3 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2">
                    Heads up — &ldquo;{abstractHit}&rdquo; tends to score low on <span className="font-bold">Intent</span>.
                    Describe what is actually on screen (subject, action, style).
                  </p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ② Applicant Info
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Name <span className="text-white/30">(Korean or English)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Country <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. South Korea, USA, Japan"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Channel URL <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="YouTube / Instagram / TikTok channel link"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                <p className="text-white/40 text-xs mt-1.5">
                  Your creator channel (used for verification if you advance to the finalist round).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ③ Agreements
            </h2>
            <div className="space-y-4 text-sm text-white/70">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <a href="/rules" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                    Tournament Rules
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeIntegrity}
                  onChange={(e) => setAgreeIntegrity(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I understand that my entry undergoes <span className="text-white/90">AI integrity verification</span>. Manipulating watermarks or misrepresenting the AI service used may result in disqualification.
                </span>
              </label>
            </div>
          </section>

          {error && (
            <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition"
            >
              {loading
                ? 'Submitting…'
                : isWaitlistMode
                ? 'Join Waitlist'
                : 'Submit Application'}
            </button>
            {!canSubmit && !loading && (
              <p className="text-center text-xs text-white/40 mt-3">
                Complete all required fields and agreements to submit.
              </p>
            )}
          </div>
        </form>

        <p className="text-center text-white/30 text-xs mt-16">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
        </p>
        <p className="text-center text-white/30 text-xs mt-1">
          {formatFooterStatusLine()}
        </p>
      </section>
    </main>
  )
}

function ApplyHeader({ email }: { email?: string }) {
  return (
    <header className="flex h-20 items-center justify-between px-6 md:px-12 border-b border-white/10">
      <a href="/" className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/oxxovo_logo.png" alt="OXXOVO" className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]" />
        <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
      </a>
      {email && (
        <span className="text-sm text-white/60 max-md:hidden">
          Signed in as <span className="text-white/80">{email}</span>
        </span>
      )}
    </header>
  )
}

// Unauthenticated entry screen: a short intro + sign-in CTA. After sign-in the
// user returns to /apply (now authenticated) and sees the studio funnel.
function IntroScreen({ seasonName, studio }: { seasonName: string; studio: boolean }) {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader />
      <section className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          {seasonName}
        </p>
        <h1 className="text-4xl font-black mb-4">Apply to {seasonName}</h1>
        <p className="text-white/55 leading-relaxed mb-8">
          {studio
            ? 'This season you create and submit your entry inside OXXOVO Studio — no external uploads. Sign in to get started; your first submission registers your application.'
            : 'Sign in to submit your application.'}
        </p>
        <a
          href="/login?redirect=/apply"
          className="inline-block w-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 transition"
        >
          Sign in to apply
        </a>
        <p className="text-white/40 text-sm mt-5">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-[#8b22ff] hover:underline">Sign up</a>
        </p>
      </section>
    </main>
  )
}

// Membership gate: shown to an authenticated non-creator when the apply gate is
// active. Founding window open -> free claim CTA; full -> paid path placeholder
// (P4, not yet purchasable). Signup tone. Price is intentionally NOT shown here
// (no hardcode; the priced paid flow arrives with P4).
function MembershipGateScreen({
  seasonName,
  founding,
  onClaimed,
}: {
  seasonName: string
  founding: ApplyMembershipState['founding']
  onClaimed: () => void
}) {
  const [claiming, setClaiming] = useState(false)
  const [claimErr, setClaimErr] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subErr, setSubErr] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  async function handleSubscribe() {
    setSubscribing(true)
    setSubErr('')
    try {
      const r = await startMembershipCheckout()
      if (r.ok) {
        window.location.href = r.url // off to Stripe Checkout
        return
      }
      setSubErr(
        r.reason === 'not_configured'
          ? 'Memberships are not open yet. Please check back soon.'
          : 'We could not start checkout. Please try again.',
      )
    } catch {
      setSubErr('We could not start checkout. Please try again.')
    } finally {
      setSubscribing(false)
    }
  }

  async function handleClaim() {
    setClaiming(true)
    setClaimErr('')
    try {
      const r = await claimFoundingForCurrentUser()
      // Success / terminal-reload outcomes: re-read state. 'claimed' &
      // 'already_*' advance to the form; 'quota_full'/'disabled' re-render this
      // screen in the right mode.
      if (
        r.outcome === 'claimed' ||
        r.outcome === 'already_founding' ||
        r.outcome === 'already_creator' ||
        r.outcome === 'quota_full' ||
        r.outcome === 'disabled'
      ) {
        onClaimed()
        return
      }
      setClaimErr('We could not start your membership. Please try again.')
    } catch {
      setClaimErr('We could not start your membership. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader />
      <section className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          {seasonName}
        </p>

        {founding.open ? (
          <>
            <h1 className="text-4xl font-black mb-4">Become a Creator</h1>
            <p className="text-white/55 leading-relaxed mb-2">
              Applying to {seasonName} requires a creator membership. You qualify for a{' '}
              <span className="text-white/90 font-bold">Founding Creator</span> spot — free for one year.
            </p>
            <p className="mb-8 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b66cff]" />
              Founding Creator #{founding.claimed + 1} of {founding.cap}
            </p>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="block w-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {claiming ? 'Activating…' : 'Start free — claim my Founding spot'}
            </button>
            <p className="text-white/40 text-xs mt-4 leading-relaxed">
              Free for 12 months. Renews automatically afterward unless cancelled — we&apos;ll remind you before it does. See the{' '}
              <a href="/terms" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                Membership Terms
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-black mb-4">Creator Membership</h1>
            <p className="text-white/55 leading-relaxed mb-6">
              All Founding Creator spots have been claimed. Activate a creator membership to apply to {seasonName}.
            </p>
            <label className="flex items-start gap-3 text-left text-sm text-white/70 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                  Membership Terms &amp; Refund Policy
                </a>
                . This membership auto-renews each period until cancelled, and payments are non-refundable.
              </span>
            </label>
            <button
              onClick={handleSubscribe}
              disabled={subscribing || !agreeTerms}
              className="block w-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {subscribing ? 'Opening checkout…' : 'Subscribe to Creator Membership'}
            </button>
            <p className="text-white/40 text-xs mt-4 leading-relaxed">
              Billed monthly. Cancel anytime in your profile — access continues until the end of the paid period. Payments are non-refundable.
            </p>
            {subErr && (
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mt-6">
                {subErr}
              </p>
            )}
            <Link href="/" className="inline-block text-white/40 text-sm hover:text-white/70 mt-6">
              ← Back to Home
            </Link>
          </>
        )}

        {claimErr && (
          <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mt-6">
            {claimErr}
          </p>
        )}
      </section>
    </main>
  )
}

// Authenticated funnel: explain the studio flow and send the user into /studio.
function FunnelScreen({
  email,
  season,
  mode,
  count,
}: {
  email: string
  season: Season | null
  mode: Mode
  count: number
}) {
  const isWait = mode === 'waitlist'
  const name = season?.name ?? 'GENESIS'
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader email={email} />
      <section className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {name}
          </p>
          <h1 className="text-4xl font-black mb-3">
            {isWait ? 'Join the Waitlist' : `Apply via Studio`}
          </h1>
          <p className="text-white/55 leading-relaxed">
            {isWait
              ? `${name} reached its capacity${season ? ` of ${season.max_applicants}` : ''}. You can still generate in Studio; submitting joins the waitlist.`
              : 'This season runs entirely inside OXXOVO Studio. Generate your video here and submit it directly — no external links.'}
          </p>
        </div>

        <ol className="space-y-3 mb-10">
          {[
            'Pick a model tier and describe your video.',
            'Generate, preview, and re-generate until you are happy.',
            'Submit — your first submission registers your application.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[.02] px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8b22ff]/20 text-[#b66cff] text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-white/75">{step}</span>
            </li>
          ))}
        </ol>

        {!isWait && season && (
          <p className="text-center mb-5 inline-flex w-full items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b66cff]" />
            Application #{count + 1} of {season.max_applicants}
          </p>
        )}

        <a
          href="/studio"
          className="block text-center w-full bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 transition"
        >
          Open Studio →
        </a>
      </section>
    </main>
  )
}
