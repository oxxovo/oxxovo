'use server'

import { revalidatePath } from 'next/cache'
import { getAdminOrNull, requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getSeasonById, type Season } from '@/lib/seasons'
import { computeFinalScore } from '@/lib/scoring'
import {
  sendSelectedTop50,
  sendNotSelected,
  sendAwardedContactRequest,
} from '@/lib/email/send'

export type AdminActionState = {
  ok: boolean
  messageKey?: 'notes_saved' | 'status_saved' | 'award_saved'
  errorMessage?: string
}

// Admin-writable subset of genesis_applications.status (8 of 9 DB values).
//
// DB CHECK constraint has 9 values total — 'main_round_submitted' is intentionally
// EXCLUDED from this admin-writable list because that status must only be reached
// through the user's own saveMainRoundSubmission server action (single-submission
// model — see [[project-main-round-single-submission]]). Allowing admins to set
// it manually would let an admin manufacture submission state without an actual
// video URL, which would violate the single-submission business essence.
//
// 'verifying' / 'flagged' / 'eligible' are set automatically by the oxxovo-scoring
// system based on Triple-AI judgment and integrity confidence. 'selected' /
// 'awarded' / 'rejected' are set manually by admins. 'flagged' (added 2026-05-27)
// is the parking spot for high-confidence integrity suspicions — admin must
// review and transition to 'eligible' (pass) or 'rejected' (disqualify).
const ALLOWED_STATUS = [
  'pending',
  'waitlist',
  'verifying',
  'flagged',
  'eligible',
  'selected',
  'awarded',
  'rejected',
] as const
type AppStatus = (typeof ALLOWED_STATUS)[number]

export async function saveAdminNotes(id: string, notes: string): Promise<AdminActionState> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('genesis_applications')
    .update({ admin_notes: notes })
    .eq('id', id)
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath(`/admin/applications/${id}`)
  return { ok: true, messageKey: 'notes_saved' }
}

