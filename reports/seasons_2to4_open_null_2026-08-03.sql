-- ======================================================================
-- season_2 / season_3 / season_4 -- clear the open dates that would
-- hijack season_0's extended run.  TK Run.
-- ASCII only, LF only, every line under 78 columns (chat-copy safe).
--
-- Head office approved 2026-08-03: same prescription as season_1 on
-- 2026-07-27 -- application_open_at NULL, application_close_at NULL,
-- status left at 'upcoming'.
--
-- Run AFTER the season_0 postponement
-- (reports/season0_schedule_shift_5w_2026-08-03.sql) has passed its
-- BLOCK 3. Order matters only for BLOCK 3's last check, which measures
-- against season_0's new awards date.
--
--   BLOCK 1  read-only  (before + stop condition)
--   BLOCK 2  THE WRITE  (one statement, three rows)
--   BLOCK 3  read-only  (verification)
--
-- The ROLLBACK is at the BOTTOM, OUTSIDE the run order.
--
-- ----------------------------------------------------------------------
-- WHY
--
--   getCurrentSeason() (lib/seasons.ts:284) returns the most recently
--   OPENED season -- application_open_at <= now(), ordered descending --
--   and it does NOT filter on status. Three seeded rows now open inside
--   season_0's postponed run:
--
--     season_2  opens 2026-10-12 00:00 PT  (season_0 still taking
--                                           entries; close is 11/4)
--     season_3  opens 2026-10-26 00:00 PT
--     season_4  opens 2026-11-08 23:00 PT  (season_0's main round
--                                           starts 11/9)
--
--   It is worse than a pointer flip. season_2 and season_3 also carry a
--   close date, and season-tick's desiredStatus() drives status off
--   exactly these two columns -- so season_2 would go 'active' on 10/12
--   and 'closed' on 10/19, cycling a season nobody is running through
--   the public lifecycle while season_0 is mid-competition.
--
--   NULL is the safe value and the one the code already designs for
--   (verified on the current source, 2026-08-03):
--     - getCurrentSeason: .lte('application_open_at', now) excludes
--       NULL, so these rows can never become current. The "soonest
--       upcoming" fallback only runs when NOTHING has opened, which is
--       not the case while season_0 is open.
--     - desiredStatus (season-tick route.ts:72): with open, close and
--       awards all NULL it returns 'draft' (rank 0), and the
--       forward-only guard (rank 0 <= upcoming's 1) leaves the row
--       alone. The teaser stays 'upcoming'.
--     - deriveLobbyMode (lib/lobby.ts): open == null -> 'upcoming', the
--       documented teaser state.
--   A far-future placeholder would instead publish a countdown to a
--   date we would then have to move again. NULL promises nothing.
--
--   Scope: these three rows have ONLY open/close set -- every other
--   schedule column is already NULL (measured). So this clears the row
--   entirely, it does not leave a half-set schedule behind.
--
-- ----------------------------------------------------------------------
-- SIDE NOTE, not fixed here: two of these rows are already an hour off,
-- which is what a hand-written UTC seed looks like across the 11/1 DST
-- edge. season_3's close reads 2026-11-01 22:59 PT and season_4 opens
-- 2026-11-08 23:00 PT -- both were meant to be 23:59 / 00:00, but were
-- stored as ...07:00Z / ...06:59Z on the PDT (UTC-7) assumption. They
-- are being cleared, so nothing needs correcting today. It matters when
-- these seasons are re-seeded: use the wall-clock + AT TIME ZONE form,
-- the same as the season_0 file, not hand-written UTC.
-- ======================================================================


-- ----------------------------------------------------------------------
-- BLOCK 1 -- BEFORE. Read-only. Run alone.
--
-- STOP CONDITION: all three rows must show safe_to_proceed = true.
--   TRUE  = the row still holds the instants measured 2026-08-03, so
--           the ROLLBACK at the bottom is accurate. Continue.
--   FALSE = someone changed it since. DO NOT RUN BLOCK 2. Send this
--           output back first.
--   Expect exactly THREE rows, all status 'upcoming'.
--
-- The comparison is written as absolute UTC instants on purpose. These
-- are pre-existing values, two of them an hour off the intended wall
-- clock (see SIDE NOTE), so the instant -- not the intent -- is what
-- has to match for a rollback to be faithful.
-- ----------------------------------------------------------------------
SELECT
  id,
  status,
  season_number,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  application_close_at
    AT TIME ZONE 'America/Los_Angeles' AS close_pt,
  (
    scoring_start_at IS NULL AND scoring_complete_at IS NULL
    AND main_round_start_at IS NULL AND main_round_end_at IS NULL
    AND community_vote_start_at IS NULL
    AND community_vote_end_at IS NULL
    AND awards_announcement_at IS NULL
  ) AS rest_already_null,
  (
    status = 'upcoming'
    AND (id, application_open_at, application_close_at) IN (
      ('season_2', TIMESTAMPTZ '2026-10-12 07:00:00+00',
                   TIMESTAMPTZ '2026-10-19 06:59:00+00'),
      ('season_3', TIMESTAMPTZ '2026-10-26 07:00:00+00',
                   TIMESTAMPTZ '2026-11-02 06:59:00+00'),
      ('season_4', TIMESTAMPTZ '2026-11-09 07:00:00+00',
                   TIMESTAMPTZ '2026-11-16 06:59:00+00')
    )
  ) AS safe_to_proceed
FROM public.seasons
WHERE id IN ('season_2','season_3','season_4')
ORDER BY season_number;


-- ----------------------------------------------------------------------
-- BLOCK 2 -- THE WRITE. One statement, three rows. Run alone.
--
-- Expect: "UPDATE 3".
--   Any other number means the guard matched a different set than
--   expected -- stop and report. Do not remove the guard and retry.
--   UPDATE 0 in particular is safe: nothing was written.
--
-- status is deliberately NOT touched. It stays 'upcoming', and with
-- every date column NULL the tick's forward-only guard keeps it there.
-- ----------------------------------------------------------------------
UPDATE public.seasons
   SET application_open_at  = NULL,
       application_close_at = NULL
 WHERE id IN ('season_2','season_3','season_4')
   AND (id, application_open_at) IN (
     ('season_2', TIMESTAMPTZ '2026-10-12 07:00:00+00'),
     ('season_3', TIMESTAMPTZ '2026-10-26 07:00:00+00'),
     ('season_4', TIMESTAMPTZ '2026-11-09 07:00:00+00')
   );


-- ----------------------------------------------------------------------
-- BLOCK 3 -- AFTER. Read-only. Run alone.
--
-- Expect 3a: five rows.
--   season_0  active    open 2026-07-25 00:00  close 2026-11-04 00:00
--   season_1  upcoming  open NULL              close NULL
--   season_2  upcoming  open NULL              close NULL
--   season_3  upcoming  open NULL              close NULL
--   season_4  upcoming  open NULL              close NULL
--   opened_already = true for season_0 ONLY.
--   season_0's own dates must be unchanged -- this file never writes to
--   it, so a change there means the wrong statement was run.
--
-- Expect 3b: ZERO rows. This is the hijack query from the season_0
--   file, re-run. Any row that comes back is a date on which the public
--   "current season" pointer would still leave season_0 mid-run.
--
-- (3b reads the base table. getCurrentSeason() reads the seasons_public
--  VIEW, which is a projection of these same rows -- same ids, same
--  application_open_at -- so the pick is identical. Noted because the
--  view is the path the app actually takes.)
-- ----------------------------------------------------------------------
SELECT
  id,
  status,
  season_number,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  application_close_at
    AT TIME ZONE 'America/Los_Angeles' AS close_pt,
  (application_open_at IS NOT NULL AND application_open_at <= now())
    AS opened_already
FROM public.seasons
WHERE id IN ('season_0','season_1','season_2','season_3','season_4')
ORDER BY season_number;

-- 3b) Must return ZERO rows.
SELECT
  id,
  status,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS hijacks_on_pt
