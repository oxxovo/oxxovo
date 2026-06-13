-- =========================================================================
-- genesis_applications.status CHECK constraint repair (2026-06-13)
-- =========================================================================
-- PROBLEM (measured live, scripts/probe-status-constraint.mjs):
--   The ENFORCING constraint on genesis_applications.status is named
--   'genesis_apps_status_check' and allows only 7 values:
--     pending, waitlist, verifying, eligible, selected, awarded, rejected
--   It BLOCKS: flagged, main_round_submitted, final_selected.
--
--   main_round_submission_migration_2026-05.sql tried to widen the set but
--   DROP'd 'genesis_applications_status_check' (a DIFFERENT name), so the
--   stale 'genesis_apps_status_check' kept enforcing. Effect: BOTH the
--   canonical saveMainRoundSubmission path AND the studio main-round path
--   (submitGeneration / submitRender) cannot set status='main_round_submitted'
--   -> the scorer (candidateStatus='main_round_submitted') never sees them.
--   Integrity 'flagged' is also blocked. Undiscovered because season 0 has
--   not reached scoring / main round yet.
--
-- FIX: drop the stale constraint (and any prior full-name copy), add ONE
--   canonical constraint with the complete main-round value set. Idempotent.
--   'final_selected' (season 0 3-stage) is intentionally NOT added here; the
--   pending season0_3stage migration adds it, and now that the stale
--   constraint is gone, that migration's re-add will actually take effect.
-- =========================================================================

BEGIN;

ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_apps_status_check;

ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_status_check;

ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_status_check
    CHECK (status IN (
      'pending',
      'waitlist',
      'verifying',
      'flagged',
      'eligible',
      'selected',
      'main_round_submitted',
      'awarded',
      'rejected'
    ));

COMMIT;

-- =========================================================================
-- Verification (run after COMMIT)
-- =========================================================================

-- 1) exactly ONE status check constraint should remain, with 9 values.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%';

-- 2) the stale name must be gone (expect 0 rows).
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_apps_status_check';
