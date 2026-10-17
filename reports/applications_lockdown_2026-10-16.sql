-- ============================================================================
-- genesis_applications / applications lockdown -- BLOCK 1 APPLIED 2026-10-16 by TK on the main DB
-- ============================================================================
-- STATUS: BLOCK 1 applied 2026-10-16. Do not run it again; BLOCK R and BLOCK F1/FR below
--   were NOT applied (R re-opens the hole; F1 is an optional separate decision).
-- Verification as reported by HQ (relayed result, not the raw editor output):
--   policies: "anyone can apply" gone from genesis_applications; "allow public insert"
--     gone from applications (both confirmed)
--   privileges: applications anon and authenticated = MAINTAIN only;
--     genesis_applications anon = MAINTAIN, SELECT; authenticated = MAINTAIN, SELECT, UPDATE
--   pre-change row shape (BLOCK 0f): 117 rows, all fixtures: season_test 105 and
--     season_test2 12; zero rows in any real season -> no sign the open door was used
--     (this reads existing rows only; it cannot show attempts that failed or rows deleted
--     since; the API log search for POST /rest/v1/genesis_applications is still the
--     stronger evidence)
-- Still open: genesis_apps_admin_delete policy remains but authenticated DELETE is revoked,
--   so it is inert (repo check 2026-10-16: no user-session delete of genesis_applications
--   anywhere in app/ or lib/; scripts delete with service_role). anon keeps the SELECT
--   privilege; "no public read" (SELECT, anon, false) blocks it. Not yet done by hand:
--   admin UPDATE check in /admin/applications and a normal /apply registration.
-- ============================================================================
-- Problem (HQ live read): policy "anyone can apply" on genesis_applications is
--   INSERT for {anon, authenticated} with check = true, and anon/authenticated hold
--   table INSERT privilege. So anyone with the public anon key can insert a row with
--   ANY column values straight through PostgREST, skipping every check in
--   app/api/apply/route.ts and lib/studio.ts (login, membership, season open,
--   agreements, length limits, capacity). Same for legacy table applications:
--   policy "allow public insert" (INSERT, anon + authenticated, check = true), no
--   privilege today, so currently inert.
--
-- Why it matters (repo evidence):
--   * moderation_status is NOT NULL DEFAULT 'approved' (reports/watch_safety_2026-06.sql:36).
--     An insert that omits it is 'approved'. isRowPublic (lib/watch-visibility.ts)
--     needs only: status not 'flagged', watch_hidden falsy, watch_hold falsy,
--     moderation_status = 'approved'; the season gate needs a non-fixture season
--     (season ids are public through seasons_public). The list also needs
--     free_entry_url or main_round_video_url. All attacker-controlled.
--   * count_active_registrations() feeds defer_season_schedule: the season defers
--     only while the count is below min_participants (season_0 = 100). Fake rows can
--     push it to 'enough' and stop a defer.
--   * A non-null free_entry_url is the platform's "scorable" contract, and pending
--     rows are what the scoring worker picks up: fake rows can cost scoring spend.
--   * Today /watch is closed on production (competition_publication_enabled off), so
--     nothing is public yet; the count, scoring and email effects are live now.
--
-- What this does:
--   * drops "anyone can apply"; revokes INSERT/UPDATE/DELETE from anon and INSERT/DELETE
--     from authenticated on genesis_applications.
--   * KEEPS authenticated UPDATE and SELECT on purpose: app/admin/applications/actions.ts
--     updates genesis_applications with the signed-in admin's own session
--     (createSupabaseServer: admin_notes, status, award_rank), which needs the
--     privilege plus genesis_admin_all / genesis_apps_admin_update. Non-admins have no
--     UPDATE policy (owner policy is SELECT only), so they get 0 rows. That safety now
--     depends on is_admin() reading profiles.role, which is locked since
--     reports/profiles_lockdown_2026-10-16.sql.
--   * drops "allow public insert" on applications and revokes everything from
--     anon/authenticated there (legacy table, no reference in app/, lib/, scripts/ or
--     reports/*.sql; backlog c37 calls it legacy).
--
-- Repo evidence that nothing needs the removed paths: every genesis_applications INSERT
--   is service_role (app/api/apply/route.ts:160-163, lib/studio.ts:1381,1567,2471);
--   no code deletes genesis_applications with a user session; browser code has no
--   table calls. NOT checked: clients outside the repo (look for POST
--   /rest/v1/genesis_applications by anon or authenticated in the PostgREST/API logs
--   first; any hit means someone used the open door).
--
-- How to run: SQL Editor shows only the LAST statement, so every block is one statement
--   or one transaction. Paste one block at a time: 0a-0j, then 1, then 2a-2c.
--   Save 0a/0b/0c output; it feeds BLOCK R. After BLOCK 1 check by hand: TK signs in as
--   admin, opens /admin/applications, changes an entry's admin note (admin UPDATE must
--   still work), and a normal registration via /apply still succeeds (server insert).
-- BLOCK R and BLOCK FR re-open holes: never paste them in the same run as BLOCK 1/F1.
-- ASCII only.
-- ============================================================================


-- BLOCK 0a  (full text of all genesis_applications policies, untruncated)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'genesis_applications' order by policyname;


-- BLOCK 0b
select r.rolname, a.privilege_type from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.genesis_applications'::regclass and r.rolname in ('anon','authenticated','service_role') order by r.rolname, a.privilege_type;


-- BLOCK 0c  (legacy applications: policies)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'applications' order by policyname;


-- BLOCK 0d  (legacy applications: privileges and row count)
select (select count(*) from public.applications) as row_count, (select string_agg(r.rolname || ':' || a.privilege_type, ', ' order by r.rolname, a.privilege_type) from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.applications'::regclass and r.rolname in ('anon','authenticated','service_role')) as privileges;


-- BLOCK 0e  (defaults that decide what an attacker-built row looks like)
select column_name, column_default, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'genesis_applications' and column_name in ('status','moderation_status','watch_hidden','watch_hold','staff_pick','award_rank','free_entry_url','main_round_video_url','user_id','season_id') order by column_name;


-- BLOCK 0f  (read only: existing rows by shape in real seasons; a pile of rows with no user_id AND a video is the thing to look at)
select s.season_number, g.status, g.moderation_status, (g.user_id is null) as no_user, (coalesce(g.free_entry_url, '') <> '') as has_video, count(*) as n from public.genesis_applications g join public.seasons s on s.id = g.season_id where not coalesce(s.is_fixture, false) group by s.season_number, g.status, g.moderation_status, (g.user_id is null), (coalesce(g.free_entry_url, '') <> '') order by s.season_number, g.status, g.moderation_status, no_user, has_video;


-- BLOCK 0g  (function body: check_service_role_grants)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proconfig, pg_get_functiondef(p.oid) as def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'check_service_role_grants';


-- BLOCK 0h  (function body: rls_auto_enable)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_function_result(p.oid) as returns, p.proconfig, pg_get_functiondef(p.oid) as def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'rls_auto_enable';


-- BLOCK 0i  (function body: link_user_applications -- compare with reports/deploy_train_2026-06-10.sql:82)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proconfig, pg_get_functiondef(p.oid) as def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'link_user_applications';


-- BLOCK 0j  (function body: is_staff)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proconfig, pg_get_functiondef(p.oid) as def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'is_staff';


-- BLOCK 1
begin;
drop policy if exists "anyone can apply" on public.genesis_applications;
revoke insert, update, delete on public.genesis_applications from anon;
revoke insert, delete on public.genesis_applications from authenticated;
drop policy if exists "allow public insert" on public.applications;
revoke all on public.applications from anon, authenticated;
notify pgrst, 'reload schema';
commit;


-- BLOCK 2a  (expect: no "anyone can apply"; admin, owner-select, staff-select, no public read remain)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename in ('genesis_applications','applications') order by tablename, policyname;


-- BLOCK 2b  (expect: anon no INSERT/UPDATE/DELETE; authenticated SELECT and UPDATE only, no INSERT/DELETE)
select r.rolname, a.privilege_type from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.genesis_applications'::regclass and r.rolname in ('anon','authenticated','service_role') order by r.rolname, a.privilege_type;


-- BLOCK 2c  (expect: zero rows -- applications keeps no anon/authenticated privilege)
select r.rolname, a.privilege_type from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.applications'::regclass and r.rolname in ('anon','authenticated');


-- BLOCK R  (rollback: restores the live state HQ read before this change; re-opens the hole)
begin;
grant insert on public.genesis_applications to anon;
grant insert, delete on public.genesis_applications to authenticated;
create policy "anyone can apply" on public.genesis_applications for insert to anon, authenticated with check (true);
create policy "allow public insert" on public.applications for insert to anon, authenticated with check (true);
notify pgrst, 'reload schema';
commit;


-- BLOCK F1  (OPTIONAL, separate decision: check_service_role_grants is callable by anon/authenticated because the repo file granted EXECUTE to service_role but never revoked the default PUBLIC execute. It only lists table names missing service_role grants. Run 0g first. scripts/check-service-role-grants.mjs and the deploy gate use service_role and are unaffected.)
begin;
revoke execute on function public.check_service_role_grants() from public, anon, authenticated;
grant execute on function public.check_service_role_grants() to service_role;
commit;


-- BLOCK FR  (rollback for F1)
grant execute on function public.check_service_role_grants() to public, anon, authenticated;
