-- =========================================================================
-- Studio music v1 -- migration REPAIR (TK Run). Self-contained: this file
-- replaces reports/studio_music_assets_migration_2026-07.sql. Do NOT run both.
--
-- ASCII only. LF only (.gitattributes pins *.sql to eol=lf).
-- Paste the whole file into the Supabase SQL editor in ONE go, in order.
--
-- -------------------------------------------------------------------------
-- WHY THIS EXISTS (measured 2026-07-27, read-only probe, project qrnkovokjmimagrwjebs)
--
--   1. public.studio_music_assets EXISTS with the WRONG shape.
--        present: id, title, mood, r2_key, status, created_at, signature, kind
--        missing: source, user_id, prompt, duration_seconds, url,
--                 cryptobind_content_hash, cryptobind_signature,
--                 cryptobind_generated_at, cryptobind_algo, error_message,
--                 active, updated_at
--        rows: 0 (verified -- nothing to preserve)
--      Because the table already existed, CREATE TABLE IF NOT EXISTS in the
--      original migration was a SILENT no-op.
--
--   2. seasons.studio_music_enabled DOES NOT EXIST.
--      -> the original migration never took effect at all.
--
--   LIVE IMPACT (reproduced, not theoretical): lib/studio.ts selects
--   studio_music_enabled inside a column list, so PostgREST fails the WHOLE
--   select with 42703 and the compose editor config load breaks. Production is
--   unaffected today (main is at the 2026-07-13 site gate), but Preview shares
--   the production database, so Preview is broken now.
--
--   ORDER RULE: run this SQL and pass STEP 4 verification BEFORE the switch
--   refactor code is pushed. Migration -> verify -> code. That order is exactly
--   what was broken here; do not repeat it.
--
-- -------------------------------------------------------------------------
-- WHAT CHANGED vs the first draft of this repair file (TK direction 2026-07-27)
--
--   * TWO gate columns, not one. The AI switch is NOT deleted -- it moves from
--     platform_config to a seasons column so both gates live in the same layer.
--     Keeping it preserves the fallback posture: if ElevenLabs' answer on Music
--     API Terms 3.A is negative, we ship PRE-GENERATED LIBRARY ONLY (OXXOVO
--     generates the beds on its own account; participants only pick). That state
--     is exactly "master ON / ai OFF".
--   * studio_music_assets gains season_id + round so the per-user cap can be
--     scoped per round, the same axis the video caps already use.
--   * seasons gains ONE music cap (default 15, TK-confirmed), a config value
--     changeable by one UPDATE. The cap exists for FAIRNESS, not budget --
--     participants fund their own generations, so uncapped would mean the
--     wealthier entrant buys attempts. Single pool: music has no draft artefact
--     (verified: no tier/draft/kind anywhere in the music path), so a split
--     would only make a participant buy the same audio twice.
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 0 -- SAFETY CHECK. Run this statement ALONE first.
--           Expect n_rows = 0. If n_rows > 0, STOP and report. Do not drop.
-- -------------------------------------------------------------------------
SELECT count(*) AS n_rows FROM public.studio_music_assets;

-- -------------------------------------------------------------------------
-- STEP 1 -- Repair. Only after STEP 0 returned 0.
-- -------------------------------------------------------------------------
BEGIN;

-- 1a. Remove the empty stray table so the correct definition can be created.
DROP TABLE IF EXISTS public.studio_music_assets;

-- 1b. The real table. Library rows: source='library', user_id/season_id/round
--     NULL, status 'ready'. AI rows: source='ai', owner + season + round set,
--     lifecycle status. Every asset is content-hash signed (v1m) so the worker
--     can prove the audio it downloaded is the exact signed bytes
--     (anti-repoint / anti-swap).
CREATE TABLE public.studio_music_assets (
  id                      text PRIMARY KEY,
  source                  text NOT NULL,                 -- 'library' | 'ai'
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for library

  -- Cap scoping. AI rows carry the season + round they were generated in so the
  -- per-user cap counts on the same axis the video caps use. Library rows are
  -- platform assets: both NULL.
  season_id               text REFERENCES public.seasons(id) ON DELETE SET NULL,
  round                   text,                          -- 'application' | 'main' | NULL

  title                   text NOT NULL DEFAULT '',
  mood                    text NOT NULL DEFAULT '',      -- library grouping label
  prompt                  text,                          -- AI generation prompt
  duration_seconds        numeric NOT NULL DEFAULT 0,
  r2_key                  text,                          -- R2 object key (music/ namespace)
  url                     text,                          -- public R2 URL (worker downloads)

  cryptobind_content_hash text,
  cryptobind_signature    text,
  cryptobind_generated_at timestamptz,
  cryptobind_algo         text NOT NULL DEFAULT 'HMAC-SHA256',

  status                  text NOT NULL DEFAULT 'ready',
  error_message           text,
  active                  boolean NOT NULL DEFAULT true, -- library curation on/off
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_music_assets_source_check
    CHECK (source IN ('library', 'ai')),
  CONSTRAINT studio_music_assets_status_check
    CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
  CONSTRAINT studio_music_assets_round_check
    CHECK (round IS NULL OR round IN ('application', 'main'))
);

CREATE INDEX studio_music_assets_library_idx
  ON public.studio_music_assets (source, active);
CREATE INDEX studio_music_assets_status_idx
  ON public.studio_music_assets (status, created_at);
CREATE INDEX studio_music_assets_user_idx
  ON public.studio_music_assets (user_id);
-- The cap query: count a user's AI beds in one season+round.
CREATE INDEX studio_music_assets_cap_idx
  ON public.studio_music_assets (user_id, season_id, round, source, status);

