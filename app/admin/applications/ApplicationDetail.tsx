'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useT, useAdminLang } from '@/lib/admin-i18n'
import { VideoEmbed } from '@/app/_components/VideoEmbed'
import { AdminExternalLink } from '../AdminExternalLink'
import { AdminPageHeader } from '../AdminPageHeader'
import { type ApplicationRow } from './ApplicationsView'
import { saveAdminNotes, saveStatus, saveAwardRank } from './actions'
import {
  deriveGrade,
  GRADE_BADGE_CLASS,
  GRADE_LABEL_EN,
  GRADE_LABEL_KO,
  INTEGRITY_REC_BADGE_CLASS,
  INTEGRITY_REC_LABEL_EN,
  INTEGRITY_REC_LABEL_KO,
  INTEGRITY_CONFIDENCE_LABEL_EN,
  INTEGRITY_CONFIDENCE_LABEL_KO,
  type Grade,
  type IntegrityConfidence,
  type IntegrityRecommendation,
} from '@/lib/grades'

// scoring_results row 전체 — admin detail에서 ai_outputs / explanation 등 추가 컬럼까지 사용.
export type ScoringDetail = {
  id: string
  application_id: string
  season_id: string
  round: 'application' | 'main'
  judged_status: 'pending' | 'in_progress' | 'completed' | 'failed'
  processing_attempts: number
  error_message: string | null
  claude_intent: number | null
  claude_execution: number | null
  claude_originality: number | null
  claude_integrity: number | null
  gpt_intent: number | null
  gpt_execution: number | null
  gpt_originality: number | null
  gemini_intent: number | null
  gemini_execution: number | null
  gemini_originality: number | null
  consensus_intent: number | null
  consensus_execution: number | null
  consensus_originality: number | null
  consensus_integrity: number | null
  verified_score: number | null
  grade: Grade | null
  integrity_flag: boolean
  integrity_confidence: IntegrityConfidence
  integrity_explanation_ko: string | null
  integrity_explanation_en: string | null
  integrity_recommendation: IntegrityRecommendation | null
  ai_outputs: Record<string, { strengths?: string[]; weaknesses?: string[]; aiSummary?: string }> | null
  total_cost_usd: number | null
  total_duration_ms: number | null
  started_at: string | null
  judged_at: string | null
}

// Full status set (matches DB CHECK constraint, 8 values). Admin can change to
// any of these; segment tabs in ApplicationsView only surface a subset for
// clarity. 'flagged' = high-confidence integrity suspicion parked for review.
const STATUS_OPTIONS = [
  'pending',
  'waitlist',
  'verifying',
  'flagged',
  'eligible',
  'selected',
  'awarded',
  'rejected',
] as const

