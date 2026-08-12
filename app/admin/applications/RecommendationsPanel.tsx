'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useT, useAdminLang } from '@/lib/admin-i18n'
import { ConfirmModal } from '@/app/_components/ConfirmModal'
import {
  GRADE_BADGE_CLASS,
  GRADE_LABEL_EN,
  GRADE_LABEL_KO,
  deriveGrade,
  type Grade,
} from '@/lib/grades'
import {
  applyRecommendation,
  type ApplyRecommendationError,
} from './actions'
import type { ApplicationRow, RecommendationRow } from './ApplicationsView'

// Apply Recommendation (1.5) panel — 추천 검토 + 일괄 적용 UI.
// 작업 5: UI 표시 + ConfirmModal 흐름. Apply 클릭은 placeholder (작업 6에서 wiring).
// 작업 7+: scoring_results admin score 변경 차단 (별도).

type Props = {
  seasonId: string
  recommendations: RecommendationRow[]
  applications: ApplicationRow[]
  topNAdvance: number
}

export function RecommendationsPanel({
  seasonId,
  recommendations,
  applications,
  topNAdvance,
}: Props) {
  const t = useT()
  const lang = useAdminLang()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const appById = useMemo(() => {
    const m = new Map<string, ApplicationRow>()
    for (const a of applications) m.set(a.id, a)
    return m
  }, [applications])

  // Flagged sub-section — integrity_flag=true + 채점 완료된 항목.
  // 자동 추천에서 제외됐음을 admin에게 명시.
  const flaggedApps = useMemo(
    () =>
      applications.filter(
        (a) => a.integrity_flag && a.judged_status === 'completed',
      ),
    [applications],
  )

  const gradeLabel = lang === 'ko' ? GRADE_LABEL_KO : GRADE_LABEL_EN

  const handleApplyClick = () => {
    setApplyError(null)
    setConfirmOpen(true)
  }
  const handleConfirm = async () => {
    setConfirmOpen(false)
    setApplying(true)
    setApplyError(null)

    const res = await applyRecommendation({ seasonId })

    setApplying(false)

    if (!res.ok) {
      const errorMap: Record<ApplyRecommendationError, string> = {
        unauthorized: t.applications.apply_rec_err_unauthorized,
        season_not_found: t.applications.apply_rec_err_season_not_found,
        no_recommendations: t.applications.apply_rec_err_no_recommendations,
        race_or_already_applied: t.applications.apply_rec_err_race_or_already_applied,
        update_failed: t.applications.apply_rec_err_update_failed,
      }
      setApplyError(errorMap[res.error])
      return
    }

    // success — refresh server data so RecommendationsPanel re-renders with
    // updated status='applied' from DB and ApplicationsView reflects new statuses.
    router.refresh()
  }

  const hasRecommendations = recommendations.length > 0
  const status = recommendations[0]?.status ?? null
  const isApplied = status === 'applied'
  const recommendedAt = recommendations[0]?.recommended_at
  const appliedAt = recommendations[0]?.applied_at
  const appliedBy = recommendations[0]?.applied_by

  return (
    <section className="mb-6 border border-[#8b22ff]/30 bg-[#8b22ff]/[.05] rounded-lg p-6">
      <header className="mb-4">
        <h2 className="text-xl font-black mb-1">
          {t.applications.recommendations_title(topNAdvance)}
        </h2>
        <p className="text-sm text-white/50">
          {t.applications.recommendations_subtitle}
        </p>
      </header>

      {/* 본문 분기 */}
      {!hasRecommendations ? (
        <div className="rounded border border-white/10 bg-white/[.02] px-4 py-6 text-center text-sm text-white/60">
          {t.applications.recommendations_empty}
        </div>
      ) : (
        <>
          {/* 상단 메타 + 적용 상태 */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <div className="text-xs text-white/50">
              {recommendedAt && (
                <span>
                  {t.applications.recommendations_recommended_at(
                    new Date(recommendedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  )}
                </span>
              )}
              <span className="mx-2 text-white/20">·</span>
              <span>{t.applications.recommendations_total_label(recommendations.length)}</span>
            </div>
            {isApplied && appliedAt && (
              <span className="inline-block px-3 py-1 rounded text-xs uppercase tracking-wider font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                {t.applications.recommendations_applied_status}
              </span>
            )}
          </div>

          {isApplied && appliedAt && (
            <p className="mb-4 text-xs text-white/60">
              {t.applications.recommendations_applied_at(
                new Date(appliedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
                appliedBy ?? '—',
              )}
            </p>
          )}

          {/* 테이블 */}
          <div className="border border-white/10 rounded overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-bold w-16">
                    {t.applications.recommendations_col_rank}
                  </th>
                  <th className="text-left px-4 py-2 font-bold">
                    {t.applications.col_name}
                  </th>
                  <th className="text-left px-4 py-2 font-bold">
                    {t.applications.col_email}
                  </th>
                  <th className="text-right px-4 py-2 font-bold">
                    {t.applications.recommendations_col_score}
                  </th>
                  <th className="text-left px-4 py-2 font-bold">
                    {t.applications.col_grade}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recommendations.map((r) => {
                  const app = appById.get(r.application_id)
                  const grade: Grade | null =
                    (app?.grade as Grade | null) ?? deriveGrade(r.verified_score)
                  return (
                    <tr key={r.id} className="hover:bg-white/[.03]">
                      <td className="px-4 py-2 font-bold text-[#b66cff]">#{r.rank}</td>
                      <td className="px-4 py-2 font-bold">
                        {app ? (
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className="hover:text-[#ff8844]"
                          >
                            {app.creator_name}
                          </Link>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-white/70">{app?.email ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-bold text-white/90 tabular-nums">
                        {r.verified_score != null
                          ? r.verified_score.toFixed(2)
                          : t.applications.score_pending}
                      </td>
                      <td className="px-4 py-2">
                        {grade ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${GRADE_BADGE_CLASS[grade]}`}
                          >
                            {gradeLabel[grade]}
                          </span>
                        ) : (
                          <span className="text-white/40 text-xs">
                            {t.applications.score_pending}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 서버 에러 메시지 */}
          {applyError && (
            <div className="mb-4 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
              {applyError}
            </div>
          )}

          {/* Apply 버튼 — recommended 상태에서만 활성 */}
          {!isApplied && (
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={applying}
              className="w-full px-5 py-3 rounded bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {applying ? '…' : t.applications.recommendations_apply_btn}
            </button>
          )}
        </>
      )}

      {/* Flagged sub-section */}
      {flaggedApps.length > 0 && (
        <div className="mt-6 border border-red-500/30 bg-red-500/[.05] rounded p-4">
          <h3 className="text-sm font-bold text-red-300 mb-2">
            {t.applications.recommendations_flagged_section_title}
          </h3>
          <p className="text-xs text-white/60 mb-3 leading-relaxed">
            {t.applications.recommendations_flagged_section_note}
          </p>
          <FlaggedAppsTable apps={flaggedApps} lang={lang} t={t} />
        </div>
      )}

      {/* 확인 모달 — 작업 6 wiring 대기 */}
      <ConfirmModal
        open={confirmOpen}
        message={t.applications.recommendations_apply_confirm_message(topNAdvance)}
        confirmLabel={t.applications.recommendations_apply_confirm_btn}
        cancelLabel={t.applications.recommendations_apply_cancel_btn}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        variant="default"
      />
    </section>
  )
}

function FlaggedAppsTable({
  apps,
  lang,
  t,
}: {
  apps: ApplicationRow[]
  lang: 'ko' | 'en'
  t: ReturnType<typeof useT>
}) {
  const gradeLabel = lang === 'ko' ? GRADE_LABEL_KO : GRADE_LABEL_EN
  return (
    <table className="w-full text-xs">
      <thead className="text-white/50 uppercase tracking-wider">
        <tr>
          <th className="text-left py-1 font-bold">{t.applications.col_name}</th>
          <th className="text-left py-1 font-bold">{t.applications.col_email}</th>
          <th className="text-right py-1 font-bold">
            {t.applications.recommendations_col_score}
          </th>
          <th className="text-left py-1 font-bold">{t.applications.col_grade}</th>
          <th className="text-left py-1 font-bold">{t.applications.col_status}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {apps.map((a) => {
          const grade: Grade | null =
            (a.grade as Grade | null) ?? deriveGrade(a.verified_score)
          return (
            <tr key={a.id}>
              <td className="py-1.5 font-bold">
                <Link
                  href={`/admin/applications/${a.id}`}
                  className="hover:text-[#ff8844]"
                >
                  {a.creator_name}
                </Link>
              </td>
              <td className="py-1.5 text-white/70">{a.email}</td>
              <td className="py-1.5 text-right tabular-nums text-white/90">
                {a.verified_score != null
                  ? a.verified_score.toFixed(2)
                  : t.applications.score_pending}
              </td>
              <td className="py-1.5">
                {grade ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${GRADE_BADGE_CLASS[grade]}`}
                  >
                    {gradeLabel[grade]}
                  </span>
                ) : (
                  <span className="text-white/40">{t.applications.score_pending}</span>
                )}
              </td>
              <td className="py-1.5 text-white/60">{a.status}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

