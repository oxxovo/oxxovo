-- =========================================================================
-- *** SUPERSEDED 2026-10-03 -- DO NOT RUN. The code is now fail-closed and this
-- *** file inserts 'true' (open). Use competition_publication_switch_2026-10-03.sql.
-- =========================================================================
-- Phase 0-3 (HQ 2026-09-27) -- platform_config rows for the two new switches.
-- NOT RUN by this change. Code (lib/competition-publication.ts) already
-- defaults competition_publication_enabled=true when this row is absent, so
-- running this is optional polish (makes the switch visible/editable in
-- /admin/settings) rather than a blocker. Read-only until BLOCK 1/2.
--
-- ASCII only, LF only. One block = one INSERT.
-- =========================================================================

-- BLOCK 0 -- confirm neither key exists yet. Read-only.
SELECT key, value, value_type FROM public.platform_config
WHERE key IN ('competition_publication_enabled', 'news_publication_enabled');
-- expect: 0 rows


-- BLOCK 1 -- Competition Publication switch. Default 'true' so inserting this
-- row changes NOTHING on its own -- it only makes the switch visible and
-- editable in /admin/settings (isRiskKey('*_enabled') already covers the
-- confirm-step, platform_config_history already covers the audit log).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'competition_publication_enabled',
  'true',
  'bool',
  'Competition content (Watch: /watch, /watch/[id], /watch-arena, /watch/rankings, the watch-as-home root, and /api/watch/stats) is publicly visible when true. ANDed with WATCH_PUBLIC_ENABLED (env, Platform Availability) -- both must be true. false = competition content closed WITHOUT touching the env switch or redeploying.',
  '대회 콘텐츠(Watch: /watch, /watch/[id], /watch-arena, /watch/rankings, watch-as-home 루트, /api/watch/stats)가 공개되는지 여부. WATCH_PUBLIC_ENABLED(env, Platform Availability)와 AND 조건 -- 둘 다 true여야 공개. false로 두면 env 스위치나 재배포 없이 대회 콘텐츠만 닫힘.'
)
RETURNING key, value, value_type, updated_at;


-- BLOCK 2 -- News Publication switch. Placeholder ONLY -- no code reads this key
-- yet (Daily News is not implemented). Default 'false' (nothing to publish).
INSERT INTO public.platform_config (key, value, value_type, description, description_ko)
VALUES (
  'news_publication_enabled',
  'false',
  'bool',
  'RESERVED for Daily News / Media Hub publication (not yet implemented -- Phase 0-3 placeholder only, HQ 2026-09-27). Must stay independent of competition_publication_enabled: Competition may be closed while News stays open.',
  'Daily News / Media Hub 공개용 예약 키(아직 미구현 -- Phase 0-3 자리만, HQ 2026-09-27). competition_publication_enabled와 독립적이어야 함 -- Competition이 닫혀도 News는 열 수 있어야 함.'
)
RETURNING key, value, value_type, updated_at;


-- Rollback (separate, do not run unless BLOCK 1/2 need to be undone):
-- DELETE FROM public.platform_config WHERE key = 'competition_publication_enabled';
-- DELETE FROM public.platform_config WHERE key = 'news_publication_enabled';
