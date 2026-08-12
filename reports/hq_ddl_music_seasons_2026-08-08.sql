-- =========================================================================
-- HQ item (1) -- DDL x3, file 1 of 2. Project qrnkovokjmimagrwjebs.
-- 2026-08-08, jisu (main). Actor slug is file 2 (hq_actor_slug_2026-08-08.sql).
--
-- ASCII only. LF only. One statement per block -- run the blocks IN ORDER and
-- read each result before running the next.
--
-- -------------------------------------------------------------------------
-- IMPACT ON EXISTING DATA: ZERO.
--   Every write below is either ADD COLUMN (no existing value is touched) or an
--   UPDATE of a column that did not exist one block earlier.
--   * studio_music_assets has 0 rows (measured 2026-08-08). Nothing to affect.
--   * seasons has 14 rows. No existing column is read, written, dropped or
--     retyped. The two new columns start at their DEFAULT and are then set on
--     the rows named in BLOCK 6 / BLOCK 7.
--   * No code reads either new column yet (measured: 0 hits across both repos),
--     so the window between ADD COLUMN and the UPDATEs has no observer.
--   ADD COLUMN with a non-volatile DEFAULT is metadata-only in PG11+ -- no table
--   rewrite, no lock beyond a brief ACCESS EXCLUSIVE.
--
-- -------------------------------------------------------------------------
-- MEASURED BEFORE WRITING (2026-08-08, service_role, read-only)
--   studio_music_assets: 0 rows. genre / bpm / sort_order / screening_score all
--     return 42703 -> absent. source, mood, active, status, season_id, round,
--     duration_seconds, cryptobind_signature all present.
--   seasons: 84 columns. is_fixture -> 42703 (absent).
--     scoring_start_at -> PRESENT. It was NOT added here; jenny2 withdrew that
--     claim and she was right. What had been missing was the TypeScript line in
--     lib/seasons.ts, and a type is not a column.
--     No results-announcement column exists under any of five probed names
--     (results_announced_at, results_announcement_at, prelim_results_at,
--     application_results_announced_at, preliminary_results_at).
--     prelim_released_at DOES exist and is NULL -- it is the "we released it"
--     MARKER, not a schedule. See the note on BLOCK 5.
--   14 season rows: 5 real (season_0..season_4) + 9 fixtures
--     (season_test2 #998, season_test #999, season_1000..season_1006).
--     max(season_number) over all rows = 1006, so nextNumber is 1007 today.
-- =========================================================================


-- =========================================================================
-- BLOCK 1 -- CONFIRM. Run alone. Expect: n_music_rows = 0, and the four target
-- music columns absent (present_music_cols = 0), is_fixture absent,
-- prelim_results_announcement_at absent, scoring_start_at present.
-- If any count disagrees, STOP and report -- do not run BLOCK 2.
-- =========================================================================
SELECT
  (SELECT count(*) FROM public.studio_music_assets) AS n_music_rows,
  (SELECT count(*) FROM public.seasons)             AS n_season_rows,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='studio_music_assets'
       AND column_name IN ('genre','bpm','sort_order','screening_score')) AS present_music_cols,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='seasons'
       AND column_name='is_fixture')                AS present_is_fixture,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='seasons'
       AND column_name='prelim_results_announcement_at') AS present_announce_col,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='seasons'
       AND column_name='scoring_start_at')          AS present_scoring_start_at;


-- =========================================================================
-- BLOCK 2 -- DDL 1 of 3: studio_music_assets gains 4 columns.
--
-- genre            NOT NULL DEFAULT '' -- matches the existing `mood` column
--                  exactly. genre is a curation LABEL: '' already means "not
--                  labelled" and there is no third state to represent, so a
--                  nullable text would add an ambiguity the table does not have.
--
-- bpm              NULLABLE integer. Same reasoning as screening_score: an
--                  unmeasured tempo is not 0 BPM. 0 BPM is not a slow track, it
--                  is not a track. CHECK bounds it to a musically real range so
--                  a units mistake (Hz, ms-per-beat) is rejected at write time
--                  rather than sorted with.
--
-- sort_order       NOT NULL DEFAULT 0. Hand curation. Ascending, so a curator
--                  lowers a number to lift a track. 0 is the "not hand-placed"
--                  bulk, which is where all 1,000 start -- that is exactly why
--                  the tiebreak below has to be a total order.
--
-- screening_score  NULLABLE numeric(5,2), 0..100. THREE conditions, in order:
--   (a) ONE FACT ONLY: a machine score. It does NOT mean "we adopted this".
--       Adoption already has a column -- `active` -- and it is already what the
--       picker filters on (lib/studio.ts listMusicAssets). A score that also
--       meant adoption would be the scoring_complete_at mistake again: two
--       meanings in one column, where the first silently disables the second.
--   (b) NULLABLE, deliberately. NOT NULL DEFAULT 0 would make every one of the
--       1,000 tracks read as a measured zero the moment it lands, so an
--       unscreened track would sort as the worst track and disappear under any
--       "worst first" review -- absence disguised as a verdict. NULL says
--       "not measured yet" and nothing else. Fail-visible, not fail-quiet.
--   (c) tiebreak: see BLOCK 3.
-- =========================================================================
ALTER TABLE public.studio_music_assets
  ADD COLUMN IF NOT EXISTS genre           text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bpm             integer,
  ADD COLUMN IF NOT EXISTS sort_order      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screening_score numeric(5,2),
  ADD CONSTRAINT studio_music_assets_bpm_check
    CHECK (bpm IS NULL OR (bpm > 0 AND bpm <= 400)),
  ADD CONSTRAINT studio_music_assets_screening_score_check
    CHECK (screening_score IS NULL OR (screening_score >= 0 AND screening_score <= 100));


