'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
import { canSubmitMainRound, getSeasonById } from '@/lib/seasons'
import { validateVideoUrl } from '@/lib/video-url'
import { getMembershipState, isMembershipEnabled } from '@/lib/membership'
import { getStripe } from '@/lib/stripe'
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
