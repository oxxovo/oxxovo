-- =========================================================================
-- HQ item (1) -- seasons_public gains the two columns added on 2026-08-08.
-- Project qrnkovokjmimagrwjebs. 2026-08-09, jisu (main).
--
-- ASCII only. LF only. THREE BLOCKS. Run them IN ORDER and read each result
-- before running the next. BLOCK 1 writes nothing.
--
-- -------------------------------------------------------------------------
-- TWO CORRECTIONS TO THE ORDER, BOTH LOAD-BEARING. READ BEFORE BLOCK 2.
--
-- (1) IT IS 68 COLUMNS, NOT 69. The order named three columns, but only TWO of
--     them are absent from the view. scoring_start_at IS ALREADY ON IT --
--     measured 2026-08-09 as anon through the view, which returned a real value
--     for season_0 (2026-11-05T08:00:00Z), and HQ's own probe reports
--     has_scoring_start = true in the same breath. Adding it again is a
--     duplicate column and BLOCK 2 would fail outright.
--       66 + is_fixture + prelim_results_announcement_at = 68.
--
-- (2) SECURITY INVOKER IS NOT WHAT THIS VIEW HAS, AND ADDING IT TAKES THE
--     PUBLIC SITE DOWN. Measured, not reasoned:
--       anon -> seasons_public   200, 14/14 rows
--       anon -> seasons          42501 permission denied (with the GRANT hint)
--     A security_invoker view checks the BASE table against the CALLING role.
--     anon has no privilege on public.seasons at all, so if this view were
--     security_invoker the first read would already be 42501 -- it is not.
--     The view runs with its owner's rights today, and that is the only reason
--     anon can read a curated projection of a table it is locked out of.
--     So BLOCK 2 declares NO options, which preserves exactly that. The
--     protection here is the column list plus the grants, not RLS.
--     **If BLOCK 1 reports view_reloptions as anything other than (none), STOP
--     and send it to me: CREATE OR REPLACE resets view options, so a non-empty
--     value has to be re-declared verbatim rather than dropped.
--
-- -------------------------------------------------------------------------
-- WHY THIS IS CREATE OR REPLACE AND NOT DROP + CREATE
--   * The grants are not the default set (service_role gets 42501 on this view,
--     anon does not). DROP discards them; REPLACE keeps them.
--   * REPLACE may only APPEND columns -- it cannot rename, reorder or retype an
--     existing one. If the list below were wrong in any of those ways Postgres
--     REFUSES the statement instead of quietly changing what a column means.
--     That is the safety property, so the list is not defended by care alone.
--
-- WHERE THE 66 COLUMNS CAME FROM
--   Generated from the LIVE catalog, in ordinal order, and not retyped: the
--   list below was written by a script reading the running database's schema.
--   Also verified there, so the projection is provably plain:
--     * every one of the 66 view columns exists on public.seasons under the
--       SAME NAME -- no renames, no computed columns;
--     * type and format match the base column for all 66 -- no casts.
--   The one thing a column list cannot show is a row filter, which is why
--   BLOCK 1 asks the definition itself and BLOCK 2 must not be run if it
--   answers yes. See has_where_clause below.
-- =========================================================================