-- 1c. Lock the table to the service role (mirror generation_jobs / render_jobs).
--     The client never reads it directly; a server action returns the picker
--     list. GRANT set is mandatory -- do NOT ship without it (official_actors
--     lesson). DROP TABLE also dropped the old grants, so this re-establishes
--     the full set rather than assuming anything survived.
ALTER TABLE public.studio_music_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM anon;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM authenticated;
GRANT ALL PRIVILEGES ON public.studio_music_assets TO service_role;

-- 1d. THE master switch. Season-scoped, default OFF. Nothing else turns music
--     on -- no config key, no env var, no deploy.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_music_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.seasons.studio_music_enabled IS
  'MASTER gate for Studio music (library picker + AI generation + credit charge). Fail-closed. Keep false until the ElevenLabs written reply and TK approval; the ON signal comes from TK only.';

-- 1e. The AI-generation switch, moved OUT of platform_config into the same
--     layer as the master. Both must be true for AI generation; the master
--     alone is enough for the pre-generated library.
--     -> master ON + ai OFF = library-only fallback (Music API Terms 3.A safe).
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_music_ai_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.seasons.studio_music_ai_enabled IS
  'Participant-facing AI music generation. Requires studio_music_enabled too (AND). false + master true = pre-generated library only, which is the fallback if ElevenLabs Music API Terms 3.A blocks passing generation through to participants. Replaces the retired platform_config key of the same name.';

-- 1f. Per-user music generation cap, per season+round. ONE pool: there is no
--     draft/competition split for music, because there is no draft music. The
--     video split exists because a draft clip is a genuinely different artefact
--     (low-res, watermarked, promotes to a competition sibling). Music has a
--     single provider, single parameter set, single price and byte-identical
--     output, so splitting the pool would only make a participant buy the same
--     audio twice.
--
--     WHY A CAP AT ALL: fairness, not budget. Participants pay for their own
--     generations (credits = cost x 1.25), so an uncapped model would let a
--     wealthier entrant simply buy more attempts. The cap is a ceiling that
--     keeps the contest about direction rather than spend -- the same reasoning
--     behind the video cap of 30. 15 is half of 30 because music is a
--     supporting element, not the primary artefact.
--
--     Changing the value is one UPDATE, no deploy. 0 = unlimited.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_music_max_generations_per_round integer NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.seasons.studio_music_max_generations_per_round IS
  'Per-user AI music generations per season+round. Single pool (no draft split -- music has no draft artefact). Fairness ceiling: participants fund their own generations, so uncapped would let spend decide. 0 = unlimited.';

COMMIT;

-- =========================================================================
-- STEP 4 -- VERIFICATION. Run after STEP 1. All six must pass.
-- =========================================================================

-- 4a) Table shape. Expect 20 rows, including source / season_id / round / url /
--     duration_seconds / cryptobind_signature / cryptobind_content_hash /
--     active / updated_at.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY ordinal_position;

-- 4b) GRANT set. Expect service_role rows ONLY -- no anon, no authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY grantee, privilege_type;

-- 4c) Both switches present and OFF on every season, cap present.
--     Expect studio_music_enabled = false AND studio_music_ai_enabled = false
--     on every row, and the cap = 15.
SELECT id, status, studio_music_enabled, studio_music_ai_enabled,
       studio_music_max_generations_per_round
FROM public.seasons
ORDER BY id;

-- 4d) Nothing switched on by accident. Expect 0 and 0.
SELECT count(*) FILTER (WHERE studio_music_enabled IS TRUE)    AS master_on,
       count(*) FILTER (WHERE studio_music_ai_enabled IS TRUE) AS ai_on
FROM public.seasons;

-- 4e) Paste-corruption guard: both column names must be exactly these, with no
--     stray whitespace or newline picked up on the way through chat. Expect 3.
SELECT count(*) AS exact_names_ok
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN ('studio_music_enabled',
                      'studio_music_ai_enabled',
                      'studio_music_max_generations_per_round')
  AND column_name !~ '\s';

-- 4f) The exact select the app makes today. Expect one row, no 42703.
SELECT studio_compose_enabled,
       studio_compose_min_seconds,
       studio_compose_max_seconds,
       studio_compose_max_clips,
       studio_music_enabled,
       studio_music_ai_enabled
FROM public.seasons
WHERE id = 'season_0';

-- =========================================================================
-- RETIRED platform_config KEYS -- do NOT re-add. The code no longer reads them.
--   studio_music_ai_enabled     -> seasons.studio_music_ai_enabled
--   studio_music_gen_max_per_user -> seasons.studio_music_max_generations_per_round
-- Still live in platform_config (not gates, global by design):
--   studio_music_gen_cost_usd, studio_music_gen_max_seconds,
--   studio_music_artist_blocklist
--
-- Optional cleanup once the code is deployed (safe to skip; the keys are simply
-- ignored). Run only after the switch refactor ships:
--   DELETE FROM public.platform_config
--    WHERE key IN ('studio_music_ai_enabled', 'studio_music_gen_max_per_user');
-- =========================================================================

-- =========================================================================
-- TURNING MUSIC ON (do NOT run now -- TK signal only, after the ElevenLabs
-- written reply on Music API Terms 3.A and TK's own judgement):
--
--   library-only fallback (3.A-safe):
--     UPDATE public.seasons SET studio_music_enabled = true WHERE id = 'season_0';
--
--   full AI generation (requires the 3.A answer to be positive):
--     UPDATE public.seasons
--        SET studio_music_enabled = true, studio_music_ai_enabled = true
--      WHERE id = 'season_0';
--
--   change the cap:
--     UPDATE public.seasons
--        SET studio_music_max_generations_per_round = 15
--      WHERE id = 'season_0';
-- =========================================================================
