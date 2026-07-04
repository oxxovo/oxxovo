-- ============================================================================
-- PIPELINE TEST SEASON  (season_test)  -- 2026-07-03
-- ============================================================================
-- Purpose: exercise the FULL Watch competition pipeline end to end
--   preliminary Triple-AI scoring -> advance to main round -> 1/2/3 awards
-- using the 20 promo "A" content videos (already in promo_videos), WITHOUT
-- touching the real season_0 data.
--
-- ISOLATION (why this does not disturb season_0 / the launch):
--   * The test season id is 'season_test', status='draft'. getCurrentSeason()
--     reads the seasons_public VIEW which excludes draft rows, so the landing
--     page / apply / Watch Hero keep showing season_0. The scoring worker reads
--     the base seasons table via service_role, so it CAN see the draft season.
--   * All test applications carry season_id='season_test' AND an email domain
--     '@pipeline-test.local'. The CLEANUP block keys on those, so real rows are
--     never touched.
--   * Run the scoring worker with SEASON_ID=season_test (see RUNBOOK comments).
--     CAUTION: the worker's candidate query filters on status='pending' but NOT
--     on season_id, so only run this while season_0 has ZERO 'pending' rows
--     (true until applications open 2026-07-25). Do the whole test before 7/25.
--
-- ASCII-only (no box characters); safe for the Supabase SQL editor.
-- ============================================================================


-- ============================================================================
-- PRE-CHECK: confirm the 20 A videos exist and their URLs are HTTPS (not s3://)
-- ============================================================================
-- Expect: count = 20, and every video_url starting with 'https://'. If the URLs
-- are 's3://...' the promo videos were published without R2_PUBLIC_BASE and the
-- scoring worker will NOT be able to download them -- fix that before running.
SELECT count(*) AS a_video_count,
       count(*) FILTER (WHERE video_url LIKE 'https://%') AS https_count,
       min(video_url) AS sample_url
FROM public.promo_videos
WHERE status = 'ready'
  AND video_url ~ 'content_A[0-9]{2}_[a-z]+_EN_9x16\.mp4$';


-- ============================================================================
-- STEP 1: create season_test by CLONING season_0 (all columns), then override
-- ============================================================================
-- Cloning copies every non-generated column (thresholds, ai_models, advance
-- policy, prize %, scoring weights, studio/theme fields) so the row is valid and
-- fully populated. Generated columns (prize_first/second/third) auto-compute.
-- Idempotent: skips if season_test already exists.
DO $$
DECLARE
  cols text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.seasons WHERE id = 'season_test') THEN
    RAISE NOTICE 'season_test already exists -- skipping clone';
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'seasons'
    AND is_generated = 'NEVER'
    AND column_name <> 'id';

  EXECUTE format(
    'INSERT INTO public.seasons (id, %1$s) '
    || 'SELECT ''season_test'', %1$s FROM public.seasons WHERE id = ''season_0''',
    cols
  );
END $$;

-- Override the identity + collapse the whole schedule into the PAST so every
-- gate (prelim close, main-round end) is already open, and clear the finalize
-- marker so the worker can (re)compute recommendations.
UPDATE public.seasons SET
  status                 = 'draft',
  season_number          = 999,
  name                   = '[TEST] Pipeline Season',
  application_open_at     = now() - interval '40 days',
  application_close_at    = now() - interval '20 days',
  main_round_start_at     = now() - interval '15 days',
  main_round_end_at       = now() - interval '10 days',
  awards_announcement_at  = now() - interval '5 days',
  scoring_complete_at     = NULL,
  application_defer_count  = 0
WHERE id = 'season_test';


-- ============================================================================
-- STEP 2: insert the 20 A promo videos as [TEST] preliminary applications
-- ============================================================================
-- status='pending' so the scoring worker picks them up. moderation_status
-- ='approved' + watch_hidden=false so they render on /watch. video URL is pulled
-- live from promo_videos (no hardcoded R2 URL). Set watch_hidden=true instead if
-- you want them scored but hidden from the public /watch grid.
WITH a_videos AS (
  SELECT
    video_url,
    substring(video_url from 'content_(A[0-9]{2}_[a-z]+)_EN_9x16') AS slot,
    row_number() OVER (ORDER BY video_url) AS n
  FROM public.promo_videos
  WHERE status = 'ready'
    AND video_url ~ 'content_A[0-9]{2}_[a-z]+_EN_9x16\.mp4$'
)
INSERT INTO public.genesis_applications (
  season_id, email, creator_name, creator_statement, country, ai_service,
  free_entry_url, video_duration_seconds, status,
  moderation_status, watch_hidden,
  agreed_to_rules, agreed_to_privacy, agreed_to_integrity_notice,
  video_title, created_at
)
SELECT
  'season_test',
  'pipeline-test-' || n || '@pipeline-test.local',
  '[TEST] ' || slot,
  'Pipeline test entry (' || slot || '). Promo content video, used to exercise '
    || 'scoring -> main round -> awards. Not a real submission.',
  'US',
  'OXXOVO Studio',
  video_url,
  17.5,
  'pending',
  'approved',
  false,
  true, true, true,
  '[TEST] ' || slot,
  now() - interval '30 days'
