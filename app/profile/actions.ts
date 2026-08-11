'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
import { canSubmitMainRound, getSeasonById } from '@/lib/seasons'
import { validateVideoUrl } from '@/lib/video-url'
import { getMembershipState, isMembershipEnabled } from '@/lib/membership'
import { getStripe } from '@/lib/stripe'
import { getDisplayName, setDisplayName, validateNickname } from '@/lib/nickname'
import { sendSubmissionReceipts } from '@/lib/email/submission-receipts'
import type {
  MembershipDashboard,
  MembershipActionResult,
} from './membership-types'

// Public-site users authenticate via the @supabase/ssr cookie session
// ([[feedback-auth-pattern]]). Each action derives the caller's verified
// identity from getUserOrNull() (reads cookies), then touches the DB with the
// service-role client. Rows are matched by email until user_id backfill
// (Phase 6); afterwards by user_id = auth.uid().

export type ProfileApplication = {
  id: string
  season_id: string
  season_name: string
  season_number: number
  // Prize context — used by the winner celebration card on /profile to show
  // the actual dollar amount the awarded rank earns for this specific season.
  season_total_prize_pool: number
  season_prize_first: number
  season_prize_second: number
  season_prize_third: number
  creator_name: string
  email: string
  country: string | null
  channel_url: string | null
  free_entry_url: string | null
  ai_service: string | null
  creator_statement: string | null
  status: string
  award_rank: number | null
  winner_phone: string | null
  winner_address: string | null
  winner_messenger: string | null
  winner_info_completed_at: string | null
  created_at: string
  // Main round submission (2026-05-29) — single-submission model.
  // Season's main_round_* schedule + theme are fetched separately via
  // getSeasonById(currentApp.season_id) on the client.
  main_round_video_url: string | null
  main_round_submitted_at: string | null
}

export type ProfileData = {
  email: string
  applications: ProfileApplication[]
}

type LoadResult =
  | { ok: true; data: ProfileData }
  | { ok: false; error: 'unauthenticated' | 'load_failed'; detail?: string }

export async function loadProfileData(): Promise<LoadResult> {
  // Identity from the verified cookie session.
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }
  const admin = createSupabaseAdmin()

  // getUserOrNull lowercases the email. The public /apply form saves whatever
  // the applicant typed, so we match case-insensitively (ilike) to find rows
  // like "HelloVegas@gmail.com" from a lowercase session email.
  const email = user.email

  const { data, error: queryErr } = await admin
    .from('genesis_applications')
    .select(
      'id, season_id, creator_name, email, country, channel_url, free_entry_url, ai_service, creator_statement, status, award_rank, winner_phone, winner_address, winner_messenger, winner_info_completed_at, created_at, main_round_video_url, main_round_submitted_at, seasons(name, season_number, total_prize_pool, prize_first, prize_second, prize_third)',
    )
    .ilike('email', email)
    .order('created_at', { ascending: false })

  if (queryErr) {
    return { ok: false, error: 'load_failed', detail: queryErr.message }
  }

  type SeasonRow = {
    name: string
    season_number: number
    total_prize_pool: number
    prize_first: number
    prize_second: number
    prize_third: number
  }
  type Row = {
    id: string
    season_id: string
    creator_name: string
    email: string
    country: string | null
    channel_url: string | null
    free_entry_url: string | null
    ai_service: string | null
    creator_statement: string | null
    status: string
    award_rank: number | null
    winner_phone: string | null
    winner_address: string | null
    winner_messenger: string | null
    winner_info_completed_at: string | null
    created_at: string
    main_round_video_url: string | null
    main_round_submitted_at: string | null
    // Supabase types the FK join as an array even for many-to-one relations.
    seasons: SeasonRow[] | SeasonRow | null
  }

  const applications: ProfileApplication[] = (data ?? []).map((r: Row) => {
    const seasonObj = Array.isArray(r.seasons) ? r.seasons[0] : r.seasons
    return {
      id: r.id,
      season_id: r.season_id,
      season_name: seasonObj?.name ?? '—',
      season_number: seasonObj?.season_number ?? 0,
      season_total_prize_pool: Number(seasonObj?.total_prize_pool ?? 0),
      season_prize_first: Number(seasonObj?.prize_first ?? 0),
      season_prize_second: Number(seasonObj?.prize_second ?? 0),
      season_prize_third: Number(seasonObj?.prize_third ?? 0),
      creator_name: r.creator_name,
      email: r.email,
      country: r.country,
      channel_url: r.channel_url,
      free_entry_url: r.free_entry_url,
      ai_service: r.ai_service,
      creator_statement: r.creator_statement,
      status: r.status,
      award_rank: r.award_rank,
      winner_phone: r.winner_phone,
      winner_address: r.winner_address,
      winner_messenger: r.winner_messenger,
      winner_info_completed_at: r.winner_info_completed_at,
      created_at: r.created_at,
      main_round_video_url: r.main_round_video_url,
      main_round_submitted_at: r.main_round_submitted_at,
    }
  })

  return { ok: true, data: { email, applications } }
}

