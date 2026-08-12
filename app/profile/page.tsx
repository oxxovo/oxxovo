'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useT, useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { VideoEmbed } from '@/app/_components/VideoEmbed'
import { WinnerCelebrationCard } from './WinnerCelebrationCard'
import { SmsConsentCard } from './SmsConsentCard'
import { NicknameCard } from './NicknameCard'
import { ScoringCard } from './ScoringCard'
import { MainRoundCard, type MockOverrides } from './MainRoundCard'
import { getSeasonById, type Season } from '@/lib/seasons'
import { getStudioApplicationFlag } from '@/app/apply/actions'
import { loadSystemMessages, type SystemMessages } from '@/lib/system-messages'
import {
  loadProfileData,
  saveWinnerInfo,
  loadMembershipDashboard,
  isHostLinkVisible,
  cancelMembership,
  resumeMembership,
  type ProfileApplication,
  type ProfileData,
} from './actions'
import type { MembershipDashboard } from './membership-types'
import { HOST_LINK_HREF } from '@/lib/partner-host-link'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-white/10 text-white/70 border-white/20',
  waitlist: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  verifying: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  eligible: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  selected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  main_round_submitted: 'bg-[#8b22ff]/15 text-[#b66cff] border-[#8b22ff]/30',
  flagged: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  awarded: 'bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30',
  rejected: 'bg-white/5 text-white/40 border-white/10',
}

// Mock overrides — dev-only URL query → MockOverrides. NODE_ENV !== 'development'
// 가드로 production 번들에서 dead-code elimination됨.
function useMockOverrides(): MockOverrides | undefined {
  const params = useSearchParams()
  return useMemo(() => {
    if (process.env.NODE_ENV !== 'development') return undefined
    const status = params.get('mock_status') ?? undefined
    const themeRevealedRaw = params.get('mock_theme_revealed')
    const themeRevealed =
      themeRevealedRaw === '1' ? true : themeRevealedRaw === '0' ? false : undefined
    const closeInRaw = params.get('mock_close_in')
    const closeInSeconds = closeInRaw ? parseInt(closeInRaw, 10) : undefined
    if (!status && themeRevealed === undefined && closeInSeconds === undefined) {
      return undefined
    }
    return { status, themeRevealed, closeInSeconds }
  }, [params])
}

