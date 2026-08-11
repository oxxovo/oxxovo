-- ===========================================================================
-- OXXOVO Email opt-in (signup consent) -- profiles schema migration (2026-08-11)
-- ===========================================================================
-- Run in Supabase SQL Editor (whole file, one block). Idempotent (ADD COLUMN
-- IF NOT EXISTS). No DO $$ block. ASCII-only (=== separators only).
--
-- Purpose: mirrors sms_optin_migration_2026-06.sql exactly, for email instead
--   of SMS. Signup consent text: "By creating an OXXOVO account, you agree to
--   receive competition updates and announcements about future seasons by
--   email or text message. You can opt out at any time in your settings."
--   (TK-confirmed copy, KR/EN in app/login consent notice + Privacy SS11 /
--   Terms SS12.)
--
--     email_opt_in       : current consent state (true once the signup notice
--                           has been shown and the account created; false
--                           after unsubscribe).
--     email_consent_at   : timestamp the consent was recorded (evidence).
--     email_consent_ip   : caller IP at that moment (evidence).
--     email_consent_text : exact notice text shown at that moment (evidence --
--                           snapshot so a later copy change cannot retroactively
--                           change what a user is on record as having agreed to).
--     email_opt_out_at   : last unsubscribe timestamp (List-Unsubscribe header /
--                           profile settings). NULL = never unsubscribed.
--
-- Accounts created BEFORE this migration ships have all five columns NULL/false
-- -- there is no retroactive consent record for them (cannot be backfilled
-- honestly). Accounts created AFTER ships get email_opt_in=true +
-- email_consent_at/ip/text stamped once, at first successful login
-- (app/auth/callback/route.ts), same trigger point across new and existing
-- accounts hitting the callback for the first time post-deploy.
--
-- Does NOT touch genesis_applications.agreed_to_rules/agreed_to_privacy/
-- agreed_to_integrity_notice -- those are a separate, apply-time layer (per-
-- submission agreement), not touched by this migration.
-- ===========================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_in       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_consent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_consent_ip   TEXT,
  ADD COLUMN IF NOT EXISTS email_consent_text TEXT,
  ADD COLUMN IF NOT EXISTS email_opt_out_at   TIMESTAMPTZ;

COMMIT;

-- ===========================================================================
-- Verification (run separately, after COMMIT)
-- ===========================================================================
-- 1a) 5 columns exist -- expect email_opt_in/email_consent_at/email_consent_ip/
--     email_consent_text/email_opt_out_at
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles'
--     AND column_name LIKE 'email\_%' ESCAPE '\'
--   ORDER BY column_name;

-- 1b) Current opt-in distribution -- expect all false before any deploy/login
-- SELECT email_opt_in, count(*) FROM public.profiles GROUP BY email_opt_in;

-- ===========================================================================
-- Rollback (if needed) -- destroys consent evidence, use with care.
-- ===========================================================================
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS email_opt_in,
--   DROP COLUMN IF EXISTS email_consent_at,
--   DROP COLUMN IF EXISTS email_consent_ip,
--   DROP COLUMN IF EXISTS email_consent_text,
--   DROP COLUMN IF EXISTS email_opt_out_at;