export type SaveWinnerInfoInput = {
  applicationId: string
  phone: string
  address: string
  messenger?: string
}

type SaveResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'phone_required'
        | 'address_required'
        | 'not_found'
        | 'not_owner'
        | 'not_awarded'
        | 'save_failed'
      detail?: string
    }

export async function saveWinnerInfo(input: SaveWinnerInfoInput): Promise<SaveResult> {
  // 1. Verify the caller via their cookie session.
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }
  // getUserOrNull lowercases; the form-submitted email may not be — match
  // case-insensitively.
  const callerEmail = user.email
  const admin = createSupabaseAdmin()

  // 2. Basic validation.
  const phone = (input.phone ?? '').trim()
  const address = (input.address ?? '').trim()
  const messenger = (input.messenger ?? '').trim()
  if (phone.length < 3) return { ok: false, error: 'phone_required' }
  if (address.length < 3) return { ok: false, error: 'address_required' }

  // 3. Verify the targeted row is theirs AND in 'awarded' state.
  //    Looking up by row id (not email) prevents accidental cross-season writes
  //    when one applicant is awarded in multiple seasons.
  const { data: row, error: lookupErr } = await admin
    .from('genesis_applications')
    .select('id, email, status')
    .eq('id', input.applicationId)
    .single()
  if (lookupErr || !row) return { ok: false, error: 'not_found' }
  if ((row.email ?? '').toLowerCase() !== callerEmail) {
    return { ok: false, error: 'not_owner' }
  }
  if (row.status !== 'awarded') return { ok: false, error: 'not_awarded' }

  // 4. Update.
  const { error: updateErr } = await admin
    .from('genesis_applications')
    .update({
      winner_phone: phone,
      winner_address: address,
      winner_messenger: messenger || null,
      winner_info_completed_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)

  if (updateErr) return { ok: false, error: 'save_failed', detail: updateErr.message }

  // 5. Invalidate admin cache so /admin/contacts reflects the new info on next visit.
  revalidatePath('/admin/contacts')
  revalidatePath(`/admin/applications/${input.applicationId}`)
  revalidatePath('/admin/applications')

  return { ok: true }
}

// ─── Creator nickname ────────────────────────────────────────────────────
// Account-level display name shown on Watch (submissions/comments/likes). Auto
// at first use; editable here. Never the email.

// Owner-only scores: a participant sees their OWN scores (prelim + main),
// including the AI critique, but NOT integrity fields (anti-gaming). Prelim
// scores are never public -- this is the only place a participant sees them.
export type MyRoundScore = {
  round: 'application' | 'main'
  verifiedScore: number | null
  grade: string | null
  intent: number | null
  execution: number | null
  originality: number | null
  ai: { name: string; strengths: string[]; weaknesses: string[]; summary: string }[]
}

