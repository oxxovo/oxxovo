// OXXOVO final_score — Layer-2 가중합산 (AI 점수 × 커뮤니티 투표).
//
// 가중치 레이어가 둘이라는 점이 핵심 (혼동 주의):
//   · Layer 1: intent/exec/orig/integrity 점수를 scoring_*_weight로 합산 →
//              verified_score. **oxxovo-scoring 레포가 이미 적용**해서 기록함.
//   · Layer 2 (이 파일): verified_score(=ai_score)와 community_score를
//              ai_score_weight / community_vote_weight로 합산 → final_score.
//   즉 여기서는 새 AI 채점을 하지 않고 기존 verified_score를 그대로 재사용.
//
// 적용 범위 = 본선(main)만 (TK 2026-06-04 결정). 예선 Top N 선정은 시즌과
// 무관하게 항상 순수 AI(verified_score) — 커뮤니티가 500명 예선을 1인1표로
// 투표할 수 없기 때문. 따라서 이 헬퍼는 round='main' 랭킹/표시에서만 호출.
//
// 가중치는 전적으로 seasons 행에서 읽음 — per-시즌 코드 분기 없음
// ([[feedback-no-hardcode]]). 시즌 4 전환 = 코드 변경 0, DB 값만 변경.
//   · 시즌 0~3 (Soak): community_vote_weight = 0 → final == ai_score.
//   · 시즌 4+        : community_vote_weight = 0.7 → AI 30% + 커뮤니티 70%.
//
// 불변식: ai_score_weight + community_vote_weight = 1 (DB CHECK +
// season-schema.ts Zod refine로 이중 보장). 이 함수는 그 불변식을 신뢰.

type ScoreWeights = {
  ai_score_weight: number
  community_vote_weight: number
}

/**
 * 본선 최종 점수 = ai_score × ai_weight + community_score × community_weight.
 *
 * @param aiScore        scoring_results.verified_score (round='main'). 미채점 시 null.
 * @param communityScore 커뮤니티 투표 정규화 점수(0~100, 시즌 4+). Soak 모드엔 미존재 → null.
 * @param season         가중치를 가진 시즌 행 (seasons 테이블).
 * @returns final_score. 계산 불가 시 null (랭킹 제외 신호).
 */
export function computeFinalScore(
  aiScore: number | null | undefined,
  communityScore: number | null | undefined,
  season: ScoreWeights,
): number | null {
  // AI 점수가 없으면 본선 채점 자체가 안 끝난 것 → 랭킹 불가.
  if (aiScore == null) return null

  // Soak 모드 (community_vote_weight = 0): final은 순수 AI 점수.
  // 불변식상 ai_score_weight = 1 이므로 aiScore × 1 = aiScore. 커뮤니티 투표가
  // 아직 없으므로 communityScore가 null이어도 여기서 요구하지 않음 (× 0).
  if (season.community_vote_weight === 0) {
    return aiScore * season.ai_score_weight
  }

  // 커뮤니티 가중 시즌 (4+): 두 성분 모두 필요. 투표 집계 전이면 최종 점수는
  // 아직 확정 불가 → null (votes pending). 이로써 미집계 상태가 0점으로
  // 둔갑해 순위를 왜곡하는 일을 방지.
  if (communityScore == null) return null

  return (
    aiScore * season.ai_score_weight +
    communityScore * season.community_vote_weight
  )
}
