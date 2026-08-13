-- ===========================================================================
-- OXXOVO Email opt-in (signup consent) -- profiles schema migration (2026-08-11)
-- ===========================================================================
-- Run each BLOCK separately, in order, in Supabase SQL Editor.
-- Idempotent (ADD COLUMN IF NOT EXISTS). No DO $$ block. ASCII-only.
--
-- Purpose: mirrors sms_optin_migration_2026-06.sql exactly, for email instead
--   of SMS. Signup consent text: "By creating an OXXOVO account, you agree to
--   receive competition updates and announcements about future seasons by
--   email or text message. You can opt out at any time in your settings."
--   (TK-confirmed copy, KR/EN in app/login consent notice + Privacy SS11 /
--   Terms SS12.)
--
--     email_opt_in       : current consent state (true once recorded; false
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
-- -- there is no retroactive consent record for them. Accounts created AFTER
-- ships get email_opt_in=true + email_consent_at/ip/text stamped once, at
-- app/auth/callback/route.ts (after the recipient opens the emailed link and
-- proves mailbox ownership -- not at OTP-request time on the login form).
--
-- Does NOT touch genesis_applications.agreed_to_rules/agreed_to_privacy/
-- agreed_to_integrity_notice -- separate, apply-time layer, untouched.
-- ===========================================================================


-- ===========================================================================
-- BLOCK 0 -- pre-check. Expect 0 rows (none of the 5 columns exist yet).
-- ===========================================================================
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name IN (
      'email_opt_in', 'email_consent_at', 'email_consent_ip',
      'email_consent_text', 'email_opt_out_at'
    )
  ORDER BY column_name;


-- ===========================================================================
-- BLOCK 1 -- write. ADD-only, idempotent.
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
-- BLOCK 2 -- verify. Expect 5 rows now (same query as BLOCK 0).
-- ===========================================================================
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name IN (
      'email_opt_in', 'email_consent_at', 'email_consent_ip',
      'email_consent_text', 'email_opt_out_at'
    )
  ORDER BY column_name;


-- ===========================================================================
-- BLOCK 3 -- verify distribution. Expect every row email_opt_in=false,
-- count = total row count in public.profiles (ALTER with a DEFAULT backfills
-- every existing row).
-- ===========================================================================
SELECT email_opt_in, count(*) FROM public.profiles GROUP BY email_opt_in;
