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
// ([[feedback-no-hardcode]]). 가중치 전환 = 코드 변경 0, DB 값만 변경.
//
// ★2026-08-06 TK 확정: season_0 도 community_vote_weight = 0.5 다.
//   "시즌 0 = Soak = weight 0" 은 **더 이상 참이 아니다.** 시즌0부터 AI 50 +
//   커뮤니티 50 으로 간다(vote 창 11/12~11/15). 아래 weight=0 분기는 코드에서
//   지우지 않는다 — 파트너 시즌이나 향후 시즌이 0 을 쓸 수 있고, 그 경우를
//   지우면 다시 하드코딩이 된다. 다만 **현재 어느 공식 시즌도 0 이 아니다.**
//
// ★★두 층을 섞지 말 것 (이 파일이 갈리는 자리):
//   Layer 1  scoring_*_weight = 25/45/20/10  → AI 점수 **내부** 배분
//   Layer 2  community_vote_weight = 0.5     → AI 50 / 관객 50 **상위** 층
//   "관객이 45%" 로 읽으면 두 층을 겹쳐 본 것이다.
//
// ★weight > 0 이면 커뮤니티 집계가 **실제로 존재해야** final_score 가 나온다.
//   없으면 null = 랭킹 제외 — 미집계가 0점으로 둔갑하는 것을 막기 위한 설계다.
//   ★그 결과 아무도 투표하지 않으면 **본선 랭킹 전체가 비고 시상 대상이 0** 이 된다.
//   weight 0 시절에는 없던 상태다. 시상 게이트는 "투표 창이 닫혔는가" 만 보고
//   "집계가 있는가" 는 안 본다 — 별건으로 보고됨(2026-08-06).
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

/**
 * 커뮤니티 투표 원표수 → 정규화 점수 (0~100). 최다득표작 대비 비율 (B안,
 * TK 2026-07-12): communityScore = votes / maxVotes × 100.
 *
 * @param votes    이 영상의 원표수 (watch_votes, round='main').
 * @param maxVotes 본선 진출작 중 최다 득표수.
 * @returns 0~100. 아무도 투표 안 함(maxVotes <= 0) → null = "votes pending"
 *          (computeFinalScore가 null로 랭킹 제외; 미집계가 0점으로 둔갑 방지).
 *          투표가 있었고 이 영상만 0표면 0 (실제 0점, null 아님).
 *
 * AI verified_score(0~100)와 같은 척도라 Layer-2에서 그대로 가중합산 가능.
 * 시즌0(community_vote_weight=0)에선 computeFinalScore가 이 값을 무시(× 0).
 */
export function computeCommunityScore(votes: number, maxVotes: number): number | null {
  if (maxVotes <= 0) return null
  return (votes / maxVotes) * 100
}