function ProfilePageInner() {
  const router = useRouter()
  const t = useT()
  const lang = useAdminLang()
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'unauthed'>(
    'loading',
  )
  const [data, setData] = useState<ProfileData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [messages, setMessages] = useState<SystemMessages | null>(null)
  const [season, setSeason] = useState<Season | null>(null)
  const [studioFunnel, setStudioFunnel] = useState(false)
  const [membership, setMembership] = useState<MembershipDashboard | null>(null)
  const [hostLink, setHostLink] = useState(false)
  const mockOverrides = useMockOverrides()

  // Partner host return link. Server-resolved (member_hosted_enabled AND this
  // caller is an active partner) -- see lib/partner-host-link.ts. Starts false, so
  // it can only ever appear, never flash away.
  useEffect(() => {
    let cancelled = false
    isHostLinkVisible().then((v) => {
      if (!cancelled) setHostLink(v)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Membership dashboard (P4d) — loaded independently of the application data so
  // the card shows for any creator member (incl. those with no application yet).
  // Hidden (show:false) in dark launch / for non-members.
  const reloadMembership = useCallback(() => {
    loadMembershipDashboard().then(setMembership)
  }, [])
  useEffect(() => {
    let cancelled = false
    loadMembershipDashboard().then((d) => {
      if (!cancelled) setMembership(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Identity now lives in the @supabase/ssr cookie session; loadProfileData()
  // reads it server-side, so the client just calls it once on mount. State is
  // only set inside the async callback (not synchronously in the effect body),
  // keeping the react-hooks/set-state-in-effect rule happy.
  useEffect(() => {
    let cancelled = false
    loadProfileData().then((res) => {
      if (cancelled) return
      if (res.ok) {
        setData(res.data)
        setAuthState('authed')
      } else if (res.error === 'unauthenticated') {
        setAuthState('unauthed')
      } else {
        setLoadError(res.error)
        setAuthState('authed')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // System messages — fetched once on mount, used by MainRoundCard.
  useEffect(() => {
    let cancelled = false
    loadSystemMessages().then((m) => {
      if (!cancelled) setMessages(m)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Season — fetched when the current application's season_id is known.
  const currentSeasonId = data?.applications[0]?.season_id
  useEffect(() => {
    if (!currentSeasonId) return
    let cancelled = false
    getSeasonById(currentSeasonId).then((s) => {
      if (!cancelled) setSeason(s)
    })
    // Studio funnel flag -> show a direct "Enter Studio" link for returning
    // participants (session6 on + studio application round).
    getStudioApplicationFlag(currentSeasonId)
      .then((f) => { if (!cancelled) setStudioFunnel(f) })
      .catch(() => { if (!cancelled) setStudioFunnel(false) })
    return () => {
      cancelled = true
    }
  }, [currentSeasonId])

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (authState === 'unauthed') {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex flex-col">
        <Header email={null} onLogout={handleLogout} hideLogout />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-white/70">{t.profile.auth_required}</p>
          <Link
            href="/login"
            className="rounded-lg border border-[#8b22ff]/60 px-5 py-2.5 text-sm font-bold text-[#b66cff] hover:bg-[#8b22ff]/10 transition"
          >
            {t.profile.auth_required_action}
          </Link>
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-[#ff8888]">{t.profile.loading_failed}</p>
      </main>
    )
  }

  if (authState === 'loading' || !data) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/60">{t.profile.loading}</p>
      </main>
    )
  }

  const currentApp = data.applications[0] ?? null

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <Header email={data.email} onLogout={handleLogout} />

      <section className="max-w-3xl mx-auto px-6 py-12">
        <ProfileHero email={data.email} />

        {studioFunnel && (
          <a
            href="/studio"
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.08] px-5 py-4 transition hover:bg-[#8b22ff]/[.16]"
          >
            <span className="text-sm font-semibold text-white/90">{lang === 'ko' ? 'OXXOVO Studio에서 제작·제출하기' : 'Create & submit in OXXOVO Studio'}</span>
            <span className="shrink-0 text-sm font-extrabold text-[#b66cff]">Studio →</span>
          </a>
        )}

        {/* Host return link. No new copy: the label and the action are the two
            strings /membership already uses for this tier and this right
            (col_partner / row_host), so there is nothing here to translate or to
            keep in sync with a second wording. */}
        {hostLink && (
          <a
            href={HOST_LINK_HREF}
            className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.08] px-5 py-4 transition hover:bg-[#8b22ff]/[.16]"
          >
            <span className="text-sm font-semibold text-white/90">{t.membership.col_partner}</span>
            <span className="shrink-0 text-sm font-extrabold text-[#b66cff]">
              {t.membership.row_host} →
            </span>
          </a>
        )}

        {membership?.show && (
          <MembershipCard dashboard={membership} onReload={reloadMembership} />
        )}

        <NicknameCard />

        <SmsConsentCard />

        {!currentApp ? (
          <NoApplicationCard />
        ) : (
          <>
            {currentApp.status === 'awarded' && (
              <WinnerCelebrationCard app={currentApp} />
            )}
            <StatusCard app={currentApp} />
            <ApplicationCard app={currentApp} />
            <VideoCard url={currentApp.free_entry_url} />
            {season && messages && (
              <MainRoundCard
                app={currentApp}
                season={season}
                messages={messages}
                lang={lang}
                mockOverrides={mockOverrides}
              />
            )}
            <ScoringCard />
            {currentApp.status === 'awarded' && (
              <WinnerFormCard app={currentApp} />
            )}
          </>
        )}

        <HistoryCard applications={data.applications} />
      </section>
    </main>
  )
}

// useSearchParams()(useMockOverrides 내부)는 prerender 시 CSR bailout이라 App
// Router 규약상 <Suspense> 경계 필요. 페이지 본문을 Suspense로 감싸 production
// 빌드의 missing-suspense-with-csr-bailout 에러를 해소 (로직/UI 변경 없음).
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfilePageInner />
    </Suspense>
  )
}

function ProfileFallback() {
  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
      <p className="text-white/60">…</p>
    </main>
  )
}

function Header({
  email,
  onLogout,
  hideLogout,
}: {
  email: string | null
  onLogout: () => void
  hideLogout?: boolean
}) {
  const t = useT()
  return (
    <header className="flex h-20 items-center justify-between px-12 max-md:px-6 border-b border-white/10">
      <Link href="/" className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/oxxovo_logo.png"
          alt={t.profile.header_brand}
          className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]"
        />
        <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">
          {t.profile.header_brand}
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <LangSwitch />
        {!hideLogout && email && (
          <button
            onClick={onLogout}
            className="rounded-lg border border-white/20 px-5 py-2.5 text-[14px] font-bold text-white/80 transition hover:border-[#8b22ff] hover:text-white"
          >
            {t.profile.log_out}
          </button>
        )}
      </div>
    </header>
  )
}

function LangSwitch() {
  const lang = useAdminLang()
  const cls = (active: boolean) =>
    `px-2 py-1 text-[11px] transition ${
      active ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'
    }`
  const set = (next: Lang) => setAdminLang(next)
  return (
    <div className="flex items-center border border-white/10 rounded overflow-hidden">
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

function ProfileHero({ email }: { email: string }) {
  return (
    <div className="text-center mb-10">
      <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-3xl font-black text-white mb-4 shadow-[0_0_30px_rgba(139,34,255,.5)]">
        {email.charAt(0).toUpperCase()}
      </div>
      <h1 className="text-3xl font-black mb-2">{email.split('@')[0]}</h1>
      <p className="text-white/50 text-sm">{email}</p>
    </div>
  )
}

// P4d membership dashboard card. Rendered only when dashboard.show. Reuses the
// shared <Card>. Cancel/Resume go through the server actions (Stripe period-end
// cancel); the P4c webhook is the authority, this just reloads after.
function MembershipCard({
  dashboard,
  onReload,
}: {
  dashboard: MembershipDashboard
  onReload: () => void
}) {
  const t = useT()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'

  const statusTone =
    dashboard.status === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : dashboard.status === 'past_due'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-white/5 text-white/40 border-white/10'
  const statusLabel =
    dashboard.status === 'active'
      ? t.profile.mem_status_active
      : dashboard.status === 'past_due'
        ? t.profile.mem_status_past_due
        : t.profile.mem_status_canceled

  // Expiry line — source-aware (renews / cancels / free-until).
  const expiryLine = (() => {
    const d = fmtDate(dashboard.expiresAt)
    if (dashboard.source === 'founding_free') return t.profile.mem_free_until(d)
    if (dashboard.source === 'paid') {
      return dashboard.cancelAtPeriodEnd
        ? t.profile.mem_cancels_on(d)
        : t.profile.mem_renews_on(d)
    }
    return null
  })()

  const run = async (fn: () => Promise<{ ok: boolean }>) => {
    setError(null)
    setPending(true)
    const res = await fn()
    setPending(false)
    setConfirming(false)
    if (!res.ok) {
      setError(t.profile.mem_action_err)
      return
    }
    onReload()
  }

  return (
    <Card title={t.profile.mem_section}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm font-bold text-white/90">
          {dashboard.tier === 'creator'
            ? t.profile.mem_tier_creator
            : t.profile.mem_tier_general}
        </span>
        <span
          className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${statusTone}`}
        >
          {statusLabel}
        </span>
        {dashboard.isFounding && dashboard.foundingNumber != null && (
          <span className="inline-block px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border border-[#8b22ff]/40 bg-[#8b22ff]/15 text-[#b66cff]">
            {t.profile.mem_founding_badge(dashboard.foundingNumber)}
          </span>
        )}
      </div>

      {expiryLine && <p className="text-sm text-white/70">{expiryLine}</p>}

      {dashboard.status === 'past_due' && (
        <p className="mt-3 text-xs text-amber-300/90 leading-relaxed">
          {t.profile.mem_past_due_note}
        </p>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {error}
        </div>
      )}

      {dashboard.canManageStripe && (
        <div className="mt-5 pt-4 border-t border-white/10">
          {dashboard.cancelAtPeriodEnd ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(resumeMembership)}
              className="px-4 py-2 rounded border border-[#8b22ff]/60 text-sm font-bold text-[#b66cff] hover:bg-[#8b22ff]/10 transition disabled:opacity-50"
            >
              {pending ? t.profile.mem_resuming : t.profile.mem_resume_btn}
            </button>
          ) : confirming ? (
            <div className="space-y-3">
              <p className="text-xs text-white/70 leading-relaxed">
                {t.profile.mem_cancel_confirm}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(cancelMembership)}
                  className="px-4 py-2 rounded bg-[#ff4444]/90 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-50"
                >
                  {pending ? t.profile.mem_canceling : t.profile.mem_cancel_btn}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 rounded border border-white/20 text-sm font-bold text-white/70 hover:text-white hover:border-white/40 transition disabled:opacity-50"
                >
                  {t.profile.main_round_modal_cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-4 py-2 rounded border border-white/20 text-sm font-bold text-white/60 hover:text-white hover:border-white/40 transition"
            >
              {t.profile.mem_cancel_btn}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

function NoApplicationCard() {
  const t = useT()
  return (
    <Card title={t.profile.no_application_title}>
      <p className="text-sm text-white/60 mb-4">{t.profile.no_application_body}</p>
      <a
        href="/apply"
        className="inline-block px-5 py-2.5 rounded bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white font-bold text-sm hover:brightness-110 transition"
      >
        {t.profile.no_application_cta}
      </a>
    </Card>
  )
}

function StatusCard({ app }: { app: ProfileApplication }) {
  const t = useT()
  const styleCls = STATUS_STYLES[app.status] ?? STATUS_STYLES.pending
  const messageMap: Record<string, string> = {
    pending: t.profile.status_pending_msg,
    waitlist: t.profile.status_waitlist_msg,
    verifying: t.profile.status_verifying_msg,
    eligible: t.profile.status_eligible_msg,
    selected: t.profile.status_selected_msg,
    main_round_submitted: t.profile.status_main_round_submitted_msg,
    flagged: t.profile.status_flagged_msg,
    awarded: t.profile.status_awarded_msg,
    rejected: t.profile.status_rejected_msg,
  }
  const message = messageMap[app.status] ?? ''

  return (
    <Card title={t.profile.section_status} accent={app.status === 'awarded'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <span
          className={`inline-block px-3 py-1 rounded text-xs uppercase tracking-wider font-bold border ${styleCls}`}
        >
          {app.status}
        </span>
        <span className="text-xs text-white/40">
          {t.profile.label_season}:{' '}
          {t.profile.history_season_card(app.season_number, app.season_name)}
        </span>
      </div>
      <p className="text-sm text-white/80 leading-relaxed">{message}</p>
    </Card>
  )
}

function ApplicationCard({ app }: { app: ProfileApplication }) {
  const t = useT()
  return (
    <Card title={t.profile.section_my_application}>
      <div className="space-y-3">
        <FieldRow label={t.profile.label_creator_name} value={app.creator_name} />
        <FieldRow label={t.profile.label_country} value={app.country ?? '—'} />
        <FieldRow
          label={t.profile.label_channel}
          value={
            app.channel_url ? (
              <a
                href={app.channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#b66cff] hover:underline break-all"
              >
                {app.channel_url}
              </a>
            ) : (
              '—'
            )
          }
        />
        <FieldRow label={t.profile.label_ai_service} value={app.ai_service ?? '—'} />
        <FieldRow
          label={t.profile.label_submitted}
          value={new Date(app.created_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
      </div>
      {app.creator_statement && (
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
            {t.profile.label_statement}
          </div>
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {app.creator_statement}
          </p>
        </div>
      )}
    </Card>
  )
}

function VideoCard({ url }: { url: string | null }) {
  const t = useT()
  return (
    <Card title={t.profile.section_video}>
      <VideoEmbed url={url} />
    </Card>
  )
}

function WinnerFormCard({ app }: { app: ProfileApplication }) {
  const t = useT()
  const [phone, setPhone] = useState(app.winner_phone ?? '')
  const [address, setAddress] = useState(app.winner_address ?? '')
  const [messenger, setMessenger] = useState(app.winner_messenger ?? '')
  const [savedAt, setSavedAt] = useState<string | null>(app.winner_info_completed_at)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    setPending(true)

    const res = await saveWinnerInfo({
      applicationId: app.id,
      phone,
      address,
      messenger,
    })

    setPending(false)
    if (!res.ok) {
      const errorMap: Record<typeof res.error, string> = {
        unauthenticated: t.profile.winner_form_err_invalid_token,
        not_owner: t.profile.winner_form_err_not_owner,
        not_awarded: t.profile.winner_form_err_not_awarded,
        not_found: t.profile.winner_form_err_not_found,
        phone_required: t.profile.winner_form_err_phone,
        address_required: t.profile.winner_form_err_address,
        save_failed: t.profile.winner_form_err_save_failed(res.detail),
      }
      setError(errorMap[res.error] ?? 'unknown')
      return
    }

    setDone(true)
    setSavedAt(new Date().toISOString())
  }

  return (
    <Card title={t.profile.section_winner_form} accent>
      <p className="text-xs text-white/60 mb-4 leading-relaxed">
        {t.profile.winner_form_intro}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t.profile.winner_form_phone} required>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.profile.winner_form_phone_ph}
            required
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition"
          />
        </FormField>

        <FormField label={t.profile.winner_form_address} required>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.profile.winner_form_address_ph}
            required
            rows={3}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition resize-y"
          />
        </FormField>

        <FormField
          label={t.profile.winner_form_messenger}
          hint={t.profile.winner_form_messenger_hint}
        >
          <input
            type="text"
            value={messenger}
            onChange={(e) => setMessenger(e.target.value)}
            placeholder={t.profile.winner_form_messenger_ph}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition"
          />
        </FormField>

        {error && (
          <div className="px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
            {error}
          </div>
        )}
        {done && (
          <div className="px-3 py-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300">
            {t.profile.winner_form_already_saved}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full px-5 py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-50"
        >
          {pending ? t.profile.winner_form_saving : t.profile.winner_form_save}
        </button>

        {savedAt && (
          <p className="text-[10px] text-white/40 text-center">
            {t.profile.winner_form_updated_at(
              new Date(savedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            )}
          </p>
        )}
      </form>
    </Card>
  )
}

function HistoryCard({ applications }: { applications: ProfileApplication[] }) {
  const t = useT()
  if (applications.length <= 1) {
    return (
      <Card title={t.profile.section_history}>
        <p className="text-xs text-white/40 text-center py-4">{t.profile.history_empty}</p>
      </Card>
    )
  }
  return (
    <Card title={t.profile.section_history}>
      <div className="space-y-2">
        {applications.slice(1).map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
          >
            <span className="text-sm text-white/80">
              {t.profile.history_season_card(app.season_number, app.season_name)}
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${
                STATUS_STYLES[app.status] ?? STATUS_STYLES.pending
              }`}
            >
              {app.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Card({
  title,
  accent,
  children,
}: {
  title: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`mt-6 border rounded-lg p-6 ${
        accent
          ? 'border-[#ff4444]/40 bg-[#ff4444]/[.06]'
          : 'border-white/10 bg-white/[.02]'
      }`}
    >
      <h2
        className={`text-xs uppercase tracking-[0.2em] font-bold mb-4 ${
          accent ? 'text-[#ff8888]' : 'text-[#b66cff]'
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 sm:w-32 shrink-0">
        {label}
      </div>
      <div className="text-sm text-white/90 break-words">{value}</div>
    </div>
  )
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">
        {label}
        {required && <span className="text-[#ff8888] ml-1">*</span>}
      </div>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/40">{hint}</p>}
    </label>
  )
}