function parseAi(raw: unknown): MyRoundScore['ai'] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const labels: [string, string][] = [['claude', 'Claude'], ['gpt', 'GPT'], ['gemini', 'Gemini']]
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const out: MyRoundScore['ai'] = []
  for (const [key, name] of labels) {
    const o = obj[key] as Record<string, unknown> | undefined
    if (!o || typeof o !== 'object') continue
    out.push({
      name,
      strengths: arr(o.strengths),
      weaknesses: arr(o.weaknesses),
      summary: typeof o.aiSummary === 'string' ? o.aiSummary : '',
    })
  }
  return out
}

// Loads the caller's completed scores for their most recent application.
export async function loadMyScores(): Promise<MyRoundScore[]> {
  const user = await getUserOrNull()
  if (!user) return []
  const admin = createSupabaseAdmin()

  // Most recent application owned by this caller (email match until user_id backfill).
  const { data: app } = await admin
    .from('genesis_applications')
    .select('id, created_at')
    .ilike('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!app) return []

  const { data } = await admin
    .from('scoring_results')
    .select(
      'round, verified_score, grade, consensus_intent, consensus_execution, consensus_originality, ai_outputs, judged_status',
    )
    .eq('application_id', app.id)
    .eq('judged_status', 'completed')

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    round: r.round as 'application' | 'main',
    verifiedScore: (r.verified_score as number | null) ?? null,
    grade: (r.grade as string | null) ?? null,
    intent: (r.consensus_intent as number | null) ?? null,
    execution: (r.consensus_execution as number | null) ?? null,
    originality: (r.consensus_originality as number | null) ?? null,
    ai: parseAi(r.ai_outputs),
  }))
}

export async function loadDisplayName(): Promise<string | null> {
  const user = await getUserOrNull()
  if (!user) return null
  return getDisplayName(user.id, user.email)
}

export type SaveNicknameResult =
  | { ok: true; value: string }
  | { ok: false; error: 'unauthenticated' | 'too_short' | 'too_long' | 'invalid_chars' | 'failed' }

export async function saveDisplayName(value: string): Promise<SaveNicknameResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }
  const v = validateNickname(value)
  if (!v.ok) return { ok: false, error: v.error }
  try {
    await setDisplayName(user.id, user.email, v.value)
    return { ok: true, value: v.value }
  } catch (e) {
    // setDisplayName now throws instead of silently doing nothing, so this
    // branch is reachable and the user sees a real failure.
    console.error('[profile] nickname save failed', { userId: user.id, error: String(e) })
    return { ok: false, error: 'failed' }
  }
}

// ─── SMS opt-in (A2P 10DLC / TCPA) ──────────────────────────────────────
// /profile 의 선택 전화번호 + SMS 수신 동의. TCPA 는 동의 증거(시각/IP/고지문구)
// 보관을 요구하므로 opt-in 시 sms_consent_at/ip/text 를 함께 기록한다. 동의는
// 서비스 이용 조건이 아니므로 전부 선택. 발신 파이프라인(Twilio)은 별개 후속.

// 화면 체크박스 옆에 표시하는 고지 문구. opt-in 시 이 문구 스냅샷을 저장한다
// (감사: "사용자가 정확히 무엇에 동의했는가"). 클라이언트 카피와 반드시 일치.
// 'use server' 모듈은 async 함수만 export 가능 -> 모듈 내부 상수(비export)로 둔다.
const SMS_CONSENT_DISCLOSURE =
  'I agree to receive recurring SMS text messages from OXXOVO about tournament updates (round openings, deadlines, results). Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of using OXXOVO.'

export type SmsConsentData = {
  phone: string
  optIn: boolean
  consentAt: string | null
}

// Read the current cookie user's SMS preferences for the /profile card.
export async function loadSmsConsent(): Promise<
  { ok: true; data: SmsConsentData } | { ok: false }
