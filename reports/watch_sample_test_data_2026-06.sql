-- ============================================================================
-- WATCH SAMPLE TEST DATA (season_0) -- VISUAL TEST ONLY, DELETE BEFORE LAUNCH
-- ============================================================================
-- Purpose: seed 5 sample submissions so /watch renders with real video cards,
--          detail player, likes/comments, recommended sidebar, sort, season
--          filter. moderation_status='approved' so they show WITHOUT OPENAI_API_KEY.
--
-- TEST MARKER (mandatory): every row has creator_name starting with '[TEST]'
--   AND email ending '@watch-test.local'. Both are unique to these rows, so the
--   DELETE block at the bottom removes them cleanly (keeps B1 test count = 0).
--
-- Row 1 also carries a MAIN ROUND video -> renders TWO cards (Preliminary +
--   Main Round) so the round badge + main-round detail (community vote) show.
-- Row 3 is staff_pick=true -> "Staff Pick" badge.
--
-- Notes:
--   * season_id is TEXT 'season_0' (FK seasons.id), NOT a UUID.
--   * status uses 'eligible' / 'main_round_submitted' (NOT rejected/flagged).
--   * YouTube watch?v= URLs embed + auto-thumbnail with no API key.
--   * user_id NULL -> creator_name is the displayed name (no nickname lookup).
-- ============================================================================

INSERT INTO public.genesis_applications (
  season_id, email, creator_name, creator_statement, country, ai_service,
  free_entry_url, video_duration_seconds, status,
  main_round_video_url, main_round_submitted_at,
  staff_pick, staff_pick_at,
  moderation_status, watch_hidden,
  agreed_to_rules, agreed_to_privacy, agreed_to_integrity_notice,
  created_at
) VALUES
  -- 1) Prelim + Main Round (two cards), Runway
  ('season_0', 'test-watch-1@watch-test.local', '[TEST] Nova Park',
   'A neon-soaked city wakes up. Built to test pacing and color grading on AI footage.',
   'KR', 'Runway Gen-3',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 22, 'main_round_submitted',
   'https://www.youtube.com/watch?v=OPf0YbXqDm0', now() - interval '1 hour',
   false, NULL,
   'approved', false,
   true, true, true,
   now() - interval '5 hours'),

  -- 2) Prelim only, Sora, Korean name (unicode render check)
  ('season_0', 'test-watch-2@watch-test.local', '[TEST] 김레오 Leo Kim',
   'Slow-motion bloom of an impossible flower. Testing high-detail organic motion.',
   'KR', 'Sora',
   'https://www.youtube.com/watch?v=9bZkp7q19f0', 18, 'eligible',
   NULL, NULL,
   false, NULL,
   'approved', false,
   true, true, true,
   now() - interval '4 hours'),

  -- 3) Prelim only, Pika, STAFF PICK
  ('season_0', 'test-watch-3@watch-test.local', '[TEST] Aria Voss',
   'A lighthouse keeper and a storm. Editorial-curation badge test.',
   'US', 'Pika',
   'https://www.youtube.com/watch?v=kJQP7kiw5Fk', 27, 'eligible',
   NULL, NULL,
   true, now() - interval '3 hours',
   'approved', false,
   true, true, true,
   now() - interval '3 hours'),

  -- 4) Prelim only, OXXOVO Studio, short clip
  ('season_0', 'test-watch-4@watch-test.local', '[TEST] DJ Mirai',
   'Glitch-beat visualizer in 15 seconds. Testing the duration badge + thumbnail.',
   'JP', 'OXXOVO Studio',
   'https://www.youtube.com/watch?v=JGwWNGJdvx8', 15, 'eligible',
   NULL, NULL,
   false, NULL,
   'approved', false,
   true, true, true,
   now() - interval '2 hours'),

  -- 5) Prelim only, Kling, longest clip
  ('season_0', 'test-watch-5@watch-test.local', '[TEST] Sol Ramirez',
   'Desert road at golden hour, drifting into surreal geometry. Trending-sort check.',
   'MX', 'Kling AI',
   'https://www.youtube.com/watch?v=RgKAFK5djSk', 30, 'eligible',
   NULL, NULL,
   false, NULL,
   'approved', false,
   true, true, true,
   now() - interval '1 hour');

-- Verify they landed (expect 5 rows)
SELECT creator_name, ai_service, status, moderation_status, watch_hidden,
       (main_round_video_url IS NOT NULL) AS has_main_round, staff_pick
FROM public.genesis_applications
WHERE email LIKE '%@watch-test.local'
ORDER BY created_at;


-- ============================================================================
-- DELETE BEFORE LAUNCH  (run this whole block; restores B1 test count = 0)
-- ============================================================================
-- watch_likes / watch_views / watch_comments / watch_votes / watch_video_reports
-- all FK genesis_applications(id) ON DELETE CASCADE, so deleting the application
-- rows auto-removes any interactions. Keyed strictly on the test email domain
-- so production rows are untouched.

DELETE FROM public.genesis_applications WHERE email LIKE '%@watch-test.local';

-- Confirm clean (expect 0)
SELECT count(*) AS remaining_test_rows
FROM public.genesis_applications
WHERE email LIKE '%@watch-test.local';
