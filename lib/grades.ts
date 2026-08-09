// OXXOVO verified_score (0~100) → grade label.
// 7단계 — 점수가 갈수록 진짜 고수가 나올 때 변별력 확보 (TK 2026-05-23 결정).
// 룰북 v2.3 정식화는 oxxovo-scoring 레포에서 진행 예정.

export type Grade =
  | 'LEGENDARY'
  | 'MASTERPIECE'
  | 'EXCELLENT'
  | 'SKILLED'
  | 'AVERAGE'
  | 'ADEQUATE'
  | 'NEEDS_WORK'

export function deriveGrade(verifiedScore: number | null | undefined): Grade | null {
  if (verifiedScore == null) return null
  if (verifiedScore >= 95) return 'LEGENDARY'
  if (verifiedScore >= 90) return 'MASTERPIECE'
  if (verifiedScore >= 80) return 'EXCELLENT'
  if (verifiedScore >= 70) return 'SKILLED'
  if (verifiedScore >= 60) return 'AVERAGE'
  if (verifiedScore >= 50) return 'ADEQUATE'
  return 'NEEDS_WORK'
}

export const GRADE_LABEL_KO: Record<Grade, string> = {
  LEGENDARY: '전설',
  MASTERPIECE: '명작',
  EXCELLENT: '우수',
  SKILLED: '숙련',
  AVERAGE: '평균',
  ADEQUATE: '보통',
  NEEDS_WORK: '미흡',
}

export const GRADE_LABEL_EN: Record<Grade, string> = {
  LEGENDARY: 'Legendary',
  MASTERPIECE: 'Masterpiece',
  EXCELLENT: 'Excellent',
  SKILLED: 'Skilled',
  AVERAGE: 'Average',
  ADEQUATE: 'Adequate',
  NEEDS_WORK: 'Needs Work',
}

// Tailwind 색상 클래스 — admin UI badge용.
export const GRADE_BADGE_CLASS: Record<Grade, string> = {
  LEGENDARY: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black',
  MASTERPIECE: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  EXCELLENT: 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white',
  SKILLED: 'bg-emerald-500 text-white',
  AVERAGE: 'bg-white/15 text-white/80',
  ADEQUATE: 'bg-white/10 text-white/60',
  NEEDS_WORK: 'bg-white/5 text-white/40',
}

export type IntegrityConfidence = 'none' | 'low' | 'medium' | 'high'

export type IntegrityRecommendation = 'reject' | 'review' | 'accept'

// Integrity recommendation 별 색깔 — admin이 즉시 인지.
export const INTEGRITY_REC_BADGE_CLASS: Record<IntegrityRecommendation, string> = {
  reject: 'bg-red-500/20 text-red-300 border border-red-500/40',
  review: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  accept: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
}

export const INTEGRITY_REC_LABEL_KO: Record<IntegrityRecommendation, string> = {
  // ★'탈락' is on the forbidden list (2026-08-08). This label is admin-only, but
  // the word leaks into how operators write to participants, which is how it got
  // into an email in the first place. '미진출' states the outcome without
  // pronouncing a verdict -- see the Korean copy rule.
  reject: '미진출 권장',
  review: '확인 후 판단 권장',
  accept: '통과 권장',
}

export const INTEGRITY_REC_LABEL_EN: Record<IntegrityRecommendation, string> = {
  reject: 'Reject',
  review: 'Review',
  accept: 'Accept',
}

export const INTEGRITY_CONFIDENCE_LABEL_KO: Record<IntegrityConfidence, string> = {
  none: '정상',
  low: '약간 의심',
  medium: '의심',
  high: '명백한 의심',
}

export const INTEGRITY_CONFIDENCE_LABEL_EN: Record<IntegrityConfidence, string> = {
  none: 'Normal',
  low: 'Slight Suspicion',
  medium: 'Suspicious',
  high: 'Clear Suspicion',
}
