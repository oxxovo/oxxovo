-- =========================================================================
-- Publication switches, FAIL-CLOSED (HQ 2026-10-03). Supersedes
-- reports/competition_publication_switch_2026-09-27.sql (that file inserts
-- 'true' -- do NOT run it).
--
-- Code (lib/publication-flag.ts) treats a missing row, a query error, or any
-- value other than 'true' as CLOSED. The competition is paused, so the row goes
-- in as 'false'. Run order: BLOCK 0 (read-only) -> BLOCK 1 -> BLOCK 2.
-- Each block is one statement; run them one at a time.
-- =========================================================================

-- BLOCK 0 -- confirm neither key exists yet. Read-only. Expect 0 rows.
SELECT key, value, value_type FROM public.platform_config
WHERE key IN ('competition_publication_enabled', 'news_publication_enabled');


-- BLOCK 1 -- Competition Publication switch, closed.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'competition_publication_enabled',
  'false',
  'bool',
  'Competition content publicly visible when true. ANDed with WATCH_PUBLIC_ENABLED. Closed while the competition is paused.',
  '대회 콘텐츠 공개 여부. WATCH_PUBLIC_ENABLED와 AND 조건. 대회 중단 동안 닫힘.'
)
RETURNING key, value, value_type, updated_at;


-- BLOCK 2 -- News Publication switch, closed. No code reads it until Phase 1.
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'news_publication_enabled',
  'false',
  'bool',
  'News content publicly visible when true. Independent of competition_publication_enabled.',
  '뉴스 콘텐츠 공개 여부. competition_publication_enabled와 독립.'
)
RETURNING key, value, value_type, updated_at;
