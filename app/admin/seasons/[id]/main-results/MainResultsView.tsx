'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useT, useAdminLang } from '@/lib/admin-i18n'
import { ConfirmModal } from '@/app/_components/ConfirmModal'
import {
  GRADE_BADGE_CLASS,
  GRADE_LABEL_EN,
  GRADE_LABEL_KO,
  INTEGRITY_REC_BADGE_CLASS,
  INTEGRITY_REC_LABEL_EN,
  INTEGRITY_REC_LABEL_KO,
  type Grade,
  type IntegrityConfidence,
  type IntegrityRecommendation,
} from '@/lib/grades'
import { approveTop3Awards, saveAwardOverride } from '@/app/admin/applications/actions'

export type MainResultRow = {
  id: string
  creatorName: string
  email: string
  videoUrl: string | null
  status: string
  awardRank: number | null
  overrideReason: string | null
  verifiedScore: number | null
  finalScore: number | null
  grade: Grade | null
  judgedStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | null
  integrityFlag: boolean
  integrityConfidence: IntegrityConfidence | null
  integrityRecommendation: IntegrityRecommendation | null
}

type Props = {
  seasonId: string
  seasonName: string
  mainRoundTheme: string | null
  aiWeight: number
  communityWeight: number
  soakMode: boolean
  rows: MainResultRow[]
}

