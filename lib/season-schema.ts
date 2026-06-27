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

    max_applicants: z.coerce.number().int().positive(),
    top_n_advance: z.coerce.number().int().positive(),

    // 2-stage advancement policy (preliminary -> main round).
    // application_defer_count is NOT here: it's a system counter managed by the
    // cron, not an admin-set field, so the form never sends/clobbers it.
    min_participants: z.coerce.number().int().positive(),
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
    lobby_featured: z
      .union([z.literal('true'), z.literal('false'), z.boolean(), z.undefined()])
      .transform((v) => v === true || v === 'true'),

    application_open_at: nullableTimestamp,
    application_close_at: nullableTimestamp,
    scoring_complete_at: nullableTimestamp,
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
  .refine(
    (s) =>
      Math.abs(s.prize_first_pct + s.prize_second_pct + s.prize_third_pct - 100) < 0.01,
    {
      message: 'prize split must sum to 100%',
      path: ['prize_third_pct'],
    },
  )

export type SeasonInput = z.infer<typeof seasonSchema>

export const DEFAULT_SEASON: SeasonInput = {
  name: 'NEW SEASON',
  season_number: 1,
  status: 'draft',
  max_applicants: 500,
  top_n_advance: 50,
  min_participants: 50,
  defer_extension_days: 7,
  max_defer_count: 2,
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
  lobby_featured: false,
  application_open_at: null,
  application_close_at: null,
  scoring_complete_at: null,
  main_round_start_at: null,
  main_round_end_at: null,
  awards_announcement_at: null,
}
