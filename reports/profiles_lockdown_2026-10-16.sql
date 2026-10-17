-- ============================================================================
-- profiles lockdown (plan B) -- APPLIED 2026-10-16 by TK on the main DB
-- ============================================================================
-- STATUS: APPLIED 2026-10-16. BLOCK 1 was run by TK: drop policy
--   profiles_own_update + revoke update, insert, delete from authenticated +
--   schema reload. Do not run BLOCK 1 again; BLOCK R re-opens the hole.
-- Verification as reported by HQ (relayed result, not the raw editor output):
--   policies now = profiles_admin_all (ALL, public) and profiles_own_read
--     (SELECT, authenticated) only
--   privileges now = anon: MAINTAIN; authenticated: MAINTAIN, SELECT
--     (MAINTAIN = vacuum/analyze/cluster/refresh/lock; it is not a data write
--     path and PostgREST does not expose it)
-- Not yet done: the manual checks below (TK admin login, /profile save, and the
--   non-admin PATCH negative test with its positive control run BEFORE the
--   lockdown -- that control was not run, so a negative test now proves
--   nothing about the old state). Abuse scan: reports/profiles_abuse_check_2026-10-16.sql.
-- ============================================================================
-- Why: is_admin() = exists(select 1 from public.profiles where id = auth.uid()
--   and role = 'admin') (live body confirmed equal to the repo). profiles has
--   policy profiles_own_update (UPDATE, authenticated, id = auth.uid()), UPDATE
--   privilege for authenticated, and only the profiles_set_updated_at trigger.
--   So a signed-in user can PATCH their own row with the anon key + own JWT,
--   including role = 'admin'. Live today: role = 'admin' is 1 row (TK).
--
-- What this does: drops profiles_own_update and revokes UPDATE, INSERT, DELETE
--   on public.profiles from authenticated, in one transaction (BLOCK 1).
--   SELECT, profiles_own_read and profiles_admin_all are not touched.
--
-- Repo evidence: no browser code updates profiles (the only browser table call is
--   a storage bucket, app/admin/promo/PromoView.tsx:529). Every profiles write
--   in app/ and lib/ uses createSupabaseAdmin() (service_role). The only
--   user-session read is lib/admin-auth.ts requireAdmin(), which uses
--   profiles_own_read. Expected breakage: none in the repo. NOT checked: clients
--   outside the repo (game server, scripts with the anon key) -- look for
--   PATCH /profiles by the authenticated role in the PostgREST logs first.
--
-- How to run: Supabase SQL Editor shows only the LAST statement's result, so
--   every block below is exactly one statement or one transaction. Paste one
--   block at a time, in order: 0a, 0b, 0c, then 1, then 2a, 2b, 2c.
--   Save the 0a/0b output; it is the input for BLOCK R.
--   After BLOCK 1, check by hand: TK signs in -> /admin opens, /profile saves
--   the email language and nickname. With a NON-admin test account and its JWT,
--   PATCH /rest/v1/profiles?id=eq.<own id> {"display_name":"x"} must now return
--   42501 (run the same request before BLOCK 1 as the positive control; never
--   test with role).
--
-- BLOCK R (rollback) is at the bottom and re-opens the hole. Never paste it in
--   the same run as BLOCK 1. ASCII only.
-- ============================================================================


-- BLOCK 0a
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'profiles' order by policyname;


-- BLOCK 0b
select r.rolname, a.privilege_type from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.profiles'::regclass and r.rolname in ('anon','authenticated','service_role') order by r.rolname, a.privilege_type;


-- BLOCK 0c
select id, email, role from public.profiles where role = 'admin';


-- BLOCK 1
begin;
drop policy if exists profiles_own_update on public.profiles;
revoke update, insert, delete on public.profiles from authenticated;
notify pgrst, 'reload schema';
commit;


-- BLOCK 2a  (expect: profiles_admin_all and profiles_own_read only)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'profiles' order by policyname;


-- BLOCK 2b  (expect: authenticated has no UPDATE, INSERT, DELETE; compare with 0b)
select r.rolname, a.privilege_type from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a join pg_roles r on r.oid = a.grantee where c.oid = 'public.profiles'::regclass and r.rolname in ('anon','authenticated','service_role') order by r.rolname, a.privilege_type;


-- BLOCK 2c  (expect: zero rows)
select a.attname from pg_attribute a where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped and has_column_privilege('authenticated', 'public.profiles', a.attname, 'update');


-- BLOCK R  (rollback: restores the live state HQ read before the lockdown)
begin;
grant insert, update, delete on public.profiles to authenticated;
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
notify pgrst, 'reload schema';
commit;
