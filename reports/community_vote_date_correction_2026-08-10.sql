-- ======================================================================
-- season_0 community_vote_* correction. TK Run, one block at a time.
-- ASCII only, LF only. Written per head office 2026-08-10.
--
-- WHY: the 24h main-round processing buffer was added after the vote
-- window was last set, and the DB was never moved to match. Canonical
-- v2 is community_vote_start_at = 2026-11-13 00:00 PT,
-- community_vote_end_at = 2026-11-16 00:00 PT. The DB currently holds
-- 2026-11-12 00:00 / 2026-11-15 00:00 (the pre-buffer values).
--
-- November sits in PST (UTC-8), after the 2026-11-01 DST end, so both
-- values are written as TIMESTAMP ... AT TIME ZONE 'America/Los_Angeles'
-- rather than hand-computed UTC (same pattern as a82f1ca).
--
-- To revert if BLOCK 3 fails: ask in this same chat and the rollback
-- will be sent as its own message. It is not in this file.
-- ======================================================================


-- ----------------------------------------------------------------------
-- BLOCK 1 -- BEFORE. Read-only. Run alone.
--
-- STOP CONDITION: safe_to_proceed must be TRUE.
--   TRUE  = row still holds vote_start=11/12 00:00, vote_end=11/15 00:00
--           PT exactly as head office measured it. Continue to BLOCK 2.
--   FALSE = someone already changed the row. Do NOT run BLOCK 2 -- send
--           this output back first.
-- Expect exactly ONE row. Zero rows means the wrong database.
-- ----------------------------------------------------------------------
SELECT
  id,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  main_round_end_at
    AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  awards_announcement_at
    AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (
        community_vote_start_at =
          TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND community_vote_end_at =
          TIMESTAMP '2026-11-15 00:00' AT TIME ZONE 'America/Los_Angeles'
  ) AS safe_to_proceed
FROM public.seasons
WHERE id = 'season_0';


-- ----------------------------------------------------------------------
-- BLOCK 2 -- THE WRITE. RETURNING via CTE so the grid shows rows
-- changed (Supabase SQL Editor hides UPDATE row counts otherwise).
-- Run alone.
--
-- Expect: exactly 1 row, vote_start_pt=2026-11-13 00:00,
-- vote_end_pt=2026-11-16 00:00.
--   ZERO rows means the guard refused -- the row was not at the
--   measured 11/12 / 11/15 values, so NOTHING was written. Stop and
--   report back, do not retry.
-- ----------------------------------------------------------------------
WITH upd AS (
  UPDATE public.seasons
     SET community_vote_start_at =
           TIMESTAMP '2026-11-13 00:00' AT TIME ZONE 'America/Los_Angeles',
         community_vote_end_at =
           TIMESTAMP '2026-11-16 00:00' AT TIME ZONE 'America/Los_Angeles'
   WHERE id = 'season_0'
     AND community_vote_start_at =
           TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles'
     AND community_vote_end_at =
           TIMESTAMP '2026-11-15 00:00' AT TIME ZONE 'America/Los_Angeles'
  RETURNING id, community_vote_start_at, community_vote_end_at
)
SELECT
  id,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt
FROM upd;


-- ----------------------------------------------------------------------
-- BLOCK 3 -- AFTER. Read-only. Run alone.
--
-- Expect:
--   vote_start_pt              2026-11-13 00:00
--   vote_end_pt                2026-11-16 00:00
--   main_end_pt                2026-11-12 00:00   (unchanged)
--   awards_pt                  2026-11-16 20:00   (unchanged)
--   vote_start_after_main_end  true
--   vote_end_before_awards     true
--
-- If either boolean is false or the two dates are off, do not run
-- anything else -- report back first.
-- ----------------------------------------------------------------------
SELECT
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  main_round_end_at
    AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  awards_announcement_at
    AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (community_vote_start_at > main_round_end_at)
    AS vote_start_after_main_end,
  (community_vote_end_at <= awards_announcement_at)
    AS vote_end_before_awards
FROM public.seasons
WHERE id = 'season_0';