-- =========================================================================
-- BLOCK 1 -- CONFIRM. Read-only. Run alone.
--
-- EXPECT, and every one of these is a STOP condition if it disagrees:
--   n_view_cols                = 66
--   has_is_fixture             = false     <- the two we are adding
--   has_announce               = false
--   has_scoring_start          = true      <- already there; NOT being added
--   view_owner                 = postgres
--   view_reloptions            = (none)    <- see correction (2)
--   anon_can_select            = true      <- and must still be true in BLOCK 3
--   service_role_can_select    = false     <- yes, false. That is the current
--                                             state and REPLACE preserves it.
--   other_relations_referenced = 0         <- the view reads public.seasons and
--                                             nothing else
--   has_where_clause           = false     <- **THE ONE THAT MATTERS MOST.
--        A column list cannot reveal a row filter. If the live definition has a
--        WHERE, then BLOCK 2's plain projection would publish rows the view
--        currently hides, and on the one relation anon is allowed to read that
--        is an exposure and not a rendering bug. It reads false today for a
--        reason I can see indirectly (anon gets 14 of 14 rows), but 14 of 14
--        only proves the filter passes every CURRENT row -- so the definition
--        is asked directly. If this comes back true, STOP and send me the
--        output of pg_get_viewdef; BLOCK 2 is wrong and I will rewrite it.
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public')            AS n_view_cols,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'is_fixture')                                   AS has_is_fixture,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'prelim_results_announcement_at')               AS has_announce,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'scoring_start_at')                             AS has_scoring_start,
  (SELECT pg_get_userbyid(relowner) FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                             AS view_owner,
  (SELECT coalesce(array_to_string(reloptions, ', '), '(none)') FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                             AS view_reloptions,
  has_table_privilege('anon',         'public.seasons_public', 'SELECT')         AS anon_can_select,
  has_table_privilege('service_role', 'public.seasons_public', 'SELECT')         AS service_role_can_select,
  (SELECT count(DISTINCT d.refobjid)
     FROM pg_depend d
     WHERE d.classid = 'pg_rewrite'::regclass
       AND d.objid IN (SELECT oid FROM pg_rewrite
                         WHERE ev_class = 'public.seasons_public'::regclass)
       AND d.refclassid = 'pg_class'::regclass
       AND d.refobjid NOT IN ('public.seasons'::regclass,
                              'public.seasons_public'::regclass))               AS other_relations_referenced,
  (pg_get_viewdef('public.seasons_public'::regclass, true) ~* '\mwhere\M')      AS has_where_clause;


-- =========================================================================
-- BLOCK 2 -- REDEFINE. Run ONLY after BLOCK 1 matched every expected value,
-- and in particular ONLY if has_where_clause = false.
--
-- 68 columns: the existing 66 in their existing order, then the two new ones
-- appended. Nothing is renamed, reordered or retyped -- Postgres enforces that
-- for us and will refuse the statement rather than let it happen quietly.
--
-- NO WITH (...) CLAUSE, deliberately. See correction (2) in the header: this
-- view does not run as the invoker and must not start, or anon loses its only
-- readable projection of a table it has no privilege on.
-- =========================================================================
CREATE OR REPLACE VIEW public.seasons_public AS
SELECT
  s.id,
  s.name,
  s.season_number,
  s.status,
  s.max_applicants,
  s.top_n_advance,
  s.application_video_min_seconds,
  s.application_video_max_seconds,
  s.total_prize_pool,
  s.entry_fee,
  s.main_round_video_seconds,
  s.theme_announcement_minutes_before,
  s.submission_hours,
  s.community_vote_weight,
  s.ai_score_weight,
  s.scoring_intent_clarity_weight,
  s.scoring_execution_weight,
  s.scoring_originality_weight,
  s.scoring_integrity_weight,
  s.ai_models,
  s.flag_integrity_threshold,
  s.flag_spread_threshold,
  s.application_open_at,
  s.application_close_at,
  s.scoring_complete_at,
  s.main_round_start_at,
  s.main_round_end_at,
  s.awards_announcement_at,
  s.created_at,
  s.updated_at,
  s.prize_first_pct,
  s.prize_second_pct,
  s.prize_third_pct,
  s.prize_first,
  s.prize_second,
  s.prize_third,
  s.display_name,
  s.main_round_video_min_seconds,
  s.main_round_video_max_seconds,
  s.deadline_reminder_hours,
  s.award_prizes,
  s.flag_integrity_high_threshold,
  s.flag_integrity_medium_threshold,
  s.flag_integrity_low_threshold,
  s.season_theme,
  s.allowed_video_platforms,
  s.scoring_start_at,
  s.host_type,
  s.host_user_id,
  s.prize_pool_escrow_status,
  s.prize_pool_escrow_paid_at,
  s.commission_rate_override,
  s.prize_funding_mode,
  s.poster_url,
  s.lobby_featured,
  s.min_participants,
  s.application_defer_count,
  s.defer_extension_days,
  s.max_defer_count,
  s.advance_pct,
  s.advance_min,
  s.advance_max,
  s.main_round_theme,
  s.community_vote_start_at,
  s.community_vote_end_at,
  s.main_round_theme_label,
  s.is_fixture,   -- NEW (1 of 2)
  s.prelim_results_announcement_at   -- NEW (2 of 2)
FROM public.seasons s;


-- =========================================================================
-- BLOCK 3 -- VERIFY. Run after BLOCK 2.
--
-- EXPECT:
--   n_view_cols             = 68        <- 66 + 2, per correction (1)
--   has_is_fixture          = true
--   has_announce            = true
--   has_scoring_start       = true      <- unchanged, and proof nothing was lost
--   n_rows_through_view     = 14        <- same 14 as before; a row filter did
--                                          not appear and none disappeared
--   n_fixture_true          = 9
--   n_fixture_false         = 5
--   season_0_announce_utc   = 2026-11-08 20:00:00+00
--   anon_can_select         = true      <- the grants survived REPLACE
--   authenticated_can_select= true
--   service_role_can_select = false     <- unchanged, as in BLOCK 1
--   view_reloptions         = (none)
--   whitespace_ok           = 0         <- no CR/LF smuggled into a column name
--                                          on the way through chat
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public')            AS n_view_cols,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'is_fixture')                                   AS has_is_fixture,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'prelim_results_announcement_at')               AS has_announce,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'scoring_start_at')                             AS has_scoring_start,
  (SELECT count(*) FROM public.seasons_public)                                   AS n_rows_through_view,
  (SELECT count(*) FROM public.seasons_public WHERE is_fixture)                  AS n_fixture_true,
  (SELECT count(*) FROM public.seasons_public WHERE NOT is_fixture)              AS n_fixture_false,
  (SELECT prelim_results_announcement_at AT TIME ZONE 'UTC'
     FROM public.seasons_public WHERE id = 'season_0')                           AS season_0_announce_utc,
  has_table_privilege('anon',          'public.seasons_public', 'SELECT')        AS anon_can_select,
  has_table_privilege('authenticated', 'public.seasons_public', 'SELECT')        AS authenticated_can_select,
  has_table_privilege('service_role',  'public.seasons_public', 'SELECT')        AS service_role_can_select,
  (SELECT coalesce(array_to_string(reloptions, ', '), '(none)') FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                              AS view_reloptions,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public'
       AND column_name ~ '\s')                                                  AS whitespace_ok;