export function ApplicationDetail({
  app,
  scoring,
  seasonLabel,
}: {
  app: ApplicationRow
  scoring: ScoringDetail | null
  seasonLabel: string
}) {
  const t = useT()
  const lang = useAdminLang()
  const showIntegrityReview =
    scoring != null &&
    scoring.judged_status === 'completed' &&
    scoring.integrity_confidence !== 'none'
  const isFlagged = app.status === 'flagged' || scoring?.integrity_flag

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/admin/applications" className="text-xs text-[#ff8844] hover:underline">
        {t.application_detail.back}
      </Link>
      <div className="mt-3">
        <AdminPageHeader
          title={app.creator_name}
          right={<span className="text-xs text-white/40">{seasonLabel}</span>}
        />
      </div>

      {/* Top-of-page urgency banner when flagged for review */}
      {isFlagged && (
        <div className="mb-8 border border-red-500/40 bg-red-500/10 rounded p-4 text-sm text-red-200">
          🚩 {t.application_detail.integrity_high_warning}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: applicant + statement + video + integrity review + scoring */}
        <div className="lg:col-span-2 space-y-8">
          {showIntegrityReview && (
            <IntegrityReviewSection scoring={scoring!} lang={lang} t={t} />
          )}

          <Section title={t.application_detail.section_applicant}>
            <Field label={t.application_detail.label_name} value={app.creator_name} />
            <Field label={t.application_detail.label_email} value={app.email} />
            <Field label={t.application_detail.label_country} value={app.country ?? t.application_detail.no_country} />
            <Field
              label={t.application_detail.label_channel}
              value={
                app.channel_url ? (
                  <AdminExternalLink href={app.channel_url} className="text-[#ff8844] hover:underline break-all">
                    {app.channel_url}
                  </AdminExternalLink>
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
            <ScoringSection scoring={scoring} lang={lang} t={t} />
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

function IntegrityReviewSection({
  scoring,
  lang,
  t,
}: {
  scoring: ScoringDetail
  lang: 'ko' | 'en'
  t: ReturnType<typeof useT>
}) {
  const confLabel = lang === 'ko' ? INTEGRITY_CONFIDENCE_LABEL_KO : INTEGRITY_CONFIDENCE_LABEL_EN
  const recLabel = lang === 'ko' ? INTEGRITY_REC_LABEL_KO : INTEGRITY_REC_LABEL_EN
  const explanation =
    lang === 'ko'
      ? scoring.integrity_explanation_ko ?? scoring.integrity_explanation_en
      : scoring.integrity_explanation_en ?? scoring.integrity_explanation_ko
  const accent = scoring.integrity_flag
    ? 'border-red-500/40 bg-red-500/5'
    : 'border-white/10 bg-white/[.02]'

  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">
        {t.application_detail.section_integrity_review}
      </h2>
      <div className={`border rounded p-5 space-y-4 ${accent}`}>
        <div className="flex items-center gap-3">
          {scoring.integrity_recommendation && (
            <span
              className={`inline-block px-3 py-1 rounded text-xs uppercase tracking-wider font-bold ${
                INTEGRITY_REC_BADGE_CLASS[scoring.integrity_recommendation]
              }`}
            >
              {recLabel[scoring.integrity_recommendation]}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            {t.application_detail.integrity_confidence_label}: {confLabel[scoring.integrity_confidence]}
          </span>
          {scoring.claude_integrity != null && (
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              {t.application_detail.integrity_score_label}: {Math.round(scoring.claude_integrity)}/100
            </span>
          )}
        </div>

        {explanation && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              {t.application_detail.integrity_explanation_label}
            </div>
            <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
              {explanation}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function ScoringSection({
  scoring,
  lang,
  t,
}: {
  scoring: ScoringDetail | null
  lang: 'ko' | 'en'
  t: ReturnType<typeof useT>
}) {
  const [showOutputs, setShowOutputs] = useState(false)

  if (scoring == null) {
    return <p className="text-xs text-white/40">{t.application_detail.scoring_no_data}</p>
  }
  if (scoring.judged_status === 'pending' || scoring.judged_status === 'in_progress') {
    return <p className="text-xs text-indigo-300/80">{t.application_detail.scoring_in_progress}</p>
  }
  if (scoring.judged_status === 'failed') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-300">{t.application_detail.scoring_failed}</p>
        {scoring.error_message && (
          <pre className="text-[10px] text-white/40 whitespace-pre-wrap font-mono">
            {scoring.error_message}
          </pre>
        )}
      </div>
    )
  }

  const gradeLabel = lang === 'ko' ? GRADE_LABEL_KO : GRADE_LABEL_EN
  const derived = (scoring.grade as Grade | null) ?? deriveGrade(scoring.verified_score)

  return (
    <div className="space-y-5">
      {/* Verified score + grade */}
      <div className="flex items-baseline gap-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">
            {t.application_detail.scoring_verified_score}
          </div>
          <div className="text-4xl font-black text-white">
            {scoring.verified_score != null ? Number(scoring.verified_score).toFixed(2) : '—'}
            <span className="text-base text-white/40 font-normal ml-1">/100</span>
          </div>
        </div>
        {derived && (
          <span
            className={`inline-block px-3 py-1 rounded text-xs uppercase tracking-wider font-bold ${GRADE_BADGE_CLASS[derived]}`}
          >
            {gradeLabel[derived]}
          </span>
        )}
      </div>

      {/* Consensus subscores */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
          {t.application_detail.scoring_subscores}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Subscore label={t.application_detail.scoring_intent} value={scoring.consensus_intent} />
          <Subscore label={t.application_detail.scoring_execution} value={scoring.consensus_execution} />
          <Subscore label={t.application_detail.scoring_originality} value={scoring.consensus_originality} />
          <Subscore label={t.application_detail.scoring_integrity_weight} value={scoring.consensus_integrity} />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
        {scoring.judged_at && (
          <span>{t.application_detail.scoring_judged_at(new Date(scoring.judged_at).toLocaleString())}</span>
        )}
        {scoring.total_cost_usd != null && (
          <span>{t.application_detail.scoring_cost(`$${Number(scoring.total_cost_usd).toFixed(4)}`)}</span>
        )}
      </div>

      {/* AI outputs toggle */}
      {scoring.ai_outputs && (
        <div>
          <button
            type="button"
            onClick={() => setShowOutputs((s) => !s)}
            className="text-xs text-[#ff8844] hover:underline"
          >
            {showOutputs
              ? t.application_detail.ai_outputs_hide
              : t.application_detail.ai_outputs_toggle}
          </button>
          {showOutputs && (
            <div className="mt-3 space-y-4">
              {Object.entries(scoring.ai_outputs).map(([model, out]) => (
                <div key={model} className="border border-white/10 rounded p-3 bg-black/30">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2">
                    {model}
                  </div>
                  {out.aiSummary && (
                    <p className="text-xs text-white/80 mb-2 leading-relaxed">{out.aiSummary}</p>
                  )}
                  {out.strengths && out.strengths.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] text-emerald-300/70 mb-1">{t.application_detail.ai_output_strengths}</div>
                      <ul className="text-[11px] text-white/70 list-disc list-inside space-y-0.5">
                        {out.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {out.weaknesses && out.weaknesses.length > 0 && (
                    <div>
                      <div className="text-[10px] text-red-300/70 mb-1">{t.application_detail.ai_output_weaknesses}</div>
                      <ul className="text-[11px] text-white/70 list-disc list-inside space-y-0.5">
                        {out.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Subscore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border border-white/10 rounded p-2 bg-black/20">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-lg font-bold text-white/90">
        {value != null ? Math.round(value) : '—'}
        <span className="text-[10px] text-white/30 font-normal ml-0.5">/100</span>
      </div>
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
