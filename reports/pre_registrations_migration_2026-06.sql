-- =========================================================================
-- OXXOVO pre_registrations migration -- 2026-06 (pre-register branch)
-- Run in Supabase SQL Editor (full file as one block).
--
-- New, ADD-only table for the public pre-registration ("notify me when
-- applications open") flow. Nothing existing is altered or dropped.
--
--   - Email capture with global case-insensitive uniqueness (the app stores
--     email already lower-cased, so a plain UNIQUE(email) backs the upsert
--     via PostgREST on_conflict=email).
--   - UTM attribution columns (source / medium / campaign) + referrer.
--   - season_id references the season the visitor pre-registered FOR, taken
--     from getCurrentSeasonId() at write time (never hard-coded here).
--   - GRANT / RLS mirror the email_logs pattern: service_role does the
--     inserts (route handler, bypasses RLS); authenticated admins read
--     through the user-context client under an admin-only policy; anon has
--     no access at all (the old /api/waitlist shipped a publishable key to
--     the browser -- this path does not).
-- =========================================================================

BEGIN;

-- 1. Table
CREATE TABLE public.pre_registrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  referrer     TEXT,
  season_id    TEXT REFERENCES public.seasons(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'unsubscribed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Global, case-insensitive dedup. The app lower-cases email before every
  -- write, so a plain UNIQUE is enough AND lets PostgREST upsert with
  -- on_conflict=email (an expression index could not be named there).
  CONSTRAINT pre_registrations_email_unique UNIQUE (email)
);

-- 2. Indexes (admin listing newest-first; season scoping)
CREATE INDEX pre_registrations_created_at ON public.pre_registrations (created_at DESC);
CREATE INDEX pre_registrations_season     ON public.pre_registrations (season_id);

-- 3. GRANT -- PostgREST visibility (same pattern as email_logs / profiles)
GRANT SELECT ON public.pre_registrations TO authenticated;
GRANT ALL    ON public.pre_registrations TO service_role;
-- anon intentionally receives NO grant.

-- 4. RLS -- only admins read through the user-context client.
--    Service role bypasses RLS entirely for the automated insert/upsert.
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_registrations_admin_read ON public.pre_registrations;

CREATE POLICY pre_registrations_admin_read ON public.pre_registrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) Columns -- expect 10 rows
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pre_registrations'
ORDER BY ordinal_position;

-- 2) Indexes -- expect PK + unique(email) + 2 plain indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'pre_registrations'
ORDER BY indexname;

-- 3) RLS policy -- expect 1 row: pre_registrations_admin_read / SELECT / {authenticated}
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pre_registrations';

-- 4) GRANT -- expect authenticated (SELECT) + service_role (ALL). anon absent.
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'pre_registrations'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee
ORDER BY grantee;
