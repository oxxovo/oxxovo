-- =========================================================================
-- HQ item (1), STEP 1 of 2 -- READ ONLY. Project qrnkovokjmimagrwjebs.
-- 2026-08-09, jisu (main).
--
-- Writes nothing. No ALTER, no CREATE, no UPDATE. One query, one block.
-- Run it in the Supabase SQL Editor and paste the whole result row back.
--
-- WHY THIS EXISTS AND WHY IT IS NOT THE FIX ITSELF
--   public.seasons_public is a fixed column list, not SELECT *. Measured
--   2026-08-09 via the live PostgREST schema: the VIEW carries 66 columns, the
--   BASE TABLE now carries 86, and the two columns added on 2026-08-08 --
--   is_fixture and prelim_results_announcement_at -- are among the 20 the view
--   does NOT carry. So the columns exist and nothing public can read them.
--
--   The view definition is not in this repository (it is one of the DB objects
--   with no CREATE anywhere in either repo). Rewriting it from a guess would
--   silently drop whatever row filter it may have, and this view is the only
--   thing anon is allowed to read -- anon has no SELECT on public.seasons at
--   all (measured: 42501 with the GRANT hint). A dropped WHERE clause here is
--   not a broken page, it is an exposure. So the definition is read first and
--   the rewrite is written from the actual text.
--
-- WHAT STEP 2 WILL BE
--   CREATE OR REPLACE VIEW -- never DROP + CREATE. Two reasons, both measured:
--     * ACLs. service_role gets 42501 on this view and anon gets 200/14 rows,
--       so the grants are NOT the default set. DROP discards them; CREATE OR
--       REPLACE keeps them.
--     * CREATE OR REPLACE may only APPEND columns and may not reorder or
--       retype the existing ones, which is exactly the guarantee wanted here:
--       it cannot quietly change what the 66 existing columns mean.
--   The two new columns go at the END, in this order:
--     is_fixture, prelim_results_announcement_at
--
-- WHY THE TWO md5 COLUMNS ARE IN HERE
--   The definition has to travel through chat twice (out as text, back inside
--   the rewrite). A long SQL string making that trip is exactly where this
--   project has been bitten before -- CRLF gets folded into the middle of a
--   literal and the statement runs anyway, wrong. So STEP 2 will open with a
--   guard that recomputes md5 over the live definition and ABORTS unless it
--   equals viewdef_md5 below. If the paste got mangled, we find out from the
--   hash instead of from the home page.
--   viewdef_md5_ws is the same hash over whitespace-collapsed text, so a
--   newline-only mangling can be told apart from a real content difference.
--
-- EXPECTED, so a surprise is visible without reading the text closely:
--   n_view_cols               = 66
--   view_owner                = postgres
--   view_reloptions           = (none)      <- if it says security_invoker=true,
--                                              STEP 2 must re-declare it: CREATE
--                                              OR REPLACE resets view options.
--   view_grants               = anon and authenticated with SELECT, and NOT
--                               service_role (that is why service_role 42501s)
--   other_relations_referenced = 0          <- the view reads public.seasons and
--                                              nothing else. If it is not 0 the
--                                              view has a join and STEP 2 has to
--                                              account for it.
-- =========================================================================
SELECT
  md5(pg_get_viewdef('public.seasons_public'::regclass, true))                  AS viewdef_md5,
  md5(regexp_replace(pg_get_viewdef('public.seasons_public'::regclass, true),
                     '\s+', ' ', 'g'))                                         AS viewdef_md5_ws,
  length(pg_get_viewdef('public.seasons_public'::regclass, true))               AS viewdef_len,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public')           AS n_view_cols,
  (SELECT pg_get_userbyid(relowner) FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                             AS view_owner,
  (SELECT coalesce(array_to_string(reloptions, ', '), '(none)') FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                             AS view_reloptions,
  (SELECT coalesce(string_agg(grantee || '=' || privilege_type, ', '
                              ORDER BY grantee, privilege_type), '(none)')
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'seasons_public')           AS view_grants,
  (SELECT count(DISTINCT d.refobjid)
     FROM pg_depend d
     WHERE d.classid = 'pg_rewrite'::regclass
       AND d.objid IN (SELECT oid FROM pg_rewrite
                         WHERE ev_class = 'public.seasons_public'::regclass)
       AND d.refclassid = 'pg_class'::regclass
       AND d.refobjid NOT IN ('public.seasons'::regclass,
                              'public.seasons_public'::regclass))               AS other_relations_referenced,
  pg_get_viewdef('public.seasons_public'::regclass, true)                       AS viewdef;
