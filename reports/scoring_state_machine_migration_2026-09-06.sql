-- scoring_results: slot separation + 8-state judgment_state + consensus metadata
-- 2026-09-06. Additive only (ADD COLUMN IF NOT EXISTS) -- no existing column touched,
-- no DROP. judged_status (pending/in_progress/completed/failed) stays as-is; batch.ts
-- keeps deriving it from judgment_state so existing readers (advance_season_finalists,
-- RecommendationsPanel, scoring-coverage.ts) do not need to change.

ALTER TABLE public.scoring_results
  ADD COLUMN IF NOT EXISTS claude_judge_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS claude_judge_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claude_judge_slot TEXT NOT NULL DEFAULT 'claude',
  ADD COLUMN IF NOT EXISTS claude_judge_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gpt_judge_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gpt_judge_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpt_judge_slot TEXT NOT NULL DEFAULT 'gpt',
  ADD COLUMN IF NOT EXISTS gpt_judge_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gemini_judge_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gemini_judge_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gemini_judge_slot TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS gemini_judge_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS judgment_state TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS recheck_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consensus_grade TEXT,
  ADD COLUMN IF NOT EXISTS consensus_rank_spread NUMERIC,
  ADD COLUMN IF NOT EXISTS consensus_odd_vendor TEXT,
  ADD COLUMN IF NOT EXISTS rubric_version TEXT,
  ADD COLUMN IF NOT EXISTS judge_version TEXT;

ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_claude_judge_status_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_claude_judge_status_check
    CHECK (claude_judge_status IN ('pending','ok','error_transient','error_permanent'));

ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_gpt_judge_status_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_gpt_judge_status_check
    CHECK (gpt_judge_status IN ('pending','ok','error_transient','error_permanent'));

ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_gemini_judge_status_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_gemini_judge_status_check
    CHECK (gemini_judge_status IN ('pending','ok','error_transient','error_permanent'));

ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_judgment_state_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_judgment_state_check
    CHECK (judgment_state IN
      ('PENDING','PRIMARY_JUDGING','RETRY','RESERVE_JUDGING','3_VALID','RECHECK','FINAL','PUBLISHED'));

ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_consensus_grade_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_consensus_grade_check
    CHECK (consensus_grade IS NULL OR consensus_grade IN ('High','2-of-3','Low'));

-- admin dashboard filters on judgment_state='RECHECK' (new stuck-consensus category).
CREATE INDEX IF NOT EXISTS scoring_results_judgment_state_idx
  ON public.scoring_results (season_id, judgment_state)
  WHERE judgment_state IN ('RECHECK', 'RESERVE_JUDGING');

-- no GRANT changes needed: service_role already has ALL, authenticated already has
-- SELECT on the whole table (new columns inherit that), and admin still gets no
-- UPDATE/INSERT/DELETE policy on scoring_results (score integrity rule unchanged).
