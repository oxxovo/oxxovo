import { z } from 'zod'

const aiModelSchema = z.object({
  name: z.string().min(1, 'model name required'),
  provider: z.string().optional(),
  is_integrity: z.boolean().optional(),
})

const nullableTimestamp = z
  .union([z.string().datetime({ offset: true }), z.literal(''), z.null()])
  .transform((v) => (v === '' || v == null ? null : v))

// Used for both create and update. id is server-generated for inserts.
export const seasonSchema = z
  .object({
    name: z.string().min(1, 'name required').max(50),
    season_number: z.coerce.number().int().nonnegative(),
    status: z.enum(['draft', 'upcoming', 'active', 'closed', 'completed']),

    // ★IS THIS A REAL COMPETITION? A REQUIRED CHOICE WITH NO DEFAULT.
    //
    // Every other boolean on this form defaults (see lobby_featured: undefined
    // becomes false). This one must not, and the reason is that BOTH wrong
    // defaults are real:
    //   default false -> a rehearsal created through this form is filed as a
    //     real competition. It appears on the public lobby and, once email-tick
    //     reads the same column, mails its test addresses as if they were
    //     entrants. Not recoverable -- the mail has left.
    //   default true  -> a real season is filed as test data. It is hidden from
    //     the lobby and silently skipped by the mailer. Recoverable, but silent.
    // The DB DEFAULT is true because for a row created by some OTHER path the
    // fail-closed direction is the only sane one. Here there is a human in the
    // loop, so the honest option is to make them say which it is. Absence is a
    // validation error, not a value.
    //
    // ★So there is deliberately no z.undefined() branch and no .default().
    // z.enum over the two literal strings a radio group posts, then to boolean.
    is_fixture: z
      .enum(['true', 'false'], {
        error:
          'choose real competition or rehearsal/test -- this field has no default, ' +
          'because both possible defaults are wrong in a different direction',
      })
      .transform((v) => v === 'true'),

    max_applicants: z.coerce.number().int().positive(),
    top_n_advance: z.coerce.number().int().positive(),

    // 2-stage advancement policy (preliminary -> main round).
    // application_defer_count is NOT here: it's a system counter managed by the
    // cron, not an admin-set field, so the form never sends/clobbers it.
    min_participants: z.coerce.number().int().positive(),
    // Floor once max_defer_count is exhausted (HQ 2026-08-12 "확정값 시트": 3
    // defers max, 80 minimum after that). Required here (unlike the DB column,
    // which stays nullable for rows created before this field existed) --
    // going forward an admin must say what it is, the same posture as
    // is_fixture having no default.
    absolute_min_participants: z.coerce.number().int().positive(),
    defer_extension_days: z.coerce.number().int().positive(),
    max_defer_count: z.coerce.number().int().nonnegative(),
    advance_pct: z.coerce.number().gt(0).max(1),
    advance_min: z.coerce.number().int().positive(),
    advance_max: z.coerce.number().int().positive(),

    application_video_min_seconds: z.coerce.number().int().positive(),
    application_video_max_seconds: z.coerce.number().int().positive(),

    total_prize_pool: z.coerce.number().nonnegative(),
    entry_fee: z.coerce.number().nonnegative(),
    // prize_first/second/third are GENERATED columns in Postgres (total * pct/100);
    // the form sends only the percentages, the DB computes absolute amounts.
    prize_first_pct: z.coerce.number().min(0).max(100),
    prize_second_pct: z.coerce.number().min(0).max(100),
    prize_third_pct: z.coerce.number().min(0).max(100),

    main_round_video_seconds: z.coerce.number().int().positive(),
    main_round_video_min_seconds: z.coerce.number().int().positive(),
    main_round_video_max_seconds: z.coerce.number().int().positive(),
    theme_announcement_minutes_before: z.coerce.number().int().nonnegative(),
    submission_hours: z.coerce.number().int().positive(),
    community_vote_weight: z.coerce.number().min(0).max(1),
    ai_score_weight: z.coerce.number().min(0).max(1),

    scoring_intent_clarity_weight: z.coerce.number().min(0).max(1),
    scoring_execution_weight: z.coerce.number().min(0).max(1),
    scoring_originality_weight: z.coerce.number().min(0).max(1),
    scoring_integrity_weight: z.coerce.number().min(0).max(1),

    ai_models: z.array(aiModelSchema).min(1, 'at least one AI model required'),

    flag_integrity_threshold: z.coerce.number().min(0).max(100),
    flag_spread_threshold: z.coerce.number().min(0).max(100),

    // Studio (Session 6). studio_round 'both' = generate via studio in BOTH
    // rounds; the server resolves the effective round from the schedule.
    studio_round: z.enum(['application', 'main', 'both']),
    studio_max_generations_per_round: z.coerce.number().int().positive(),
    // Lobby (home TOURNAMENTS section). poster_url empty -> null (gradient
    // fallback); lobby_featured pins the card first.
    poster_url: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v ?? '').trim() || null),
    // Short display label for main_round_theme (lib/seasons.ts). Same empty
    // -> null convention as poster_url -- an unset label is a real state
    // (falls back to season_theme/id in the UI), not an error.
    main_round_theme_label: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v ?? '').trim() || null),
    lobby_featured: z
      .union([z.literal('true'), z.literal('false'), z.boolean(), z.undefined()])
      .transform((v) => v === true || v === 'true'),

    application_open_at: nullableTimestamp,
    // HQ 2026-08-12: registration cutoff, separate from application_close_at
    // (the submission cutoff, unchanged). Nullable like its siblings -- an
    // unset value means "no registration cutoff", the same open convention
    // isApplicationClosed already uses for a null application_close_at.
    registration_close_at: nullableTimestamp,
    application_close_at: nullableTimestamp,
    scoring_complete_at: nullableTimestamp,
    // When AI scoring is scheduled to START (distinct from scoring_complete_at,
    // the "done" marker -- see lib/seasons.ts comment on the same column).
    scoring_start_at: nullableTimestamp,
    // When the preliminary-result email is scheduled to go out (a schedule,
    // not the release marker -- prelim_released_at is separate and not on
    // this form).
    prelim_results_announcement_at: nullableTimestamp,
    community_vote_start_at: nullableTimestamp,
    community_vote_end_at: nullableTimestamp,
    main_round_start_at: nullableTimestamp,
    main_round_end_at: nullableTimestamp,
    awards_announcement_at: nullableTimestamp,
  })
  .refine(
    (s) => s.application_video_min_seconds <= s.application_video_max_seconds,
    {
      message: 'video min must be <= video max',
      path: ['application_video_max_seconds'],
    },
  )
  .refine(
    (s) => s.main_round_video_min_seconds <= s.main_round_video_max_seconds,
    {
      message: 'main round video min must be <= max',
      path: ['main_round_video_max_seconds'],
    },
  )
  .refine(
    (s) =>
      !s.community_vote_start_at ||
      !s.community_vote_end_at ||
      new Date(s.community_vote_start_at).getTime() <= new Date(s.community_vote_end_at).getTime(),
    {
      message: 'community_vote_start_at must be at or before community_vote_end_at',
      path: ['community_vote_end_at'],
    },
  )
  .refine(
    (s) => Math.abs(s.community_vote_weight + s.ai_score_weight - 1) < 0.001,
    {
      message: 'community + ai weights must sum to 1.0',
      path: ['ai_score_weight'],
    },
  )
  .refine(
    (s) =>
      Math.abs(
        s.scoring_intent_clarity_weight +
          s.scoring_execution_weight +
          s.scoring_originality_weight +
          s.scoring_integrity_weight -
          1,
      ) < 0.001,
    {
      message: 'scoring weights must sum to 1.0',
      path: ['scoring_integrity_weight'],
    },
  )
  .refine(
    (s) => s.top_n_advance <= s.max_applicants,
    {
      message: 'top_n_advance must be <= max_applicants',
      path: ['top_n_advance'],
    },
  )
  // Advancement clamp must be coherent: lower bound <= upper bound, and the
  // semifinal can't admit more than the preliminary pool. Mirrors the DB
  // CHECK seasons_advance_policy_chk.
  .refine((s) => s.advance_min <= s.advance_max, {
    message: 'advance_min must be <= advance_max',
    path: ['advance_max'],
  })
  .refine((s) => s.advance_max <= s.max_applicants, {
    message: 'advance_max must be <= max_applicants',
    path: ['advance_max'],
  })
  // A season can't require more participants than its own capacity.
  .refine((s) => s.min_participants <= s.max_applicants, {
    message: 'min_participants must be <= max_applicants',
    path: ['min_participants'],
  })
  // The post-defer floor is a fallback FROM min_participants, not a higher bar.
  .refine((s) => s.absolute_min_participants <= s.min_participants, {
    message: 'absolute_min_participants must be <= min_participants',
    path: ['absolute_min_participants'],
  })
  // Registering has to close at or before submitting does -- HQ 2026-08-12's
  // whole point was two DIFFERENT dates in a specific order, not two names
  // for the same instant.
  .refine(
    (s) =>
      !s.registration_close_at ||
      !s.application_close_at ||
      new Date(s.registration_close_at).getTime() <= new Date(s.application_close_at).getTime(),
    {
      message: 'registration_close_at must be at or before application_close_at',
      path: ['registration_close_at'],
    },
  )
  .refine(
    (s) =>
      Math.abs(s.prize_first_pct + s.prize_second_pct + s.prize_third_pct - 100) < 0.01,
    {
      message: 'prize split must sum to 100%',
      path: ['prize_third_pct'],
    },
  )

