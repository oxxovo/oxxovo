-- ============================================================================
-- Referral attribution (growth engine) 2026-07
-- ============================================================================
-- Credits signups AND votes back to the creator whose share drove them.
--   profiles.referred_by     -- who referred this user (set once at signup from
--                               the ?ref= cookie; first-touch, no self-referral)
--   watch_votes.referred_by  -- which creator's share drove this vote (captured
--                               from the ?ref= cookie at vote time)
-- referral_source = utm_source (email_share / watch_share). ON DELETE SET NULL so
-- deleting a referrer never blocks. Idempotent (ADD COLUMN IF NOT EXISTS).
-- TK runs in Supabase SQL editor.
-- ============================================================================

BEGIN;

-- profiles: who referred this user (set once at signup from the ?ref= cookie).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_source text;

-- No self-referral.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_no_self_referral') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_no_self_referral
      CHECK (referred_by IS NULL OR referred_by <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

-- watch_votes: which creator's share drove this vote (?ref= at vote time).
ALTER TABLE public.watch_votes
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_source text;

CREATE INDEX IF NOT EXISTS watch_votes_referred_by_idx ON public.watch_votes(referred_by);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification -- expect 5 rows
-- ============================================================================
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name IN ('referred_by','referred_at','referral_source')
  AND table_name IN ('profiles','watch_votes')
ORDER BY table_name, column_name;