> {
  const user = await getUserOrNull()
  if (!user) return { ok: false }
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('phone, sms_opt_in, sms_consent_at')
    .eq('id', user.id)
    .maybeSingle()
  return {
    ok: true,
    data: {
      phone: (data?.phone as string | null) ?? '',
      optIn: Boolean(data?.sms_opt_in),
      consentAt: (data?.sms_consent_at as string | null) ?? null,
    },
  }
}

export type SaveSmsConsentInput = { phone: string; optIn: boolean }
export type SaveSmsConsentResult =
  | { ok: true; optIn: boolean; consentAt: string | null }
  | {
      ok: false
      error: 'unauthenticated' | 'phone_required' | 'phone_invalid' | 'save_failed'
      detail?: string
    }

// Best-effort caller IP for the consent record (proxy sets x-forwarded-for).
async function callerIp(): Promise<string | null> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const first = fwd ? fwd.split(',')[0].trim() : ''
    return first || h.get('x-real-ip') || null
  } catch {
    return null
  }
}

export async function saveSmsConsent(
  input: SaveSmsConsentInput,
): Promise<SaveSmsConsentResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const phone = (input.phone ?? '').trim()

  // Opt-in requires a plausible phone. Lenient international check: optional '+'
  // then 7-15 digits after stripping spaces/().-. Blocks junk without rejecting
  // legitimate international formats.
  if (input.optIn) {
    if (!phone) return { ok: false, error: 'phone_required' }
    const normalized = phone.replace(/[\s()\-.]/g, '')
    if (!/^\+?[1-9]\d{6,14}$/.test(normalized)) {
      return { ok: false, error: 'phone_invalid' }
    }
  }

  const now = new Date().toISOString()
  const admin = createSupabaseAdmin()

  const update: Record<string, unknown> = { phone: phone || null }
  if (input.optIn) {
    // Record the consent proof (TCPA): when, from where, and exactly what text.
    update.sms_opt_in = true
    update.sms_consent_at = now
    update.sms_consent_ip = await callerIp()
    update.sms_consent_text = SMS_CONSENT_DISCLOSURE
    update.sms_opt_out_at = null
  } else {
    // Withdraw consent (equivalent to STOP). Keep the historical consent_* fields
    // as the audit trail; just stamp the opt-out time.
    update.sms_opt_in = false
    update.sms_opt_out_at = now
  }

  const { error } = await admin.from('profiles').update(update).eq('id', user.id)
  if (error) return { ok: false, error: 'save_failed', detail: error.message }

  return { ok: true, optIn: input.optIn, consentAt: input.optIn ? now : null }
}

// ─── Email opt-out (season/tournament announcement emails) ──────────────
// The consent itself is recorded at signup (app/login/actions.ts
// recordEmailConsent, see app/privacy Section 11 / app/terms Section 12) --
// this card only lets the user WITHDRAW it. There is no opt back in from
// here deliberately: re-consent needs the same evidence trail (timestamp +
// IP + notice text) that signup produces, and this card cannot show that
// notice again outside the signup flow. A user who changes their mind signs
// out and logs back in.

export type EmailConsentData = { optIn: boolean; consentAt: string | null }

export async function loadEmailConsent(): Promise<
  { ok: true; data: EmailConsentData } | { ok: false }
> {
  const user = await getUserOrNull()
  if (!user) return { ok: false }
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('email_opt_in, email_consent_at')
    .eq('id', user.id)
    .maybeSingle()
  return {
    ok: true,
    data: {
      optIn: Boolean(data?.email_opt_in),
      consentAt: (data?.email_consent_at as string | null) ?? null,
    },
  }
}

export type UnsubscribeEmailResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'save_failed'; detail?: string }