-- =========================================================================
-- BLOCK 3 -- the tiebreak, as an index (condition (c)).
--
-- THE ORDER IS:  sort_order ASC, screening_score DESC NULLS LAST, id ASC
--
-- Why it has to be pinned: with 1,000 tracks and sort_order defaulting to 0,
-- almost every row ties on the first key. Postgres gives NO ordering guarantee
-- between rows that compare equal, so a two-key sort lets the same query return
-- a different page 2 each time it is asked. The list would reshuffle under the
-- curator between clicks, and a track could be seen twice or never.
--
-- The last key is `id`, which is the PRIMARY KEY. That is the whole point: the
-- final key must be UNIQUE, or the order is still only partial and the shuffle
-- comes back. sort_order and screening_score decide what a human meant; id only
-- decides what happens when they meant nothing, and it is stable forever.
--
-- NULLS LAST on screening_score: an unmeasured track must not outrank a
-- measured one. It shares the bottom with a measured 0.00, which is correct for
-- ORDERING and still fully distinguishable in the DATA (IS NULL vs = 0) --
-- that distinction is (b)'s job, not the sort's.
--
-- Partial index: the picker only ever lists active+ready library beds, so the
-- AI rows (one per participant per generation) stay out of it.
-- =========================================================================
CREATE INDEX IF NOT EXISTS studio_music_assets_pick_idx
  ON public.studio_music_assets (sort_order ASC, screening_score DESC NULLS LAST, id ASC)
  WHERE source = 'library' AND active AND status = 'ready';


-- =========================================================================
-- BLOCK 4 -- DDL 2 of 3: seasons.is_fixture.
--
-- (a) ONE FACT: "this row is test data". It does NOT mean "hidden from the
--     lobby". Visibility is DERIVED (official + not draft + not fixture), and
--     lib/lobby.ts already composes it that way.
--
-- (b) DEFAULT true = fail-closed. All 14 existing rows become true; BLOCK 6
--     then writes false on the 5 real ones. A human has to assert "this is
--     real" -- forgetting produces a hidden season, not a leaked one. Today the
--     rule is inverted: lib/lobby.ts guesses from the id prefix and from
--     season_number >= 900, and the file says so in its own LIMITATION comment
--     -- a future rehearsal numbered below 900 with an unconventional id leaks
--     onto the public lobby, and nothing at creation time prevents that.
--
-- (c) nextNumber: code, shipped in the same commit. See the note under BLOCK 8.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT true;


-- =========================================================================
-- BLOCK 5 -- DDL 3 of 3: seasons.prelim_results_announcement_at.
--
-- NAME. It is a SCHEDULE ("when we will tell them"), and the name has to say so,
-- because this table already contains the counter-example: scoring_complete_at
-- carried BOTH a planned date (app) and a "already-finalized" marker (worker), and the
-- planned date silently disabled the marker -- season_0 would never have produced
-- a Top N recommendation. The worker was moved off it on 2026-08-06.
--   * prelim_results_announcement_at  = SCHEDULE. New. Set by hand / by admin.
--   * prelim_released_at              = MARKER. Already exists, currently NULL,
--                                       written when the hold is actually lifted.
-- Two columns, two facts. The suffix _announcement_at matches the existing
-- awards_announcement_at, which is the same kind of thing for the other end of
-- the season.
--
-- NULLABLE: a season that has not scheduled its announcement has no value to
-- put here, and 'now()' or 'close' would be a guess written as a fact.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prelim_results_announcement_at timestamptz;


