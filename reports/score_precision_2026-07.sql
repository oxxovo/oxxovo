-- ============================================================================
-- Score precision: real-valued verified_score (remove integer rounding)
-- ============================================================================
-- Context: the scoring engine rounded twice (per-axis 3-AI average + weighted
-- sum), so verified_score had only 101 possible values (0..100). At 500
-- entrants that forces mass ties and an ambiguous advance cut line. The engine
-- (scorer.ts) now keeps full real precision; this migration (a) widens the
-- affected columns to numeric and (b) backfills existing rows by recomputing
-- from the stored raw 3-AI scores -- NO re-scoring needed, no API cost.
--
-- Weights (Rulebook v2.1): Intent 25 / Execution 45 / Originality 20 /
-- Integrity 10. Integrity is Claude-only (not a 3-AI average).
--
-- Run in Supabase SQL editor. Idempotent: safe to run more than once.
-- Check current types first if you want:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='scoring_results' AND column_name='verified_score';
-- ============================================================================

-- === 1. Widen columns to numeric (int -> numeric; if already numeric, no-op) ==
ALTER TABLE scoring_results     ALTER COLUMN verified_score        TYPE numeric(7,4);
ALTER TABLE scoring_results     ALTER COLUMN consensus_intent      TYPE numeric(7,4);
ALTER TABLE scoring_results     ALTER COLUMN consensus_execution   TYPE numeric(7,4);
ALTER TABLE scoring_results     ALTER COLUMN consensus_originality TYPE numeric(7,4);
ALTER TABLE scoring_results     ALTER COLUMN consensus_integrity   TYPE numeric(7,4);
ALTER TABLE genesis_applications ALTER COLUMN ai_score             TYPE numeric(7,4);

-- === 2. Backfill: recompute consensus axes + verified_score from raw 3-AI ====
-- Only rows that actually have raw scores stored (completed application-round).
UPDATE scoring_results SET
  consensus_intent      = (claude_intent      + gpt_intent      + gemini_intent)      / 3.0,
  consensus_execution   = (claude_execution   + gpt_execution   + gemini_execution)   / 3.0,
  consensus_originality = (claude_originality + gpt_originality + gemini_originality) / 3.0,
  consensus_integrity   = claude_integrity,
  verified_score =
      ((claude_intent      + gpt_intent      + gemini_intent)      / 3.0) * 0.25 +
      ((claude_execution   + gpt_execution   + gemini_execution)   / 3.0) * 0.45 +
      ((claude_originality + gpt_originality + gemini_originality) / 3.0) * 0.20 +
      (claude_integrity) * 0.10
WHERE round = 'application'
  AND judged_status = 'completed'
  AND claude_intent IS NOT NULL;

-- === 3. Sync genesis_applications.ai_score to the recomputed verified_score ===
UPDATE genesis_applications g SET ai_score = s.verified_score
FROM scoring_results s
WHERE s.application_id = g.id
  AND s.round = 'application'
  AND s.judged_status = 'completed';

-- === 4. Verify: top entries should now show decimals, ties broken ===========
SELECT application_id, verified_score, consensus_intent, consensus_execution
FROM scoring_results
WHERE round = 'application' AND judged_status = 'completed'
ORDER BY verified_score DESC
LIMIT 15;
