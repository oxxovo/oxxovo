'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT, useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'
import { useLocalToken, clearLocalUser } from '@/lib/use-local-user'
import { VideoEmbed } from '@/app/_components/VideoEmbed'
import { WinnerCelebrationCard } from './WinnerCelebrationCard'
import {
  loadProfileData,
  saveWinnerInfo,
  type ProfileApplication,
  type ProfileData,
} from './actions'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-white/10 text-white/70 border-white/20',
  waitlist: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  verifying: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  eligible: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  selected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  awarded: 'bg-[#ff4444]/15 text-[#ff8888] border-[#ff4444]/30',
  rejected: 'bg-white/5 text-white/40 border-white/10',
}

export default function ProfilePage() {
  const router = useRouter()
  const t = useT()
  const token = useLocalToken()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Token is read via useSyncExternalStore (hydration-safe). When it appears
  // we fetch the profile; setData/setLoadError only run inside the async
  // callback (not synchronously in the effect body) which keeps the
  // react-hooks/set-state-in-effect rule happy.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadProfileData(token).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setData(res.data)
      } else if (res.error === 'invalid_token') {
        // Stale or forged token. Clear it; the useLocalToken subscriber
        // will re-render the component with token === null.
        clearLocalUser()
      } else {
        setLoadError(res.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleLogout = () => {
    clearLocalUser()
    router.push('/')
  }

  if (token === null) {
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

  if (!data) {
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
            <ScoringCard />
            {currentApp.status === 'awarded' && (
              <WinnerFormCard token={token} app={currentApp} />
            )}
          </>
        )}

        <HistoryCard applications={data.applications} />
      </section>
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

function ScoringCard() {
  const t = useT()
  return (
    <Card title={t.profile.section_scoring}>
      <p className="text-xs text-white/40">{t.profile.scoring_placeholder}</p>
    </Card>
  )
}

function WinnerFormCard({
  token,
  app,
}: {
  token: string
  app: ProfileApplication
}) {
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
      token,
      applicationId: app.id,
      phone,
      address,
      messenger,
    })

    setPending(false)
    if (!res.ok) {
      const errorMap: Record<typeof res.error, string> = {
        invalid_token: t.profile.winner_form_err_invalid_token,
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
