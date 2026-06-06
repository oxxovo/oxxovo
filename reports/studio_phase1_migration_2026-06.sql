-- =========================================================================
-- OXXOVO Studio (Session 6) -- Phase 1 schema
-- Run in Supabase SQL Editor (full file as one block).
--
-- In-platform AI video generation. Participants generate inside OXXOVO via a
-- single fal.ai integration (no per-model coupling) and submit the result
-- directly. This migration creates the three Phase 1 tables and the studio
-- platform_config keys. The /studio UI columns on genesis_applications and the
-- per-round generation limit on seasons are ADDed later in Phase 3 (submission
-- integration), kept out of this file to keep Phase 1 focused on the
-- generation pipeline.
--
-- Design (confirmed, do not change):
--   * fal.ai single integration, model-agnostic. Models live in model_catalog
--     (3 tiers: budget / standard / premium), managed dynamically.
--   * Margin 40%: credits charged = fal.ai raw cost x 1.4. The margin rate is
--     a platform_config value (studio_margin_rate), never hardcoded.
--   * Credits: 1 credit = USD 0.10. Ledger model -- balance is SUM of
--     credit_transactions.amount_credits per user (no stored balance column).
--   * CryptoBind (Patent 1) is two-stage:
--       (1) GENERATION time -- when a generation_jobs row is created the server
--           records timestamp + PID (participant/user id) + TID (tournament/
--           season id) and produces a server signature. The cryptobind_*
--           columns are filled HERE, at creation. They are NOT NULL so a job
--           cannot exist without its generation-stage authentication.
--       (2) SUBMISSION time (Phase 3) -- that signature is verified and the
--           submission is made immutable. A signature mismatch, or a TID that
--           does not match the tournament being submitted to, rejects the
--           submission.
--   * 6-stage server-authoritative state machine (Patent 2):
--       queued -> generating -> uploading -> ready -> submitted -> failed
--     Refunds are NOT a status; they are recorded as a credit_transactions row
--     (type = 'refund').
--   * All state transitions are server-authoritative. These tables are
--     reachable by the service role only (RLS on, anon/authenticated stripped).
--     Per-user read policies for the /studio UI are added in Phase 3.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

-- gen_random_uuid() lives in pgcrypto (enabled by default on Supabase; this is
-- a harmless idempotent re-assert).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------------
-- 1. model_catalog -- the fal.ai models we expose, by tier. Raw cost only;
--    the margin is applied at charge time from platform_config.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_catalog (
  id                   text PRIMARY KEY,            -- stable slug, e.g. 'ltx-video'
  tier                 text NOT NULL,               -- budget / standard / premium
  provider             text NOT NULL DEFAULT 'fal',
  fal_model_id         text NOT NULL,               -- e.g. 'fal-ai/ltx-video'
  display_name         text NOT NULL,
  cost_per_second_usd  numeric NOT NULL DEFAULT 0,  -- fal.ai raw cost per output second
  min_duration_seconds int NOT NULL DEFAULT 4,
  max_duration_seconds int NOT NULL DEFAULT 30,
  active               boolean NOT NULL DEFAULT true,
  sort_order           int NOT NULL DEFAULT 0,
  metadata             jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_catalog_tier_check
    CHECK (tier IN ('budget', 'standard', 'premium')),
  CONSTRAINT model_catalog_duration_check
    CHECK (min_duration_seconds >= 1 AND max_duration_seconds >= min_duration_seconds)
);

-- -------------------------------------------------------------------------
-- 2. generation_jobs -- one row per generation request. Created with its
--    CryptoBind authentication already filled in (generation-stage binding).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL
                        REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id           text NOT NULL
                        REFERENCES public.seasons(id) ON DELETE RESTRICT,
  model_id            text NOT NULL
                        REFERENCES public.model_catalog(id) ON DELETE RESTRICT,
  tier                text NOT NULL,                 -- snapshot of model tier
  prompt              text NOT NULL,
  duration_seconds    int NOT NULL,
  status              text NOT NULL DEFAULT 'queued',

  -- cost / credit accounting (charge logic lands in Phase 2)
  estimated_cost_usd  numeric NOT NULL DEFAULT 0,    -- fal raw cost estimate at enqueue
  credits_charged     numeric NOT NULL DEFAULT 0,    -- estimate x margin / credit value
  actual_cost_usd     numeric,                       -- recorded by worker from fal response

  -- output (set by worker on success)
  video_url           text,
  r2_key              text,
  fal_request_id      text,

  -- CryptoBind (Patent 1) -- FILLED AT CREATION. NOT NULL: a job cannot exist
  -- without its generation-stage authentication. The signature is an HMAC over
  -- a canonical string of (pid, tid, job id, generated_at, model, duration);
  -- verified at submission time (Phase 3).
  cryptobind_pid          uuid NOT NULL,             -- snapshot of user_id (participant)
  cryptobind_tid          text NOT NULL,             -- snapshot of season_id (tournament)
  cryptobind_generated_at timestamptz NOT NULL,
  cryptobind_signature    text NOT NULL,
  cryptobind_algo         text NOT NULL DEFAULT 'HMAC-SHA256',

  -- lifecycle bookkeeping
  attempts            int NOT NULL DEFAULT 0,
  error_message       text,
  worker_started_at   timestamptz,
  worker_finished_at  timestamptz,
  submitted_at        timestamptz,                   -- set at submission (Phase 3)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT generation_jobs_status_check
    CHECK (status IN ('queued', 'generating', 'uploading', 'ready', 'submitted', 'failed')),
  CONSTRAINT generation_jobs_tier_check
    CHECK (tier IN ('budget', 'standard', 'premium')),
  CONSTRAINT generation_jobs_duration_check
    CHECK (duration_seconds >= 1)
);