FROM a_videos;


-- ============================================================================
-- VERIFY (expect 20 application rows, all status='pending')
-- ============================================================================
SELECT status, count(*)
FROM public.genesis_applications
WHERE season_id = 'season_test'
GROUP BY status
ORDER BY status;

SELECT creator_name, video_duration_seconds, status, moderation_status,
       left(free_entry_url, 60) AS url_head
FROM public.genesis_applications
WHERE season_id = 'season_test'
ORDER BY creator_name;


-- ============================================================================
-- RUNBOOK  (run these AFTER Step 1+2, in order; not part of this SQL file)
-- ============================================================================
-- 1) PRELIMINARY SCORING -- run the oxxovo-scoring worker pointed at the test
--    season (status gate disabled since season_test is 'draft', not 'scoring'):
--
--      cd oxxovo-scoring
--      SEASON_ID=season_test ROUND=application SEASON_REQUIRED_STATUS='' \
--        BATCH_SIZE=20 npm start
--
--    (needs SUPABASE service_role + ANTHROPIC/OPENAI/GEMINI keys in .env)
--    Result: scoring_results(round='application') filled, applications ->
--    'eligible', and when all done maybeFinalizeSeason sets scoring_complete_at
--    + writes season_recommendations. SMOKE TEST FIRST with BATCH_SIZE=1 to
--    confirm the worker can download an R2 .mp4 (the main open risk).
--
-- 2) ADVANCE TO MAIN ROUND -- run in the SQL editor once scoring is complete:
--
--      SELECT * FROM public.advance_season_finalists('season_test');
--
--    Top N (advance_pct/min/max clamp) -> status='selected' (Finalist), the rest
--    -> 'rejected'.
--
-- 3) SIMULATE MAIN-ROUND SUBMISSIONS -- there are no real creators, so attach a
--    main-round video to each finalist and mark it submitted (reuses the same
--    promo URL as a stand-in):
--
--      UPDATE public.genesis_applications
--         SET main_round_video_url = free_entry_url,
--             main_round_submitted_at = now(),
--             status = 'main_round_submitted'
--       WHERE season_id = 'season_test' AND status = 'selected';
--
-- 4) MAIN-ROUND SCORING:
--
--      SEASON_ID=season_test ROUND=main SEASON_REQUIRED_STATUS='' \
--        BATCH_SIZE=50 npm start
--
--    Writes scoring_results(round='main'); applications stay 'main_round_
--    submitted' (main round is status-immutable by design).
--
-- 5) AWARDS (1/2/3) -- final placement is a manual admin step by design (scores
--    are AI, admin only applies). Either use /admin/applications, or set ranks
--    directly for the test, e.g. top 3 main-round verified_score:
--
--      WITH ranked AS (
--        SELECT ga.id,
--               row_number() OVER (ORDER BY sr.verified_score DESC NULLS LAST) AS rk
--        FROM public.genesis_applications ga
--        JOIN public.scoring_results sr
--          ON sr.application_id = ga.id AND sr.round = 'main'
--         AND sr.season_id = 'season_test' AND sr.judged_status = 'completed'
--        WHERE ga.season_id = 'season_test'
--      )
--      UPDATE public.genesis_applications ga
--         SET award_rank = ranked.rk, status = 'awarded'
--        FROM ranked
--       WHERE ga.id = ranked.id AND ranked.rk <= 3;


-- ============================================================================
-- CLEANUP  (run this whole block to remove ALL test data; season_0 untouched)
-- ============================================================================
-- watch_likes/views/comments/votes/reports FK genesis_applications ON DELETE
-- CASCADE. scoring_results / season_recommendations are keyed by season_id.
-- DELETE FROM public.scoring_results        WHERE season_id = 'season_test';
-- DELETE FROM public.season_recommendations WHERE season_id = 'season_test';
-- DELETE FROM public.genesis_applications   WHERE season_id = 'season_test';
-- DELETE FROM public.seasons                WHERE id = 'season_test';
--
-- Confirm clean (expect 0 / 0 / 0):
-- SELECT
--   (SELECT count(*) FROM public.genesis_applications WHERE season_id='season_test') AS apps,
--   (SELECT count(*) FROM public.scoring_results      WHERE season_id='season_test') AS scores,
--   (SELECT count(*) FROM public.seasons              WHERE id='season_test')        AS seasons;
