import { z } from 'zod'

// Validation for the partner-configurable subset of a tournament (/host/new).
// Everything NOT here (ai_models, allowed_video_platforms, deadline_reminder_
// hours, flag thresholds, top_n_advance, submission_hours, community/ai split,
// etc.) is inherited from the current official season at creation time — no
// per-season branching, no hardcoded operational values.
//
// max_applicants is range-checked here for sanity, but the tier CAP itself is
// validated in the action against member_tier_config (DB), never hardcoded.

const timestamp = z.string().datetime({ offset: true })

export const partnerTournamentSchema = z
  .object({
    theme: z.string().min(1, 'theme required').max(100),

    application_open_at: timestamp,
    application_close_at: timestamp,

    max_applicants: z.coerce.number().int().positive(),

    total_prize_pool: z.coerce.number().nonnegative(),
    prize_first_pct: z.coerce.number().min(0).max(100),
    prize_second_pct: z.coerce.number().min(0).max(100),
    prize_third_pct: z.coerce.number().min(0).max(100),

    application_video_min_seconds: z.coerce.number().int().positive(),
    application_video_max_seconds: z.coerce.number().int().positive(),

    scoring_intent_clarity_weight: z.coerce.number().min(0).max(1),
    scoring_execution_weight: z.coerce.number().min(0).max(1),
    scoring_originality_weight: z.coerce.number().min(0).max(1),
    scoring_integrity_weight: z.coerce.number().min(0).max(1),
  })
  .refine((s) => new Date(s.application_open_at) < new Date(s.application_close_at), {
    message: 'application open must be before close',
    path: ['application_close_at'],
  })
  .refine((s) => s.application_video_min_seconds <= s.application_video_max_seconds, {
    message: 'video min must be <= video max',
    path: ['application_video_max_seconds'],
  })
  .refine(
    (s) => Math.abs(s.prize_first_pct + s.prize_second_pct + s.prize_third_pct - 100) < 0.01,
    { message: 'prize split must sum to 100%', path: ['prize_third_pct'] },
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
    { message: 'scoring weights must sum to 1.0', path: ['scoring_integrity_weight'] },
  )

export type PartnerTournamentInput = z.infer<typeof partnerTournamentSchema>
