import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { computeFinalScore, computeCommunityScore } from '@/lib/scoring'
import { getMainRoundVoteTally } from '@/lib/watch'
import { type Season } from '@/lib/seasons'
import { MainResultsView, type MainResultRow } from './MainResultsView'

// 본선 결과 리더보드 (옵션 3 — AI 자동 랭킹 + admin 최종 승인).
// round='main' scoring_results를 computeFinalScore(Layer-2)로 랭킹. Soak 모드
// (community_vote_weight=0)에선 final === verified_score. 데이터(round='main')는
// oxxovo-scoring이 본선 종료 후 생성 — 없으면 "채점 대기" 빈 상태로 렌더.
// 통합 계약: docs/main-round-pipeline-contract.md
export default async function MainResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createSupabaseServer()
  const admin = createSupabaseAdmin()

  // seasons carries the secret main_round_twist, so it reads via service
  // role rather than the authenticated-role client (2026-08-14, GRANT
  // hardening).
  const { data: seasonData, error: seasonErr } = await admin
    .from('seasons')
    .select('*')
    .eq('id', id)
    .single()
  if (seasonErr || !seasonData) notFound()
  const season = seasonData as Season

  // 본선 제출자(main_round_submitted_at IS NOT NULL) + round='main' 채점 join
  // + 커뮤니티 투표 집계(final_score Layer-2 블렌드용).
  const [appsRes, scoringRes, voteTally] = await Promise.all([
    supabase
      .from('genesis_applications')
      .select(
        'id, creator_name, email, main_round_video_url, status, award_rank, award_override_reason',
      )
      .eq('season_id', id)
      .not('main_round_submitted_at', 'is', null),
    supabase
      .from('scoring_results')
      .select(
        'application_id, verified_score, grade, judged_status, integrity_flag, integrity_confidence, integrity_recommendation',
      )
      .eq('season_id', id)
      .eq('round', 'main'),
    getMainRoundVoteTally(id),
  ])

  const scoringByApp = new Map<string, NonNullable<typeof scoringRes.data>[number]>()
  for (const s of scoringRes.data ?? []) scoringByApp.set(s.application_id, s)

  // 최다 득표수 (B안 정규화 기준). 투표 0건이면 0 → computeCommunityScore가
  // null 반환 → 가중 시즌은 final=null(pending), 시즌0(weight 0)은 AI로 확정.
  const maxVotes = voteTally.size > 0 ? Math.max(...voteTally.values()) : 0

  const rows: MainResultRow[] = (appsRes.data ?? [])
    .map((a) => {
      const s = scoringByApp.get(a.id)
      // 채점 완료(completed)된 것만 점수 인정 — 진행 중/실패는 final=null.
      const verified = s?.judged_status === 'completed' ? (s?.verified_score ?? null) : null
      const communityScore = computeCommunityScore(voteTally.get(a.id) ?? 0, maxVotes)
      return {
        id: a.id,
        creatorName: a.creator_name,
        email: a.email,
        videoUrl: a.main_round_video_url,
        status: a.status,
        awardRank: a.award_rank,
        overrideReason: a.award_override_reason ?? null,
        verifiedScore: verified,
        finalScore: computeFinalScore(verified, communityScore, season),
        grade: (s?.grade as MainResultRow['grade']) ?? null,
        judgedStatus: (s?.judged_status as MainResultRow['judgedStatus']) ?? null,
        integrityFlag: s?.integrity_flag ?? false,
        integrityConfidence:
          (s?.integrity_confidence as MainResultRow['integrityConfidence']) ?? null,
        integrityRecommendation:
          (s?.integrity_recommendation as MainResultRow['integrityRecommendation']) ?? null,
      }
    })
    // final_score DESC. 미채점(null)은 맨 뒤로.
    .sort((a, b) => {
      if (a.finalScore == null && b.finalScore == null) return 0
      if (a.finalScore == null) return 1
      if (b.finalScore == null) return -1
      return b.finalScore - a.finalScore
    })

  return (
    <MainResultsView
      seasonId={id}
      seasonName={season.display_name}
      mainRoundTheme={season.main_round_theme_label}
      aiWeight={season.ai_score_weight}
      communityWeight={season.community_vote_weight}
      soakMode={season.community_vote_weight === 0}
      rows={rows}
    />
  )
}
