-- REST-exposed function backing scripts/check-service-role-grants.mjs, wired
-- into `npm run deploy:prod` as a hard pre-flight. Root cause it targets: the
-- axis between the working tables (7 privileges) and the broken ones (only
-- REFERENCES/TRIGGER/TRUNCATE) is whether the creating migration explicitly
-- wrote GRANT ... TO service_role -- not table age, not ownership. This
-- function makes that check automatic instead of a habit a migration author
-- has to remember (a habit that has already failed twice: chat_logs/
-- email_inbound_log in 2026-06, faq_items in this session).
--
-- SECURITY DEFINER so it can see grants for every table regardless of the
-- caller's own privileges -- information_schema.role_table_grants otherwise
-- only shows what the querying role can see.

-- STEP 1: function
CREATE OR REPLACE FUNCTION public.check_service_role_grants()
RETURNS TABLE(table_name text, missing_privileges text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.table_name, x.missing
  FROM (
    SELECT t.table_name::text AS table_name,
           ARRAY(
             SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS p
             EXCEPT
             SELECT g.privilege_type FROM information_schema.role_table_grants g
             WHERE g.table_schema = 'public' AND g.table_name = t.table_name AND g.grantee = 'service_role'
           ) AS missing
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ) x
  WHERE cardinality(x.missing) > 0
$$;

GRANT EXECUTE ON FUNCTION public.check_service_role_grants() TO service_role;

-- STEP 2: verify -- run it right now, should currently list ONLY the 5 known
-- offenders (applications, chat_logs, email_inbound_log,
-- season_recommendations, backup_genesis_user_id_20260606) if the earlier
-- three GRANT ALL statements have already been Run; fewer if they have.
SELECT * FROM public.check_service_role_grants() ORDER BY table_name;