export function MainResultsView({
  seasonId,
  seasonName,
  mainRoundTheme,
  aiWeight,
  communityWeight,
  soakMode,
  rows,
}: Props) {
  const t = useT()
  const lang = useAdminLang()
  const router = useRouter()
  const gradeLabel = lang === 'ko' ? GRADE_LABEL_KO : GRADE_LABEL_EN
  const recLabel = lang === 'ko' ? INTEGRITY_REC_LABEL_KO : INTEGRITY_REC_LABEL_EN

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // override 인라인 편집 — 어느 행이 열렸는지 + 입력값.
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [overrideRank, setOverrideRank] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [savingOverride, setSavingOverride] = useState(false)

  const scoredCount = rows.filter((r) => r.finalScore != null).length

  const handleApproveConfirm = async () => {
    setConfirmOpen(false)
    setApproving(true)
    setActionError(null)
    const res = await approveTop3Awards(seasonId)
    setApproving(false)
    if (!res.ok) {
      const map: Record<string, string> = {
        season_not_found: t.main_results.approve_err_season_not_found,
        no_scored_submissions: t.main_results.approve_err_no_scored,
        update_failed: t.main_results.approve_err_update_failed,
        // Three-gate blocks. The server also returns `detail` with the measured
        // numbers ("7/10 scored"); show it, because a gate that will not say what
        // it counted is indistinguishable from a broken button.
        schedule_not_reached: t.main_results.approve_err_schedule_not_reached,
        already_awarded: t.main_results.approve_err_already_awarded,
        nothing_submitted: t.main_results.approve_err_nothing_submitted,
        scoring_incomplete: t.main_results.approve_err_scoring_incomplete,
        vote_window_open: t.main_results.approve_err_vote_window_open,
      }
      const base = map[res.error] ?? res.error
      setActionError(res.detail ? `${base} (${res.detail})` : base)
      return
    }
    router.refresh()
  }

  const openOverride = (row: MainResultRow) => {
    setOverrideId(row.id)
    setOverrideRank(row.awardRank != null ? String(row.awardRank) : '')
    setOverrideReason(row.overrideReason ?? '')
    setActionError(null)
  }

  const handleOverrideSave = async (id: string) => {
    setActionError(null)
    if (!overrideReason.trim()) {
      setActionError(t.main_results.override_err_required)
      return
    }
    const rankNum = overrideRank.trim() === '' ? null : Number(overrideRank)
    if (rankNum !== null && (!Number.isInteger(rankNum) || rankNum < 1 || rankNum > 99)) {
      setActionError(t.main_results.override_err_rank)
      return
    }
    setSavingOverride(true)
    const res = await saveAwardOverride(id, rankNum, overrideReason)
    setSavingOverride(false)
    if (!res.ok) {
      setActionError(res.errorMessage ?? 'error')
      return
    }
    setOverrideId(null)
    router.refresh()
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href={`/admin/seasons/${seasonId}`}
        className="text-xs text-white/50 hover:text-[#ff8844] transition"
      >
        ← {t.main_results.back_to_season}
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-black mb-1">{t.main_results.page_title}</h1>
        <p className="text-sm text-white/50">{seasonName}</p>
        <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-2xl">
          {t.main_results.subtitle}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-block px-2 py-1 rounded bg-white/[.06] text-white/70">
            {t.main_results.weights_label(
              Math.round(aiWeight * 100),
              Math.round(communityWeight * 100),
            )}
          </span>
          {soakMode && (
            <span className="inline-block px-2 py-1 rounded border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] text-[#d4a7ff]">
              {t.main_results.soak_note}
            </span>
          )}
        </div>
        {/* 본선 공통 주제 — 모든 영상이 같은 주제(=statement)라 1회만 표시.
            표시는 짧은 라벨(main_round_theme_label). 채점에 실제로 쓰인 전문은
            main_round_theme이며 /rules에 공개된다. (TK 2026-07-15) */}
        {mainRoundTheme && (
          <div className="mt-4 rounded-lg border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] px-4 py-3">
            <span className="text-[11px] uppercase tracking-wider text-white/50">
              {t.main_results.theme_label}
            </span>
            <p className="text-lg font-bold text-[#d4a7ff]">{mainRoundTheme}</p>
          </div>
        )}
      </header>

      {actionError && (
        <div className="mb-4 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {actionError}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded border border-white/10 bg-white/[.02] px-4 py-10 text-center text-sm text-white/60">
          {t.main_results.empty}
        </div>
      ) : (
        <>
          {/* 승인 버튼 — 채점된 제출이 있을 때만 활성 */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setActionError(null)
                setConfirmOpen(true)
              }}
              disabled={approving || scoredCount === 0}
              className="px-5 py-3 rounded bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {approving ? '…' : t.main_results.approve_btn}
            </button>
            <p className="mt-2 text-xs text-white/40">{t.main_results.approve_hint}</p>
          </div>

          <div className="border border-white/10 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-bold w-12">
                    {t.main_results.col_rank}
                  </th>
                  <th className="text-left px-4 py-2 font-bold">{t.main_results.col_creator}</th>
                  <th className="text-right px-4 py-2 font-bold">{t.main_results.col_final}</th>
                  <th className="text-left px-4 py-2 font-bold">{t.main_results.col_grade}</th>
                  <th className="text-left px-4 py-2 font-bold">{t.main_results.col_award}</th>
                  <th className="text-right px-4 py-2 font-bold">{t.main_results.col_actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, idx) => {
                  const position = row.finalScore != null ? idx + 1 : null
                  return (
                    <RowItem
                      key={row.id}
                      row={row}
                      position={position}
                      gradeLabel={gradeLabel}
                      recLabel={recLabel}
                      t={t}
                      isOverriding={overrideId === row.id}
                      overrideRank={overrideRank}
                      overrideReason={overrideReason}
                      savingOverride={savingOverride}
                      onOpenOverride={() => openOverride(row)}
                      onCancelOverride={() => setOverrideId(null)}
                      onChangeRank={setOverrideRank}
                      onChangeReason={setOverrideReason}
                      onSaveOverride={() => handleOverrideSave(row.id)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmOpen}
        message={t.main_results.approve_confirm_message}
        confirmLabel={t.main_results.approve_confirm_btn}
        cancelLabel={t.main_results.approve_cancel_btn}
        onConfirm={handleApproveConfirm}
        onCancel={() => setConfirmOpen(false)}
        variant="default"
      />
    </div>
  )
}

function RowItem({
  row,
  position,
  gradeLabel,
  recLabel,
  t,
  isOverriding,
  overrideRank,
  overrideReason,
  savingOverride,
  onOpenOverride,
  onCancelOverride,
  onChangeRank,
  onChangeReason,
  onSaveOverride,
}: {
  row: MainResultRow
  position: number | null
  gradeLabel: Record<Grade, string>
  recLabel: Record<IntegrityRecommendation, string>
  t: ReturnType<typeof useT>
  isOverriding: boolean
  overrideRank: string
  overrideReason: string
  savingOverride: boolean
  onOpenOverride: () => void
  onCancelOverride: () => void
  onChangeRank: (v: string) => void
  onChangeReason: (v: string) => void
  onSaveOverride: () => void
}) {
  return (
    <>
      <tr className="hover:bg-white/[.03]">
        <td className="px-4 py-2 font-bold text-[#b66cff] tabular-nums">
          {position != null ? `#${position}` : '—'}
        </td>
        <td className="px-4 py-2">
          <Link href={`/admin/applications/${row.id}`} className="font-bold hover:text-[#ff8844]">
            {row.creatorName}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            {row.videoUrl ? (
              <a
                href={row.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/40 hover:text-[#ff8844]"
              >
                {t.main_results.col_video} ↗
              </a>
            ) : (
              <span className="text-[11px] text-white/30">{t.main_results.no_video}</span>
            )}
            {row.integrityFlag && row.integrityRecommendation && (
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${INTEGRITY_REC_BADGE_CLASS[row.integrityRecommendation]}`}
              >
                ⚑ {recLabel[row.integrityRecommendation]}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-right font-bold text-white/90 tabular-nums">
          {row.finalScore != null
            ? row.finalScore.toFixed(1)
            : <span className="text-white/40 font-normal">{t.main_results.final_pending}</span>}
        </td>
        <td className="px-4 py-2">
          {row.grade ? (
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${GRADE_BADGE_CLASS[row.grade]}`}
            >
              {gradeLabel[row.grade]}
            </span>
          ) : (
            <span className="text-white/40 text-xs">{t.main_results.final_pending}</span>
          )}
        </td>
        <td className="px-4 py-2">
          {row.awardRank != null ? (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-black">
              {t.main_results.award_badge(row.awardRank)}
            </span>
          ) : (
            <span className="text-white/30 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={onOpenOverride}
            className="text-xs text-white/50 hover:text-[#ff8844] transition"
          >
            {t.main_results.override_btn}
          </button>
        </td>
      </tr>

      {isOverriding && (
        <tr className="bg-white/[.02]">
          <td colSpan={6} className="px-4 py-4">
            <div className="border border-[#ff8844]/30 bg-[#ff8844]/[.04] rounded p-4">
              <p className="text-xs text-white/60 mb-3 leading-relaxed">
                {t.main_results.override_note}
              </p>
              {row.overrideReason && (
                <p className="text-xs text-amber-300/80 mb-3">
                  {t.main_results.override_prev(row.overrideReason)}
                </p>
              )}
              <div className="flex flex-wrap gap-3 items-start">
                <label className="text-xs text-white/60">
                  {t.main_results.override_rank_label}
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={overrideRank}
                    onChange={(e) => onChangeRank(e.target.value)}
                    placeholder={t.main_results.override_rank_ph}
                    className="ml-2 w-20 px-2 py-1 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
                  />
                </label>
              </div>
              <textarea
                value={overrideReason}
                onChange={(e) => onChangeReason(e.target.value)}
                placeholder={t.main_results.override_reason_ph}
                rows={2}
                className="mt-3 w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white placeholder:text-white/30 focus:border-[#ff8844] focus:outline-none transition"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onSaveOverride}
                  disabled={savingOverride}
                  className="px-4 py-2 rounded bg-[#ff8844] text-black font-bold text-xs uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40"
                >
                  {savingOverride ? '…' : t.main_results.override_save_btn}
                </button>
                <button
                  type="button"
                  onClick={onCancelOverride}
                  className="px-4 py-2 rounded border border-white/15 text-white/70 font-bold text-xs uppercase tracking-wider hover:bg-white/5 transition"
                >
                  {t.main_results.override_cancel_btn}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