export async function saveStatus(id: string, status: string): Promise<AdminActionState> {
  await requireAdmin()
  if (!ALLOWED_STATUS.includes(status as AppStatus)) {
    return { ok: false, errorMessage: `Invalid status: ${status}` }
  }
  const supabase = await createSupabaseServer()
  // `.select().single()` returns the updated row, including email/country/
  // creator_name/season_id, which the email helpers need.
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update({ status })
    .eq('id', id)
    .select('id, email, country, creator_name, season_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)

  // Side-effect: fire status-change notifications. Per automation philosophy,
  // there is no separate "Send email" admin button — the email IS the action.
  // Dedup in executeSend() prevents double-sends if the same status is saved
  // twice. Errors do not roll back the status change.
  if (status === 'selected' || status === 'rejected') {
    try {
      const season = await getSeasonById(row.season_id)
      if (!season) {
        console.error('[saveStatus] season missing — skipping email', row.season_id)
      } else if (status === 'selected') {
        await sendSelectedTop50({
          toEmail: row.email,
          country: row.country,
          creatorName: row.creator_name,
          seasonName: season.display_name,
          topNAdvance: season.top_n_advance,
          mainRoundStartAt: season.main_round_start_at,
          applicationId: row.id,
          seasonId: season.id,
        })
      } else {
        await sendNotSelected({
          toEmail: row.email,
          country: row.country,
          creatorName: row.creator_name,
          seasonName: season.display_name,
          applicationId: row.id,
          seasonId: season.id,
        })
      }
    } catch (e) {
      console.error('[saveStatus] email send error:', e)
    }
  }

  return { ok: true, messageKey: 'status_saved' }
}

export async function saveAwardRank(
  id: string,
  rank: number | null,
): Promise<AdminActionState> {
  await requireAdmin()
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
    return { ok: false, errorMessage: 'Award rank must be 1-99 or null' }
  }
  const supabase = await createSupabaseServer()
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update({ award_rank: rank })
    .eq('id', id)
    .select('id, email, country, creator_name, season_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  revalidatePath('/admin/contacts')

  // Auto-fire the prize payout request the moment a top-3 rank is set.
  // Dedup ensures re-saving the same rank (or toggling away and back) does
  // not re-trigger the email.
  if (rank === 1 || rank === 2 || rank === 3) {
    const season = await getSeasonById(row.season_id)
    if (season) await fireAwardPayoutEmail(row, rank, season)
    else console.error('[saveAwardRank] season missing — skipping email', row.season_id)
  }

  return { ok: true, messageKey: 'award_saved' }
}

// 본선 수상 1/2/3위 확정 시 상금 지급 요청 이메일 발사 (executeSend dedup 안전).
// saveAwardRank / saveAwardOverride / approveTop3Awards 공통 — 중복 제거.
async function fireAwardPayoutEmail(
  row: { id: string; email: string; country: string; creator_name: string },
  rank: 1 | 2 | 3,
  season: Season,
) {
  try {
    const prize =
      rank === 1 ? season.prize_first : rank === 2 ? season.prize_second : season.prize_third
    const extras = season.award_prizes[String(rank)] ?? {}
    await sendAwardedContactRequest({
      toEmail: row.email,
      country: row.country,
      creatorName: row.creator_name,
      seasonName: season.display_name,
      awardRank: rank,
      prizeAmountUsd: prize,
      extras,
      applicationId: row.id,
      seasonId: season.id,
    })
  } catch (e) {
    console.error('[fireAwardPayoutEmail] email send error:', e)
  }
}

// ─── applyRecommendation (작업 6) ───────────────────────────────────────
// Apply Recommendation (1.5) 모델 — admin이 추천 결과를 검토 후 1회 클릭으로
// 일괄 적용. PostgreSQL RPC apply_season_recommendations로 atomic 보장.
// 이메일 발송은 Promise.allSettled로 병렬 (executeSend dedup 안전).

export type ApplyRecommendationInput = { seasonId: string }

export type ApplyRecommendationError =
  | 'unauthorized'
  | 'season_not_found'
  | 'no_recommendations'
  | 'race_or_already_applied'
  | 'update_failed'

export type ApplyRecommendationResult =
  | {
      ok: true
      selectedCount: number
      rejectedCount: number
      emailsSent: number
      emailsFailed: number
    }
  | { ok: false; error: ApplyRecommendationError; detail?: string }

export async function applyRecommendation(
  input: ApplyRecommendationInput,
): Promise<ApplyRecommendationResult> {
  // 1. 인증 — getAdminOrNull로 server action 안전 (redirect 회피)
  const adminProfile = await getAdminOrNull()
  if (!adminProfile) return { ok: false, error: 'unauthorized' }

  // 2. 시즌 검증
  const season = await getSeasonById(input.seasonId)
  if (!season) return { ok: false, error: 'season_not_found' }

  // 3. RPC apply_season_recommendations — SQL 차원 transaction + FOR UPDATE 락
  const admin = createSupabaseAdmin()
  const { data: rpcData, error: rpcErr } = await admin.rpc(
    'apply_season_recommendations',
    { p_season_id: input.seasonId, p_admin_email: adminProfile.email },
  )

  if (rpcErr) {
    const msg = rpcErr.message ?? ''
    console.error('[applyRecommendation] RPC failed:', rpcErr.code, msg)
    if (msg.includes('no_recommendations')) {
      return { ok: false, error: 'no_recommendations' }
    }
    if (msg.includes('race_or_already_applied')) {
      return { ok: false, error: 'race_or_already_applied' }
    }
    return { ok: false, error: 'update_failed', detail: msg }
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData
  const selectedCount = Number(result?.selected_count ?? 0)
  const rejectedCount = Number(result?.rejected_count ?? 0)

  // 4. 이메일 발송 대상 패치 — 이번 시즌의 selected/rejected.
  //    dedup으로 중복 발송 안 됨. RPC 직후라 이번 적용된 사람들이 대상.
  const [selRes, rejRes] = await Promise.all([
    admin
      .from('genesis_applications')
      .select('id, email, creator_name, country')
      .eq('season_id', input.seasonId)
      .eq('status', 'selected'),
    admin
      .from('genesis_applications')
      .select('id, email, creator_name, country')
      .eq('season_id', input.seasonId)
      .eq('status', 'rejected'),
  ])

  const selectedApps = selRes.data ?? []
  const rejectedApps = rejRes.data ?? []

  // 5. Promise.allSettled 병렬 발송. 부분 실패 허용 (executeSend가 email_logs 기록).
  const emailPromises = [
    ...selectedApps.map((a) =>
      sendSelectedTop50({
        toEmail: a.email,
        country: a.country,
        creatorName: a.creator_name,
        seasonName: season.display_name,
        topNAdvance: season.top_n_advance,
        mainRoundStartAt: season.main_round_start_at,
        applicationId: a.id,
        seasonId: season.id,
      }),
    ),
    ...rejectedApps.map((a) =>
      sendNotSelected({
        toEmail: a.email,
        country: a.country,
        creatorName: a.creator_name,
        seasonName: season.display_name,
        applicationId: a.id,
        seasonId: season.id,
      }),
    ),
  ]
  const emailResults = await Promise.allSettled(emailPromises)
  let emailsSent = 0
  let emailsFailed = 0
  for (const r of emailResults) {
    if (r.status === 'fulfilled') emailsSent++
    else emailsFailed++
  }

  // 6. 캐시 무효화
  revalidatePath('/admin/applications')

  return { ok: true, selectedCount, rejectedCount, emailsSent, emailsFailed }
}
// requireAdmin import는 saveAdminNotes/saveStatus/saveAwardRank에서 그대로 사용 중.

// ─── 본선 수상 (옵션 3: AI 자동 랭킹 + admin 최종 승인) ──────────────────
// 모델: AI 채점 100% 자동(verified_score), 본체가 Layer-2 final_score로 랭킹,
// admin은 검토 후 승인(상위 3 → award_rank 1/2/3) 또는 부정/오류 시 override.
// 랭킹은 항상 서버에서 권위있게 재계산 — 클라이언트가 보낸 순서를 신뢰하지 않음.

type MainRoundRanked = {
  app: {
    id: string
    email: string
    country: string
    creator_name: string
    award_rank: number | null
  }
  finalScore: number
}

async function rankMainRound(
  seasonId: string,
): Promise<{ season: Season; ranked: MainRoundRanked[] } | null> {
  const season = await getSeasonById(seasonId)
  if (!season) return null

  const supabase = await createSupabaseServer()
  const [appsRes, scoringRes] = await Promise.all([
    supabase
      .from('genesis_applications')
      .select('id, email, country, creator_name, award_rank, main_round_submitted_at')
      .eq('season_id', seasonId)
      .not('main_round_submitted_at', 'is', null),
    supabase
      .from('scoring_results')
      .select('application_id, verified_score, judged_status')
      .eq('season_id', seasonId)
      .eq('round', 'main'),
  ])

  // 채점 완료(completed)된 것만 verified_score 인정 — 진행 중/실패는 랭킹 제외.
  const scoreByApp = new Map<string, number | null>()
  for (const s of scoringRes.data ?? []) {
    scoreByApp.set(s.application_id, s.judged_status === 'completed' ? s.verified_score : null)
  }

  const ranked: MainRoundRanked[] = (appsRes.data ?? [])
    .map((a) => ({
      app: {
        id: a.id,
        email: a.email,
        country: a.country,
        creator_name: a.creator_name,
        award_rank: a.award_rank,
      },
      // Layer-2: Soak 모드(community_vote_weight=0)에선 final === verified.
      finalScore: computeFinalScore(scoreByApp.get(a.id) ?? null, null, season),
    }))
    .filter((r): r is MainRoundRanked => r.finalScore != null)
    .sort((a, b) => b.finalScore - a.finalScore)

  return { season, ranked }
}

export type ApproveAwardsResult =
  | { ok: true; awardedCount: number }
  | {
      ok: false
      error: 'season_not_found' | 'no_scored_submissions' | 'update_failed'
      detail?: string
    }

// 승인 — 상위 3을 award_rank 1/2/3으로 자동 입력 + 상금 이메일 발사.
// 서버 재계산 랭킹 기준 (admin이 본 화면 순서가 아니라 DB 진실원천).
export async function approveTop3Awards(seasonId: string): Promise<ApproveAwardsResult> {
  await requireAdmin()
  const r = await rankMainRound(seasonId)
  if (!r) return { ok: false, error: 'season_not_found' }
  if (r.ranked.length === 0) return { ok: false, error: 'no_scored_submissions' }

  const supabase = await createSupabaseServer()
  const top3 = r.ranked.slice(0, 3)
  for (let i = 0; i < top3.length; i++) {
    const rank = (i + 1) as 1 | 2 | 3
    const { app } = top3[i]
    // status='awarded' 전이 = 시상 발표 활성화: profile WinnerCelebrationCard +
    // awards_announcement_at cron의 ResultsAnnounced 이메일이 이때 켜짐.
    const { error } = await supabase
      .from('genesis_applications')
      .update({ award_rank: rank, status: 'awarded' })
      .eq('id', app.id)
    if (error) return { ok: false, error: 'update_failed', detail: error.message }
    await fireAwardPayoutEmail(app, rank, r.season)
  }

  revalidatePath(`/admin/seasons/${seasonId}/main-results`)
  revalidatePath('/admin/applications')
  revalidatePath('/admin/contacts')
  return { ok: true, awardedCount: top3.length }
}

// override — 부정/표절/시스템 오류 시 admin이 수동으로 award_rank 수정 + 사유 기록.
// award_override_reason 전용 컬럼에 audit 근거 저장. rank=null = 수상 취소.
export async function saveAwardOverride(
  id: string,
  rank: number | null,
  reason: string,
): Promise<AdminActionState> {
  await requireAdmin()
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
    return { ok: false, errorMessage: 'Award rank must be 1-99 or null' }
  }
  const trimmed = reason.trim()
  if (!trimmed) {
    return { ok: false, errorMessage: 'Override reason is required' }
  }

  // 수상권(1/2/3)으로 override 시 status='awarded' 동반 전이(발표 활성화).
  // 수상 해제/순위 4+ 는 status를 건드리지 않음 — 실격은 기존 신청 관리 UI에서
  // 'rejected'로 별도 처리(override 사유는 이미 기록됨).
  const isWinner = rank === 1 || rank === 2 || rank === 3
  const update: {
    award_rank: number | null
    award_override_reason: string
    status?: string
  } = { award_rank: rank, award_override_reason: trimmed }
  if (isWinner) update.status = 'awarded'

  const supabase = await createSupabaseServer()
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update(update)
    .eq('id', id)
    .select('id, email, country, creator_name, season_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath(`/admin/seasons/${row.season_id}/main-results`)
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  revalidatePath('/admin/contacts')

  if (rank === 1 || rank === 2 || rank === 3) {
    const season = await getSeasonById(row.season_id)
    if (season) await fireAwardPayoutEmail(row, rank, season)
  }

  return { ok: true, messageKey: 'award_saved' }
}
