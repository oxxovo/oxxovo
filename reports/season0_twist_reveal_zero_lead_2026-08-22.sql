-- HQ 2026-08-22: theme_announcement_minutes_before 60 -> 0. TK confirmed the
-- twist (main_round_twist, EN "Twist" / KO "필수조건") must reveal at the
-- EXACT SAME instant main_round_start_at arrives (11/9 17:00 PT), not 60
-- minutes early (11/9 16:00 PT, the live value today).
--
-- Math check (answers TK's question below): with minutes_before = 0,
-- isTwistRevealed()'s revealMs = startMs - 0*60000 = startMs EXACTLY --
-- the same millisecond as main_round_start_at, not earlier or later. Both
-- isTwistRevealed (lib/seasons.ts) and resolveEffectiveRound's own
-- main-round switch (lib/studio.ts) use the identical `now >= X` comparison
-- against the identical timestamp, so nothing can observe one firing before
-- the other -- they are the same instant, not a race.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: theme_announcement_minutes_before = 60,
--   main_round_start_at = 2026-11-10T01:00:00+00 (2026-11-09 17:00 PT).
-- =========================================================================
SELECT
  theme_announcement_minutes_before,
  main_round_start_at,
  main_round_start_at AT TIME ZONE 'America/Los_Angeles' AS main_round_start_pt
FROM public.seasons
WHERE id = 'season_0';


-- =========================================================================
-- BLOCK 1 -- flip it. Re-run-safe (only fires if still 60). Run alone,
-- after BLOCK 0 confirms.
-- =========================================================================
WITH upd AS (
  UPDATE public.seasons
  SET
    theme_announcement_minutes_before = 0,
    updated_at = now()
  WHERE id = 'season_0'
    AND theme_announcement_minutes_before = 60
  RETURNING id, theme_announcement_minutes_before, main_round_start_at
)
SELECT * FROM upd;
-- expect: exactly 1 row, theme_announcement_minutes_before = 0. If 0 rows,
-- the value was already something other than 60 -- stop, report back.


-- =========================================================================
-- BLOCK 2 -- verify (read-only): twist reveal instant now equals
-- main_round_start_at exactly.
-- =========================================================================
SELECT
  theme_announcement_minutes_before,
  main_round_start_at AT TIME ZONE 'America/Los_Angeles' AS main_round_start_pt,
  (main_round_start_at - (theme_announcement_minutes_before || ' minutes')::interval)
    AT TIME ZONE 'America/Los_Angeles' AS twist_reveal_pt,
  (main_round_start_at - (theme_announcement_minutes_before || ' minutes')::interval = main_round_start_at)
    AS reveal_equals_main_start
FROM public.seasons
WHERE id = 'season_0';
-- expect: main_round_start_pt = twist_reveal_pt = 2026-11-09 17:00,
-- reveal_equals_main_start = true.


-- =========================================================================
-- REVERT -- do NOT run with the blocks above. Separate action only.
-- =========================================================================
-- UPDATE public.seasons SET theme_announcement_minutes_before = 60, updated_at = now()
--   WHERE id = 'season_0' AND theme_announcement_minutes_before = 0;