-- Worker polls queued jobs oldest-first.
CREATE INDEX IF NOT EXISTS generation_jobs_status_created_idx
  ON public.generation_jobs (status, created_at);
-- Per-round generation count (round limit enforcement, Phase 3) and daily cap.
CREATE INDEX IF NOT EXISTS generation_jobs_user_season_idx
  ON public.generation_jobs (user_id, season_id);
CREATE INDEX IF NOT EXISTS generation_jobs_created_idx
  ON public.generation_jobs (created_at);

-- -------------------------------------------------------------------------
-- 3. credit_transactions -- append-only ledger. Balance = SUM(amount_credits)
--    per user. Positive = grant / purchase / refund; negative = charge.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL
                      REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_credits    numeric NOT NULL,            -- signed: +grant/refund, -charge
  type              text NOT NULL,               -- purchase/admin_adjust/generation_charge/refund
  reason            text,                        -- required by app for admin_adjust
  generation_job_id uuid
                      REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  actor_id          uuid
                      REFERENCES auth.users(id) ON DELETE SET NULL,  -- admin who granted
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_type_check
    CHECK (type IN ('purchase', 'admin_adjust', 'generation_charge', 'refund'))
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
  ON public.credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_job_idx
  ON public.credit_transactions (generation_job_id);

-- -------------------------------------------------------------------------
-- 4. Lock the tables down to the service role. RLS on, every browser-reachable
--    privilege stripped. Per-user SELECT policies for /studio arrive in Phase 3.
-- -------------------------------------------------------------------------
ALTER TABLE public.model_catalog        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON public.model_catalog        FROM anon;
REVOKE ALL PRIVILEGES ON public.model_catalog        FROM authenticated;
REVOKE ALL PRIVILEGES ON public.generation_jobs      FROM anon;
REVOKE ALL PRIVILEGES ON public.generation_jobs      FROM authenticated;
REVOKE ALL PRIVILEGES ON public.credit_transactions  FROM anon;
REVOKE ALL PRIVILEGES ON public.credit_transactions  FROM authenticated;

GRANT ALL PRIVILEGES ON public.model_catalog        TO service_role;
GRANT ALL PRIVILEGES ON public.generation_jobs      TO service_role;
GRANT ALL PRIVILEGES ON public.credit_transactions  TO service_role;

-- -------------------------------------------------------------------------
-- 5. platform_config keys (studio_*). ON CONFLICT DO NOTHING so re-running
--    never overwrites a value TK has since tuned in the Dashboard.
--      studio_margin_rate          0.40  -> charge = raw_cost x (1 + 0.40)
--      studio_credit_usd_value     0.10  -> 1 credit = USD 0.10
--      studio_daily_generation_cap 20    -> worker hard stop per day (cost guard)
-- -------------------------------------------------------------------------
INSERT INTO public.platform_config (key, value, value_type, description)
VALUES
  ('studio_margin_rate', '0.40', 'decimal',
   'Studio generation margin. Credits charged = fal.ai raw cost x (1 + this).'),
  ('studio_credit_usd_value', '0.10', 'decimal',
   'USD value of one studio credit. 1 credit = USD 0.10.'),
  ('studio_daily_generation_cap', '20', 'int',
   'Max fal.ai generations the worker will run per day. Cost-runaway guard; raise after launch.')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) All three tables exist.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('model_catalog', 'generation_jobs', 'credit_transactions')
ORDER BY table_name;

-- 2) Grants -- expect ONLY service_role per table; anon + authenticated absent.
SELECT table_name, grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('model_catalog', 'generation_jobs', 'credit_transactions')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 3) RLS enabled on all three -- expect rowsecurity = true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE oid IN (
  'public.model_catalog'::regclass,
  'public.generation_jobs'::regclass,
  'public.credit_transactions'::regclass
)
ORDER BY relname;

-- 4) generation_jobs status CHECK -- expect the 6 states.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.generation_jobs'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 5) studio_* config keys present.
SELECT key, value, value_type
FROM public.platform_config
WHERE key LIKE 'studio_%'
ORDER BY key;
