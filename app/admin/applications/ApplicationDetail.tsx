'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useT } from '@/lib/admin-i18n'
import { VideoEmbed } from '@/app/_components/VideoEmbed'
import { type ApplicationRow } from './ApplicationsView'
import { saveAdminNotes, saveStatus, saveAwardRank } from './actions'

// Full status set (matches DB CHECK constraint). Admin can change to any of
// these; segment tabs in ApplicationsView only surface a subset for clarity.
const STATUS_OPTIONS = [
  'pending',
  'waitlist',
  'verifying',
  'eligible',
  'selected',
  'awarded',
  'rejected',
] as const

export function ApplicationDetail({
  app,
  seasonLabel,
}: {
  app: ApplicationRow
  seasonLabel: string
}) {
  const t = useT()

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/admin/applications" className="text-xs text-[#ff8844] hover:underline">
        {t.application_detail.back}
      </Link>
      <header className="mt-3 mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-black">{app.creator_name}</h1>
        <span className="text-xs text-white/40">{seasonLabel}</span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: applicant + statement + video */}
        <div className="lg:col-span-2 space-y-8">
          <Section title={t.application_detail.section_applicant}>
            <Field label={t.application_detail.label_name} value={app.creator_name} />
            <Field label={t.application_detail.label_email} value={app.email} />
            <Field label={t.application_detail.label_country} value={app.country ?? t.application_detail.no_country} />
            <Field
              label={t.application_detail.label_channel}
              value={
                app.channel_url ? (
                  <a
                    href={app.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff8844] hover:underline break-all"
                  >
                    {app.channel_url}
                  </a>
                ) : (
                  t.application_detail.no_channel
                )
              }
            />
            <Field label={t.application_detail.label_ai_service} value={app.ai_service ?? '—'} />
            <Field
              label={t.application_detail.label_submitted}
              value={new Date(app.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          </Section>

          <Section title={t.application_detail.section_statement}>
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {app.creator_statement || '—'}
            </p>
          </Section>

          <Section title={t.application_detail.section_video}>
            <VideoEmbed url={app.free_entry_url} />
            {app.video_duration_seconds != null && (
              <p className="mt-2 text-[10px] text-white/40">
                {app.video_duration_seconds}s
              </p>
            )}
          </Section>

          <Section title={t.application_detail.section_scoring}>
            <p className="text-xs text-white/40">{t.application_detail.scoring_placeholder}</p>
          </Section>
        </div>

        {/* Right column: admin actions */}
        <aside className="lg:col-span-1">
          <Section title={t.application_detail.section_actions}>
            <StatusEditor id={app.id} currentStatus={app.status} />
            <AwardEditor id={app.id} currentRank={app.award_rank} />
            <NotesEditor id={app.id} initial={app.admin_notes ?? ''} />
          </Section>
        </aside>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">
        {title}
      </h2>
      <div className="border border-white/10 rounded p-5 bg-white/[.02] space-y-4">
        {children}
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{label}</div>
      <div className="text-sm text-white/90">{value}</div>
    </div>
  )
}

function StatusEditor({ id, currentStatus }: { id: string; currentStatus: string }) {
  const t = useT()
  const [status, setStatus] = useState(currentStatus)
  const [pending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    setSavedKey(null)
    startTransition(async () => {
      const result = await saveStatus(id, status)
      if (result.ok) setSavedKey(t.application_detail.notes_saved)
      else setError(result.errorMessage ?? 'error')
    })
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {t.application_detail.status_change_label}
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending || status === currentStatus}
        className="w-full px-3 py-2 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? t.application_detail.notes_saving : t.application_detail.save_status}
      </button>
      {savedKey && <p className="text-[10px] text-emerald-300">{savedKey}</p>}
      {error && <p className="text-[10px] text-[#ff8888]">{error}</p>}
    </div>
  )
}

function AwardEditor({ id, currentRank }: { id: string; currentRank: number | null }) {
  const t = useT()
  const [rank, setRank] = useState<string>(currentRank == null ? '' : String(currentRank))
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const value = rank === '' ? null : Number(rank)
      const result = await saveAwardRank(id, value)
      if (result.ok) setSaved(true)
      else setError(result.errorMessage ?? 'error')
    })
  }

  return (
    <div className="space-y-2 pt-3 border-t border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {t.application_detail.award_rank_label}
      </div>
      <select
        value={rank}
        onChange={(e) => setRank(e.target.value)}
        className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
      >
        <option value="">{t.application_detail.award_rank_none}</option>
        <option value="1">{t.application_detail.award_rank_1st}</option>
        <option value="2">{t.application_detail.award_rank_2nd}</option>
        <option value="3">{t.application_detail.award_rank_3rd}</option>
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending || rank === (currentRank == null ? '' : String(currentRank))}
        className="w-full px-3 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? t.application_detail.notes_saving : t.application_detail.save_award}
      </button>
      {saved && <p className="text-[10px] text-emerald-300">{t.application_detail.notes_saved}</p>}
      {error && <p className="text-[10px] text-[#ff8888]">{error}</p>}
    </div>
  )
}

function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const t = useT()
  const [notes, setNotes] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveAdminNotes(id, notes)
      if (result.ok) setSaved(true)
      else setError(result.errorMessage ?? 'error')
    })
  }

  return (
    <div className="space-y-2 pt-3 border-t border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-white/40">
        {t.application_detail.notes_label}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t.application_detail.notes_placeholder}
        rows={6}
        className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none resize-y"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={pending || notes === initial}
        className="w-full px-3 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? t.application_detail.notes_saving : t.application_detail.notes_save}
      </button>
      {saved && <p className="text-[10px] text-emerald-300">{t.application_detail.notes_saved}</p>}
      {error && <p className="text-[10px] text-[#ff8888]">{error}</p>}
    </div>
  )
}