export async function unsubscribeEmail(): Promise<UnsubscribeEmailResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('profiles')
    .update({ email_opt_in: false, email_opt_out_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { ok: false, error: 'save_failed', detail: error.message }

  revalidatePath('/profile')
  return { ok: true }
}

// ─── saveMainRoundSubmission ────────────────────────────────────────────
// Single-submission model ([[project-main-round-single-submission]]) — one
// video, no edits. Race-safe via UPDATE WHERE status='selected'.
// Score columns are NEVER touched here ([[project-scoring-integrity-rules]]).

export type SaveMainRoundSubmissionInput = {
  applicationId: string
  videoUrl: string
}

export type MainRoundSubmissionError =
  | 'unauthenticated'
  | 'not_found'
  | 'not_owner'
  | 'season_not_found'
  | 'not_selected'
  | 'season_dates_not_set'
  | 'before_start'
  | 'after_close'
  | 'video_url_required'
  | 'video_url_invalid'
  | 'video_url_not_allowed'
  | 'race_or_already_submitted'
  | 'save_failed'

export type SaveMainRoundSubmissionResult =
  | { ok: true }
  | { ok: false; error: MainRoundSubmissionError; detail?: string }

export async function saveMainRoundSubmission(
  input: SaveMainRoundSubmissionInput,
): Promise<SaveMainRoundSubmissionResult> {
  // 1. cookie session verify
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }
  const callerEmail = user.email
  const admin = createSupabaseAdmin()

  // 2. fetch application (by row id — same case-insensitive treatment as saveWinnerInfo)
  const { data: row, error: lookupErr } = await admin
    .from('genesis_applications')
    .select('id, email, status, season_id')
    .eq('id', input.applicationId)
    .single()
  if (lookupErr || !row) {
    return { ok: false, error: 'not_found', detail: lookupErr?.message }
  }

  // 3. ownership
  if ((row.email ?? '').toLowerCase() !== callerEmail) {
    return { ok: false, error: 'not_owner' }
  }

  // 4. fetch season
  const season = await getSeasonById(row.season_id)
  if (!season) {
    return { ok: false, error: 'season_not_found' }
  }

  // 5. business gate — canSubmitMainRound (single source of truth, client/server 동일)
  const check = canSubmitMainRound({ status: row.status }, season)
  if (!check.ok) {
    if (check.reason === 'not_selected') return { ok: false, error: 'not_selected' }
    if (check.reason === 'before_start') return { ok: false, error: 'before_start' }
    if (check.reason === 'after_close') return { ok: false, error: 'after_close' }
    if (check.reason === 'season_dates_not_set') {
      return { ok: false, error: 'season_dates_not_set' }
    }
    // reason === null → already main_round_submitted / awarded / rejected / flagged
    return { ok: false, error: 'race_or_already_submitted' }
  }

  // 6. URL validation — same lib/video-url.ts helper as client (single source of truth)
  const validation = validateVideoUrl(input.videoUrl, season.allowed_video_platforms)
  if (!validation.valid) {
    if (validation.error === 'empty') return { ok: false, error: 'video_url_required' }
    if (validation.error === 'unknown_platform') {
      return { ok: false, error: 'video_url_invalid' }
    }
    return { ok: false, error: 'video_url_not_allowed' }
  }

  // 7. UPDATE atomic with race guard — second concurrent submit returns 0 rows.
  //    PGRST116 = "no rows from .single()" → race lost or already submitted.
  const { data: updated, error: updateErr } = await admin
    .from('genesis_applications')
    .update({
      status: 'main_round_submitted',
      main_round_video_url: input.videoUrl,
      main_round_submitted_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)
    .eq('status', 'selected')
    .select('id')
    .single()

  if (updateErr || !updated) {
    if (updateErr?.code === 'PGRST116') {
      return { ok: false, error: 'race_or_already_submitted' }
    }
    return { ok: false, error: 'save_failed', detail: updateErr?.message }
  }

  // 8. revalidate admin caches
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${input.applicationId}`)

  // ⑪ -- the receipt for a main-round submission, sent from the act that
  // produced it. Awaited, and never able to fail the submission: the row is
  // already committed by the CAS above, so a mail error is logged and the
  // email-tick sweep retries it. The Studio paths reach the same function from
  // app/studio/actions.
  try {
    await sendSubmissionReceipts({ season, applicationId: input.applicationId })
  } catch (e) {
    console.error(
      '[profile] main-round receipt failed (non-fatal):',
      e instanceof Error ? e.message : String(e),
    )
  }

  return { ok: true }
}

// ─── P4d: membership dashboard + cancel/resume ──────────────────────────────
// /profile membership card. Display reuses the P1 classifier (single source of
// truth for expiry/access); cancel/resume nudge Stripe and the P4c webhook
// reconciles profiles. dark launch: actions fail-closed on membership_enabled,
// and the dashboard's `show` is false for non-members so the card is invisible.

const DASHBOARD_HIDDEN: MembershipDashboard = {
  show: false,
  tier: 'general',
  status: 'none',
  source: null,
  expiresAt: null,
  cancelAtPeriodEnd: false,
  isFounding: false,
  foundingNumber: null,
  canManageStripe: false,
}

// Read the current cookie user's membership snapshot for the /profile card.
// Returns a hidden dashboard when signed out or when there is no membership
// signal (so dark launch / general members render nothing).
export async function loadMembershipDashboard(): Promise<MembershipDashboard> {
  const user = await getUserOrNull()
  if (!user) return DASHBOARD_HIDDEN

  const admin = createSupabaseAdmin()
  const [state, subRes] = await Promise.all([
    getMembershipState(user.id),
    admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const hasSub = Boolean(subRes.data?.stripe_subscription_id)
  // A membership "signal" = anything beyond a bare general member: an active/
  // past_due/canceled status, a founding badge, or a stored creator tier.
  const show =
    state.membershipStatus !== 'none' ||
    state.isFoundingCreator ||
    state.isActiveCreator

  return {
    show,
    tier: state.isActiveCreator ? 'creator' : 'general',
    status: state.membershipStatus,
    source: state.membershipSource,
    expiresAt: state.expiresAt,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    isFounding: state.isFoundingCreator,
    foundingNumber: state.foundingNumber,
    // Only a paid subscription can be canceled/resumed in Stripe. founding_free
    // members have no subscription -- nothing to manage.
    canManageStripe: state.membershipSource === 'paid' && hasSub,
  }
}

// Shared cancel/resume core: flip Stripe's cancel_at_period_end, then mirror it
// onto profiles optimistically (the webhook is the authority and will confirm).
async function setCancelAtPeriodEnd(
  cancelAtPeriodEnd: boolean,
): Promise<MembershipActionResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // Fail-closed in dark launch: never mutate a subscription while the switch is
  // off.
  if (!(await isMembershipEnabled())) return { ok: false, reason: 'disabled' }

  const admin = createSupabaseAdmin()
  const { data: row } = await admin
    .from('profiles')
    .select('stripe_subscription_id, membership_source')
    .eq('id', user.id)
    .maybeSingle()

  const subId = (row?.stripe_subscription_id as string | null | undefined) ?? null
  const source = (row?.membership_source as string | null | undefined) ?? null
  if (!subId) return { ok: false, reason: 'no_subscription' }
  // founding_free (or any non-paid) has no real Stripe subscription to manage.
  if (source !== 'paid') return { ok: false, reason: 'not_cancelable' }

  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(subId, { cancel_at_period_end: cancelAtPeriodEnd })
    await admin
      .from('profiles')
      .update({
        membership_cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    return { ok: true, cancelAtPeriodEnd }
  } catch (e) {
    console.error(
      '[membership] cancel/resume failed:',
      e instanceof Error ? e.message : e,
    )
    return { ok: false, reason: 'stripe_error' }
  }
}

// Cancel at period end (keeps access until membership_expires_at, then the P4c
// webhook flips the sub to canceled and P1 collapses creator -> general).
export async function cancelMembership(): Promise<MembershipActionResult> {
  return setCancelAtPeriodEnd(true)
}

// Undo a pending period-end cancel (re-enable auto-renew) before the boundary.
export async function resumeMembership(): Promise<MembershipActionResult> {
  return setCancelAtPeriodEnd(false)
}