-- =========================================================================
-- BLOCK 6 -- the 5 real seasons say so explicitly. Expect EXACTLY 5 rows back.
-- If the count is not 5, STOP: something else is in the real band.
-- =========================================================================
UPDATE public.seasons
   SET is_fixture = false
 WHERE id IN ('season_0', 'season_1', 'season_2', 'season_3', 'season_4')
RETURNING id, season_number, status, is_fixture;


-- =========================================================================
-- BLOCK 7 -- engrave the season_0 announcement time. Expect EXACTLY 1 row.
--
-- * TIME ZONE IS DECLARED, NOT COMPUTED. The order said "11/8 12:00". Every
-- other season_0 timestamp in this table is a Las Vegas wall-clock instant
-- stored as UTC (awards_announcement_at = 2026-11-17T04:00Z = 11/16 21:00 PT),
-- and DST ends 2026-11-01, so 11/8 is PST. Rather than do that arithmetic by
-- hand and hide the assumption in a literal, the zone is written into the
-- value and Postgres resolves it. Reading back as UTC must give
--   2026-11-08 20:00:00+00
-- * If HQ meant 12:00 UTC rather than 12:00 Las Vegas, this is the one line to
-- change and it is an 8-hour difference in when 450 emails leave.
-- =========================================================================
UPDATE public.seasons
   SET prelim_results_announcement_at = TIMESTAMPTZ '2026-11-08 12:00:00 America/Los_Angeles'
 WHERE id = 'season_0'
RETURNING id, prelim_results_announcement_at,
          scoring_complete_at, main_round_start_at;


-- =========================================================================
-- BLOCK 8 -- VERIFY. Run after 2..7. All seven columns must read as stated.
--
--  n_new_music_cols                 = 4
--  pick_index                       = 1
--  n_fixture_true                   = 9   (season_test2, season_test, 1000..1006)
--  n_fixture_false                  = 5   (season_0..season_4)
--  max_real_season_number           = 4   <- this is what nextNumber now reads;
--                                            it was 1006, i.e. next = 1007
--  season_0_announce_utc            = 2026-11-08 20:00:00+00
--  whitespace_ok                    = 0   (no CR/LF smuggled into a column name
--                                            on the way through chat)
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='studio_music_assets'
       AND column_name IN ('genre','bpm','sort_order','screening_score'))      AS n_new_music_cols,
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname='public' AND indexname='studio_music_assets_pick_idx')   AS pick_index,
  (SELECT count(*) FROM public.seasons WHERE is_fixture)                       AS n_fixture_true,
  (SELECT count(*) FROM public.seasons WHERE NOT is_fixture)                   AS n_fixture_false,
  (SELECT max(season_number) FROM public.seasons WHERE NOT is_fixture)         AS max_real_season_number,
  (SELECT prelim_results_announcement_at AT TIME ZONE 'UTC'
     FROM public.seasons WHERE id='season_0')                                  AS season_0_announce_utc,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name IN ('seasons','studio_music_assets')
       AND column_name ~ '\s')                                                 AS whitespace_ok;


-- =========================================================================
-- BLOCK 9 -- per-row read of the fixture flag. Expect the 5 false rows to be
-- exactly season_0..season_4 and nothing else.
-- =========================================================================
SELECT id, season_number, status, is_fixture, prelim_results_announcement_at
FROM public.seasons
ORDER BY is_fixture, season_number;


-- =========================================================================
-- FOLLOW-UP, NOT PART OF THIS RUN -- seasons_public does not carry the new
-- columns, and it cannot be fixed blind.
--
-- MEASURED 2026-08-08: the public lobby reads the VIEW public.seasons_public,
-- not the base table. That view exposes 66 of the base table's 84 columns as an
-- explicit list -- it is not SELECT *. So ADD COLUMN on `seasons` does NOT make
-- is_fixture visible to the lobby, and adding it to the lobby's select list
-- before the view is recreated would 42703 the WHOLE select and blank the home
-- page. That is precisely the studio_music_enabled incident of 2026-07-27.
--
-- Therefore the code shipped with this migration moves ONLY the two server-side
-- base-table readers (season-tick, host/new). The lobby keeps its heuristic
-- until the view is dealt with, and it now uses the column when one is present.
--
-- To deal with it we first need the definition, which is not in the repo:
--   SELECT pg_get_viewdef('public.seasons_public'::regclass, true);
-- Run that whenever HQ wants the lobby moved over, and I will write the
-- CREATE OR REPLACE VIEW from the actual text rather than from a guess.
-- =========================================================================
