'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getCurrentSeason,
  getActiveApplicationCount,
  isApplicationClosed,
  isBeforeApplicationOpen,
  isRegistrationClosed,
  isCapacityFull,
  formatAiModelList,
  formatPanelLabel,
  formatDeadlinePT,
  type Season,
} from '@/lib/seasons'
import {
  acceptsExternalUrl,
  formatVideoPlatforms,
  formatVideoUrlPlaceholder,
  validateVideoUrl,
} from '@/lib/video-url'
import { useT } from '@/lib/admin-i18n'
import type { ApplyErrorCode } from '@/app/api/apply/route'
import { getSessionUser } from '@/app/_actions/auth'
import { formatFooterStatusLine } from '@/lib/ip-info'
import {
  getStudioApplicationFlag,
  getApplyMembershipState,
  claimFoundingForCurrentUser,
  startMembershipCheckout,
  getMyRegistrationStatus,
  registerForSeasonAction,
} from './actions'
import type { ApplyMembershipState, MyRegistrationStatus } from './types'
import type { ApplicantInfo } from '@/lib/studio'

const AI_SERVICES = ['Sora', 'Veo', 'Runway', 'Kling', 'Pika', 'Other']
const ABSTRACT_WORDS = [
  'explor', 'surreal', 'experimental', 'abstract', 'ethereal',
  'transcendent', 'liminal', 'ineffable', 'journey', 'evocative',
]
const STATEMENT_MIN = 150
const STATEMENT_MAX = 250
// Public, creator-authored video title + description (shown on Watch; separate
// from the graded creator_statement).
const TITLE_MAX = 100
const DESCRIPTION_MAX = 600

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
  // Registration state (HQ 2026-08-12) -- distinct from `submitted` below,
  // which is the EXTERNAL-URL form's own one-shot flag. null while loading,
  // so the funnel does not flash the registration form before this resolves.
  const [registrationStatus, setRegistrationStatus] = useState<MyRegistrationStatus | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoDescription, setVideoDescription] = useState('')
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
      // Pre-launch guard: before the application window opens, never show the
      // form. The server route already 403s an early submit; this keeps the UI
      // consistent with the home CTA (which points to /pre-register before open).
      if (isBeforeApplicationOpen(s)) {
        router.push('/pre-register')
        return
      }

      setSeason(s)
      getStudioApplicationFlag(s.id).then(setStudioApplication)

      // P3 membership gate state. When the switch is off (season-0 dark launch)
      // gateActive is false and the flow is unchanged.
      getApplyMembershipState().then(setMembership)

      // Has this user already registered/submitted? (HQ 2026-08-12 -- drives
      // whether FunnelScreen shows the registration form, a "you're
      // registered" card, or an "already submitted" card.)
      getMyRegistrationStatus(s.id).then(setRegistrationStatus)

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

  // ★The allowed sources come from the season row, never from a constant here.
  // This page used to carry its own ['youtube','vimeo'] list, which meant
  // "what may a prelim entry be?" had two answers: the DB (per season) and the
  // code (fixed). The day they disagreed arrived when season_0 became ['studio']
  // — the screen said the URL was fine and the server rejected it. One column,
  // one answer ([[feedback-no-hardcode]]).
  const allowedPlatforms = season?.allowed_video_platforms ?? []
  const allowedLabel = formatVideoPlatforms(allowedPlatforms)
  const platform = useMemo(() => {
    const v = validateVideoUrl(videoUrl, allowedPlatforms)
    return v.valid ? v.platform : null
    // allowedPlatforms is a fresh array each render; the season row is what
    // actually changes, so key the memo on that.
  }, [videoUrl, season?.allowed_video_platforms])
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
    videoTitle.trim().length > 0 &&
    videoTitle.length <= TITLE_MAX &&
    videoDescription.trim().length > 0 &&
    videoDescription.length <= DESCRIPTION_MAX &&
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
          video_title: videoTitle.trim(),
          video_description: videoDescription.trim(),
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
          // Near-unreachable: the inputs enforce maxLength client-side. Brief
          // literals avoid adding i18n keys for a defense-in-depth check.
          title_length: 'Title is too long.',
          description_length: 'Description is too long.',
          duration_range: t.profile.apply_err_duration_range(minSec, maxSec),
          // Near-unreachable by design: when the season allows no external
          // platform this page does not render a URL field at all. Kept because
          // the server gate is the one that decides, and a client that got here
          // anyway (stale tab, changed column) must be told the truth.
          video_platform_not_allowed:
            t.profile.apply_err_video_platform_not_allowed(allowedLabel),
          season_not_found: t.profile.apply_err_season_not_found,
          season_not_open: t.profile.apply_err_season_not_open,
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

  // Registration-only submit (HQ 2026-08-12) -- mints the row with no video.
  // Reuses the same name/statement/agreement fields as the external-URL form
  // above (a season is either studio-based or external, never both, so the
  // shared state never actually collides between the two forms).
  const canRegister =
    !!user &&
    !!season &&
    registrationStatus?.status === 'none' &&
    !isRegistrationClosed(season) &&
    name.trim().length > 0 &&
    statementValid &&
    allAgreed &&
    !registering

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canRegister || !season) return
    setRegistering(true)
    setRegisterError('')
    try {
      const applicant: ApplicantInfo = {
        creatorName: name.trim(),
        creatorStatement: statement.trim(),
        country: country.trim() || undefined,
        channelUrl: channelUrl.trim() || undefined,
        agreedRules: agreeRules,
        agreedPrivacy: agreePrivacy,
        agreedIntegrity: agreeIntegrity,
      }
      const res = await registerForSeasonAction(season.id, applicant)
      if (res.ok) {
        setRegistrationStatus({ status: 'registered', entryStatus: res.status })
      } else if (res.reason === 'membership_required') {
        // The membership state the page loaded with is stale (lapsed since).
        // Re-fetching membership re-renders MembershipGateScreen, which
        // already explains why and shows the Founding/paid path -- no
        // separate error message needed here.
        setReloadKey((k) => k + 1)
      } else {
        const registerErrorMap: Partial<Record<typeof res.reason, string>> = {
          registration_closed: 'Registration has closed for this season.',
          already_registered: 'You have already registered for this season.',
          bad_statement: t.profile.apply_err_statement_length,
          agreements_required: t.profile.apply_err_agreements_required,
        }
        setRegisterError(registerErrorMap[res.reason] ?? t.profile.apply_err_server_error)
      }
    } catch (err) {
      console.error('[apply] register failed:', err)
      setRegisterError(t.profile.apply_err_server_error)
    }
    setRegistering(false)
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
            {season?.name ?? 'OXXOVO'} — Applications Closed
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
    return <IntroScreen seasonName={season?.name ?? 'OXXOVO'} studio={studioApplication} closeDate={formatDeadlinePT(season?.application_close_at)} />
  }

  // P3 membership gate. Only when the switch is ON and configured as required
  // (membership?.gateActive) AND the user is not already an active creator. In
  // season-0 dark launch gateActive is false, so this never renders. Precedes
  // BOTH the studio funnel and the external form (a prerequisite to applying).
  if (membership?.gateActive && !membership.isActiveCreator) {
    return (
      <MembershipGateScreen
        seasonName={season?.name ?? 'OXXOVO'}
        founding={membership.founding}
        onClaimed={() => setReloadKey((k) => k + 1)}
      />
    )
  }

  // Studio-based application round (session6 ON) -> funnel into /studio.
  if (studioApplication) {
    if (!registrationStatus) {
      // Still resolving getMyRegistrationStatus -- avoid flashing the
      // registration form before the page knows whether one is needed.
      return (
        <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
          <p className="text-white/60">Checking registration status…</p>
        </main>
      )
    }
    return (
      <FunnelScreen
        email={user.email}
        season={season}
        mode={mode}
        count={count}
        registrationStatus={registrationStatus}
        name={name}
        setName={setName}
        country={country}
        setCountry={setCountry}
        channelUrl={channelUrl}
        setChannelUrl={setChannelUrl}
        statement={statement}
        setStatement={setStatement}
        statementLen={statementLen}
        statementValid={statementValid}
        abstractHit={abstractHit}
        agreeRules={agreeRules}
        setAgreeRules={setAgreeRules}
        agreePrivacy={agreePrivacy}
        setAgreePrivacy={setAgreePrivacy}
        agreeIntegrity={agreeIntegrity}
        setAgreeIntegrity={setAgreeIntegrity}
        canRegister={canRegister}
        registering={registering}
        registerError={registerError}
        handleRegister={handleRegister}
      />
    )
  }

  // ★The season accepts no external video URL (allowed_video_platforms carries
  // no parseable platform — season_0 is ['studio']). The form below would be a
  // form the server always 403s: every field fillable, submit rejected at the
  // end. Blocking is the server's job and this is the UX half of it — both are
  // required, and both read the same column.
  //
  // Reaching here also means the studio funnel above did NOT fire, so there is
  // no path from this page at all. The copy therefore promises nothing: no date,
  // no "check back", and no /studio link (with session6 off that door is shut
  // too, and two closed doors is worse than one honest one).
  if (!acceptsExternalUrl(season?.allowed_video_platforms)) {
    return <NoExternalEntryScreen email={user.email} seasonName={season?.name ?? 'OXXOVO'} />
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
              : `Thank you for applying to ${season?.name ?? 'OXXOVO'}. We will review your entry and notify you by email.`}
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
            {isWaitlistMode ? 'Join the Waitlist' : `Apply to ${season?.name ?? 'OXXOVO'}`}
          </h1>
          {isWaitlistMode ? (
            <>
              <p className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                This season&apos;s field is full. The next season&apos;s schedule will be posted here when it&apos;s set.
              </p>
              <p className="text-white/35 text-sm md:text-base max-w-md mx-auto leading-relaxed mt-1" lang="ko">
                이번 시즌은 정원이 찼습니다. 다음 시즌 일정은 공개되는 대로 이 페이지에 안내됩니다.
              </p>
            </>
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
          {!isWaitlistMode && formatDeadlinePT(season?.application_close_at) && (
            <p className="mt-2 text-[11px] text-white/40">
              Applications close {formatDeadlinePT(season?.application_close_at)}
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
                <label className="block text-sm text-white/60 mb-1.5">Video URL ({allowedLabel})</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={formatVideoUrlPlaceholder(allowedPlatforms)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                {videoUrl && !platform && (
                  <p className="text-amber-400 text-xs mt-1.5">
                    Only {allowedLabel} URLs are accepted.
                  </p>
                )}
                {platform && (
                  <p className="text-[#b66cff] text-xs mt-1.5">
                    ✓ {formatVideoPlatforms([platform])} URL detected
                  </p>
                )}
              </div>

              <div>
                <label className="flex justify-between items-baseline text-sm text-white/60 mb-1.5">
                  <span>Video Title</span>
                  <span className={videoTitle.length > TITLE_MAX ? 'text-red-400 text-xs' : 'text-white/40 text-xs'}>
                    {videoTitle.length} / {TITLE_MAX}
                  </span>
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  maxLength={TITLE_MAX}
                  required
                  placeholder="Give your video a title"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                <p className="text-xs text-white/40 mt-1.5">Shown on Watch as the video&apos;s title.</p>
              </div>

              <div>
                <label className="flex justify-between items-baseline text-sm text-white/60 mb-1.5">
                  <span>Video Description</span>
                  <span className={videoDescription.length > DESCRIPTION_MAX ? 'text-red-400 text-xs' : 'text-white/40 text-xs'}>
                    {videoDescription.length} / {DESCRIPTION_MAX}
                  </span>
                </label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  required
                  rows={4}
                  placeholder="Tell viewers about your video — the idea, the story, how you made it."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition resize-none"
                />
                <p className="text-xs text-white/40 mt-1.5">
                  Your public intro on Watch. Separate from the Creator Statement below (used for scoring).
                </p>
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

// The season takes no external video link and the studio funnel is not
// available either, so this page has nothing to offer. It says exactly that and
// stops. Deliberately absent: a date, a "soon", and a /studio link — none of the
// three is true here, and [[project-message-policy]] rules out asserting what we
// cannot guarantee. The season name comes from the row, not from a literal.
function NoExternalEntryScreen({ email, seasonName }: { email: string; seasonName: string }) {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader email={email} />
      <section className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          {seasonName}
        </p>
        <h1 className="text-3xl md:text-4xl font-black mb-4">Entries are not accepted on this page</h1>
        <p className="text-white/55 leading-relaxed mb-8">
          {seasonName} does not accept external video links.
        </p>
        <Link href="/" className="text-white/40 text-sm hover:text-white/70">← Back to Home</Link>
      </section>
    </main>
  )
}

// Unauthenticated entry screen: a short intro + sign-in CTA. After sign-in the
// user returns to /apply (now authenticated) and sees the studio funnel.
function IntroScreen({ seasonName, studio, closeDate }: { seasonName: string; studio: boolean; closeDate: string | null }) {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader />
      <section className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          {seasonName}
        </p>
        <h1 className="text-4xl font-black mb-4">Apply to {seasonName}</h1>
        {closeDate && (
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-4">
            Applications close {closeDate}
          </p>
        )}
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
  registrationStatus,
  name,
  setName,
  country,
  setCountry,
  channelUrl,
  setChannelUrl,
  statement,
  setStatement,
  statementLen,
  statementValid,
  abstractHit,
  agreeRules,
  setAgreeRules,
  agreePrivacy,
  setAgreePrivacy,
  agreeIntegrity,
  setAgreeIntegrity,
  canRegister,
  registering,
  registerError,
  handleRegister,
}: {
  email: string
  season: Season | null
  mode: Mode
  count: number
  registrationStatus: MyRegistrationStatus
  name: string
  setName: (v: string) => void
  country: string
  setCountry: (v: string) => void
  channelUrl: string
  setChannelUrl: (v: string) => void
  statement: string
  setStatement: (v: string) => void
  statementLen: number
  statementValid: boolean
  abstractHit: string | undefined
  agreeRules: boolean
  setAgreeRules: (v: boolean) => void
  agreePrivacy: boolean
  setAgreePrivacy: (v: boolean) => void
  agreeIntegrity: boolean
  setAgreeIntegrity: (v: boolean) => void
  canRegister: boolean
  registering: boolean
  registerError: string
  handleRegister: (e: React.FormEvent) => void
}) {
  const isWait = mode === 'waitlist'
  const seasonName = season?.name ?? 'OXXOVO'
  const submissionDeadline = formatDeadlinePT(season?.application_close_at)
  const registrationDeadline = formatDeadlinePT(season?.registration_close_at)
  const registrationClosedNow = !!season && isRegistrationClosed(season)

  // Already submitted -- nothing left to do on this page.
  if (registrationStatus.status === 'submitted') {
    return (
      <main className="min-h-screen bg-[#030305] text-white">
        <ApplyHeader email={email} />
        <section className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {seasonName}
          </p>
          <h1 className="text-3xl md:text-4xl font-black mb-4">Already Submitted</h1>
          <p className="text-white/55 leading-relaxed mb-8">
            You have already submitted your entry for {seasonName}. We will notify you by email.
          </p>
          <a href="/profile" className="inline-block text-[#8b22ff] text-sm hover:underline">
            Go to Profile
          </a>
        </section>
      </main>
    )
  }

  // Already registered -- no register button (HQ 2026-08-12 ①: showing it
  // again invites a duplicate). Points at Studio and says what's next.
  if (registrationStatus.status === 'registered') {
    const waitlisted = registrationStatus.entryStatus === 'waitlist'
    return (
      <main className="min-h-screen bg-[#030305] text-white">
        <ApplyHeader email={email} />
        <section className="max-w-xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
              <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
              {seasonName}
            </p>
            <h1 className="text-4xl font-black mb-3">
              {waitlisted ? "You're on the Waitlist" : "You're Registered"}
            </h1>
            {waitlisted ? (
              <>
                <p className="text-white/55 leading-relaxed">
                  This season&apos;s field is full. The next season&apos;s schedule will be posted here when it&apos;s set.
                </p>
                <p className="text-white/40 leading-relaxed mt-1" lang="ko">
                  이번 시즌은 정원이 찼습니다. 다음 시즌 일정은 공개되는 대로 이 페이지에 안내됩니다.
                </p>
              </>
            ) : (
              <p className="text-white/55 leading-relaxed">
                Your spot is reserved. Create and submit your video in Studio before the submission deadline.
              </p>
            )}
          </div>

          {submissionDeadline && (
            <p className="text-center mb-2 text-[11px] uppercase tracking-[0.16em] text-white/40">
              Submission deadline: {submissionDeadline}
            </p>
          )}
          {registrationDeadline && (
            <p className="text-center mb-8 text-[11px] text-white/30">
              (New registration for this season closed {registrationDeadline})
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

  // registrationStatus.status === 'none' from here down.
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <ApplyHeader email={email} />
      <section className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {seasonName}
          </p>
          <h1 className="text-4xl font-black mb-3">
            {registrationClosedNow ? 'Registration Closed' : isWait ? 'Join the Waitlist' : `Apply via Studio`}
          </h1>
          <p className="text-white/55 leading-relaxed">
            {registrationClosedNow
              ? `Registration for ${seasonName} has closed.`
              : isWait
              ? `${seasonName} reached its capacity${season ? ` of ${season.max_applicants}` : ''}. Registering joins the waitlist.`
              : 'This season runs entirely inside OXXOVO Studio. Register to reserve your spot, then generate and submit your video.'}
          </p>
        </div>

        {registrationClosedNow ? (
          <p className="text-center text-white/40 text-sm">
            <Link href="/" className="text-[#8b22ff] hover:underline">← Back to Home</Link>
          </p>
        ) : (
          <>
            <ol className="space-y-3 mb-10">
              {[
                'Register below to reserve your spot.',
                'Pick a model tier, generate, preview, and re-generate until you are happy.',
                `Submit in Studio${submissionDeadline ? ` by ${submissionDeadline}` : ''}.`,
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

            <form onSubmit={handleRegister} className="space-y-5 mb-8 rounded-lg border border-white/10 bg-white/[.02] p-5">
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
              </div>
              <div>
                <label className="flex justify-between items-baseline text-sm text-white/60 mb-1.5">
                  <span>Creator Statement</span>
                  <span
                    className={
                      statementValid
                        ? 'text-[#b66cff] text-xs'
                        : statementLen > 250
                        ? 'text-red-400 text-xs'
                        : 'text-white/40 text-xs'
                    }
                  >
                    {statementLen} / 150–250
                  </span>
                </label>
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  required
                  rows={4}
                  placeholder="A timelapse video of mansion restoration in cinematic style."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition resize-none"
                />
                {abstractHit && (
                  <p className="text-amber-400 text-xs mt-3 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2">
                    Heads up — &ldquo;{abstractHit}&rdquo; tends to score low on <span className="font-bold">Intent</span>.
                    Describe what is actually on screen (subject, action, style).
                  </p>
                )}
              </div>
              <div className="space-y-3 text-sm text-white/70">
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
                    I understand that my entry undergoes <span className="text-white/90">AI integrity verification</span>.
                  </span>
                </label>
              </div>

              {registerError && (
                <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  {registerError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canRegister}
                className="w-full bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition"
              >
                {registering ? 'Registering…' : isWait ? 'Join Waitlist' : 'Register'}
              </button>
            </form>

            <p className="text-center text-white/30 text-xs mb-3">or</p>

            <a
              href="/studio"
              className="block text-center w-full border border-white/15 py-4 rounded-lg font-bold text-white/80 hover:border-[#8b22ff]/50 hover:text-white transition"
            >
              Skip ahead — Open Studio →
            </a>
            <p className="text-center text-white/30 text-xs mt-3">
              Your first submission in Studio registers you automatically, as long as it&apos;s before registration closes.
            </p>
          </>
        )}
      </section>
    </main>
  )
}
