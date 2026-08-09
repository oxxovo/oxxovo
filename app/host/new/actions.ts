'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getTierConfig } from '@/lib/partners'
import {
  getCurrentSeasonId,
  initialEscrowStatusForFundingMode,
  type Season,
} from '@/lib/seasons'
import {
  partnerTournamentSchema,
  type PartnerTournamentInput,
} from '@/lib/partner-tournament-schema'
import { isMemberHostedEnabled } from '@/lib/member-hosted'
import { isFixtureSeason } from '@/lib/lobby'

export type HostFormState = {
  ok: boolean
  seasonId?: string
  messageKey?: 'created'
  errorMessage?: string
  fieldErrors?: Record<string, string[]>
}

// In-flight = not yet wrapped up. Used for the per-tier "how many tournaments
// can a host run" cap. "시즌당" is interpreted as concurrent in-flight
// tournaments pending the weekly-season model landing on main (flagged to TK).
const IN_FLIGHT_EXCLUDED = ['completed', 'closed']

function parseFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) raw[key] = value
  return raw
}

export async function createPartnerTournament(
  _prev: HostFormState,
  formData: FormData,
): Promise<HostFormState> {
  // Master switch: member-hosted is off by default.
  if (!(await isMemberHostedEnabled())) {
    return { ok: false, errorMessage: 'Member-hosted tournaments are not available.' }
  }
  // 1. AuthN: must be signed in.
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, errorMessage: 'Please sign in to create a tournament.' }
  }

  const db = createSupabaseAdmin()

  // 2. AuthZ: must be an active partner. Read tier off the profile.
  const { data: profile } = await db
    .from('profiles')
    .select('partner_status, partner_tier')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.partner_status !== 'active') {
    return { ok: false, errorMessage: 'Only active partner hosts can create tournaments.' }
  }
  const tierName = (profile.partner_tier as string | null) ?? null
  if (!tierName) {
    return { ok: false, errorMessage: 'No tier assigned to this partner account.' }
  }
  const tier = await getTierConfig(tierName)
  if (!tier) {
    return { ok: false, errorMessage: `Tier config not found: ${tierName}` }
  }

  // 3. Validate the partner-configurable inputs.
  const parsed = partnerTournamentSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const k = issue.path.join('.')
      fieldErrors[k] = [...(fieldErrors[k] ?? []), issue.message]
    }
    return { ok: false, errorMessage: 'Validation failed', fieldErrors }
  }
  const input: PartnerTournamentInput = parsed.data

  // 4. Tier caps (DB-driven, never hardcoded).
  if (input.max_applicants > tier.max_applications_cap) {
    return {
      ok: false,
      fieldErrors: {
        max_applicants: [
          `Exceeds your ${tier.tier} cap of ${tier.max_applications_cap} applicants.`,
        ],
      },
    }
  }
  if (tier.max_tournaments_per_season != null) {
    const { count, error: countErr } = await db
      .from('seasons')
      .select('id', { count: 'exact', head: true })
      .eq('host_type', 'partner')
      .eq('host_user_id', user.id)
      .not('status', 'in', `(${IN_FLIGHT_EXCLUDED.join(',')})`)
    if (countErr) return { ok: false, errorMessage: countErr.message }
    if ((count ?? 0) >= tier.max_tournaments_per_season) {
      return {
        ok: false,
        errorMessage: `Your ${tier.tier} tier allows ${tier.max_tournaments_per_season} in-flight tournament(s). Finish an existing one first.`,
      }
    }
  }

  // 5. Inherit infra defaults from the current official season (no per-season
  //    branching; partner-set fields override below).
  const { data: templateRaw, error: tmplErr } = await db
    .from('seasons')
    .select('*')
    .eq('id', getCurrentSeasonId())
    .single()
  if (tmplErr || !templateRaw) {
    return { ok: false, errorMessage: `Template season unavailable: ${tmplErr?.message}` }
  }
  const template = templateRaw as Season

  // Next season_number (display ordering only) -- over the REAL seasons.
  //
  // ★Measured 2026-08-08: max(season_number) over all rows is 1006, because nine
  // rehearsal seasons live in the table. A partner tournament created today was
  // therefore numbered #1007, which is not a display number, it is a rehearsal
  // number -- and lib/lobby.ts's number heuristic treats anything >= 900 as a
  // fixture. Over the real rows the max is 4, so the next one is #5.
  //
  // The is_fixture column is requested and, if this database has not been
  // migrated yet, the select is retried without it. That is not defensive
  // padding: PostgREST fails the WHOLE select on one unknown column (42703), so
  // asking for a column that may not be there is how a partner-creation flow
  // dies completely instead of degrading. isFixtureSeason then falls back to the
  // name/number heuristic, which is today's behaviour exactly.
  let numberRows: { id: string; season_number: number; is_fixture?: boolean | null }[] = []
  const withFlag = await db.from('seasons').select('id, season_number, is_fixture')
  const hasFixtureColumn = !withFlag.error
  if (withFlag.error) {
    if (withFlag.error.code !== '42703') {
      return { ok: false, errorMessage: `Season numbering unavailable: ${withFlag.error.message}` }
    }
    console.warn('[host/new] seasons.is_fixture not present yet — falling back to the id/number heuristic')
    const plain = await db.from('seasons').select('id, season_number')
    if (plain.error) {
      return { ok: false, errorMessage: `Season numbering unavailable: ${plain.error.message}` }
    }
    numberRows = (plain.data ?? []) as typeof numberRows
  } else {
    numberRows = (withFlag.data ?? []) as typeof numberRows
  }
  const realNumbers = numberRows.filter((s) => !isFixtureSeason(s)).map((s) => s.season_number)
  const nextNumber = (realNumbers.length ? Math.max(...realNumbers) : 0) + 1

  const id = `partner_${crypto.randomUUID()}`
  const nowIso = new Date().toISOString()

  const payload = {
    // identity
    id,
    name: input.theme,
    display_name: input.theme,
    season_number: nextNumber,
    status: 'draft', // not public until escrow paid (TK beta policy)
    // ★A partner tournament is a real competition, so it has to say so. The
    // column is fail-closed (DEFAULT true), which means omitting it would file
    // every partner season as test data. Only sent when the column exists:
    // PostgREST rejects an INSERT naming a column it does not know, and the
    // partner would get "creation failed" for a flag they never set.
    ...(hasFixtureColumn ? { is_fixture: false } : {}),

    // partner-configured
    max_applicants: input.max_applicants,
    total_prize_pool: input.total_prize_pool,
    prize_first_pct: input.prize_first_pct,
    prize_second_pct: input.prize_second_pct,
    prize_third_pct: input.prize_third_pct,
    application_video_min_seconds: input.application_video_min_seconds,
    application_video_max_seconds: input.application_video_max_seconds,
    scoring_intent_clarity_weight: input.scoring_intent_clarity_weight,
    scoring_execution_weight: input.scoring_execution_weight,
    scoring_originality_weight: input.scoring_originality_weight,
    scoring_integrity_weight: input.scoring_integrity_weight,
    application_open_at: input.application_open_at,
    application_close_at: input.application_close_at,

    // inherited infra (official current season)
    top_n_advance: Math.min(template.top_n_advance, input.max_applicants),
    entry_fee: template.entry_fee,
    submission_hours: template.submission_hours,
    theme_announcement_minutes_before: template.theme_announcement_minutes_before,
    main_round_video_seconds: template.main_round_video_seconds,
    main_round_video_min_seconds: template.main_round_video_min_seconds,
    main_round_video_max_seconds: template.main_round_video_max_seconds,
    community_vote_weight: template.community_vote_weight,
    ai_score_weight: template.ai_score_weight,
    ai_models: template.ai_models,
    deadline_reminder_hours: template.deadline_reminder_hours,
    allowed_video_platforms: (template as unknown as { allowed_video_platforms: string[] })
      .allowed_video_platforms,
    flag_integrity_threshold: template.flag_integrity_threshold,
    flag_spread_threshold: template.flag_spread_threshold,

    // partner tournaments start with no preset perks
    award_prizes: {},

    // host / escrow — escrow status follows the funding mode: a guaranteed pool
    // starts 'pending' (admin must confirm payment before public), an entry
    // pool is 'not_required'.
    host_type: 'partner',
    host_user_id: user.id,
    prize_funding_mode: input.prize_funding_mode,
    prize_pool_escrow_status: initialEscrowStatusForFundingMode(input.prize_funding_mode),

    created_at: nowIso,
    updated_at: nowIso,
  }

  const { error: insErr } = await db.from('seasons').insert(payload)
  if (insErr) {
    return { ok: false, errorMessage: insErr.message }
  }

  return { ok: true, seasonId: id, messageKey: 'created' }
}