export type SeasonInput = z.infer<typeof seasonSchema>

/**
 * What the FORM starts from -- which is not the same shape as what it must SUBMIT.
 *
 * ★is_fixture is optional here and required in SeasonInput, and that gap is the
 * feature. DEFAULT_SEASON is the initial state of the new-season form; if it
 * carried a value, one radio would arrive pre-selected and an admin could submit
 * without ever deciding, which is exactly what a required choice is meant to
 * prevent. `undefined` means "nobody has said yet" and renders as neither option
 * checked. The edit page passes the row's real value, so editing an existing
 * season shows what it currently is rather than asking again from scratch.
 */
export type SeasonFormInitial = Omit<SeasonInput, 'is_fixture'> & {
  is_fixture?: boolean | null
}

export const DEFAULT_SEASON: SeasonFormInitial = {
  name: 'NEW SEASON',
  season_number: 1,
  status: 'draft',
  max_applicants: 500,
  top_n_advance: 50,
  // HQ 2026-08-12: 50 was stale. 100 = the real "does this tournament open"
  // bar (distinct from the Founding Creator free-membership cap, which is
  // also 100 but an unrelated, platform-lifetime number).
  min_participants: 100,
  absolute_min_participants: 80,
  defer_extension_days: 7,
  max_defer_count: 3,
  advance_pct: 0.1,
  advance_min: 10,
  advance_max: 50,
  application_video_min_seconds: 15,
  application_video_max_seconds: 30,
  total_prize_pool: 2000,
  entry_fee: 0,
  prize_first_pct: 60,
  prize_second_pct: 25,
  prize_third_pct: 15,
  main_round_video_seconds: 30,
  main_round_video_min_seconds: 15,
  main_round_video_max_seconds: 40,
  theme_announcement_minutes_before: 60,
  submission_hours: 48,
  community_vote_weight: 0.5,
  ai_score_weight: 0.5,
  scoring_intent_clarity_weight: 0.25,
  scoring_execution_weight: 0.45,
  scoring_originality_weight: 0.2,
  scoring_integrity_weight: 0.1,
  ai_models: [
    { name: 'claude-opus-4-5', provider: 'Anthropic', is_integrity: true },
    { name: 'gpt-4o', provider: 'OpenAI' },
    { name: 'gemini-2.5-flash', provider: 'Google' },
  ],
  flag_integrity_threshold: 50,
  flag_spread_threshold: 30,
  studio_round: 'main',
  studio_max_generations_per_round: 10,
  poster_url: null,
  main_round_theme_label: null,
  lobby_featured: false,
  application_open_at: null,
  registration_close_at: null,
  application_close_at: null,
  scoring_complete_at: null,
  scoring_start_at: null,
  prelim_results_announcement_at: null,
  community_vote_start_at: null,
  community_vote_end_at: null,
  main_round_start_at: null,
  main_round_end_at: null,
  awards_announcement_at: null,
}