FROM public.seasons
WHERE application_open_at IS NOT NULL
  AND id <> 'season_0'
  AND application_open_at >
      (SELECT application_open_at
         FROM public.seasons WHERE id = 'season_0')
  AND application_open_at <
      (SELECT awards_announcement_at
         FROM public.seasons WHERE id = 'season_0')
ORDER BY application_open_at;


-- ======================================================================
-- ROLLBACK -- DO NOT RUN UNLESS BLOCK 3 FAILED.
--
-- Not part of the sequence above. Written as absolute UTC instants
-- because that is what was actually stored on 2026-08-03 22:15 PT --
-- restoring the wall clock would silently "fix" the hour those two rows
-- were off by, which is not a rollback.
--
--   UPDATE public.seasons
--      SET application_open_at  = TIMESTAMPTZ '2026-10-12 07:00:00+00',
--          application_close_at = TIMESTAMPTZ '2026-10-19 06:59:00+00'
--    WHERE id = 'season_2';
--
--   UPDATE public.seasons
--      SET application_open_at  = TIMESTAMPTZ '2026-10-26 07:00:00+00',
--          application_close_at = TIMESTAMPTZ '2026-11-02 06:59:00+00'
--    WHERE id = 'season_3';
--
--   UPDATE public.seasons
--      SET application_open_at  = TIMESTAMPTZ '2026-11-09 07:00:00+00',
--          application_close_at = TIMESTAMPTZ '2026-11-16 06:59:00+00'
--    WHERE id = 'season_4';
-- ======================================================================
