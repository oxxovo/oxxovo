// Fails if any public-schema base table is missing SELECT/INSERT/UPDATE/DELETE
// for service_role. This is the automated version of a check that used to be
// a habit ("did I add the GRANT line?") -- and a habit has already failed
// twice: chat_logs and email_inbound_log (2026-06 migrations) and faq_items
// (this session, 2026-08-16) all shipped with CREATE TABLE + RLS but no
// explicit `GRANT ... TO service_role`, and every one of them silently
// degraded a live feature (or would have, for faq_items) rather than erroring
// loudly -- Postgres GRANT is additive and explicit, "service_role bypasses
// RLS" does not imply "service_role has table privileges". A missing GRANT
// produces a runtime permission-denied error on the first real query, not a
// build error, so nothing before this caught it.
//
// Calls the public.check_service_role_grants() RPC (SECURITY DEFINER, so it
// can see grants regardless of the caller's own privileges) --
// information_schema is not exposed over PostgREST directly, so this cannot
// be a plain .from() query. See reports/service_role_grants_check_2026-08-16.sql
// for the function definition.
//
// Run: node --env-file=.env.local scripts/check-service-role-grants.mjs
// Wired into `npm run deploy:prod` (scripts/deploy-prod.mjs) as a hard
// pre-flight -- deliberately NOT in .github/workflows/checks.yml, which runs
// with placeholder Supabase credentials on purpose (no real DB access from
// CI). This has to run somewhere that holds the real service-role key, which
// today is a human's machine before a deploy, not a GitHub runner.

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exitCode = 1
} else {
  const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data, error } = await admin.rpc('check_service_role_grants')

  if (error) {
    // ★The function itself might not exist yet (not Run), or might have lost
    // its own EXECUTE grant -- either way this is "can't tell", and per the
    // fail-closed rule this whole check exists to enforce, "can't tell" must
    // not read as "clean". Refuse.
    console.error('check_service_role_grants RPC failed -- treating as a check failure, not a pass:')
    console.error(`  ${error.message}`)
    console.error('  (has reports/service_role_grants_check_2026-08-16.sql been Run?)')
    process.exitCode = 1
  } else {
    const rows = data ?? []
    if (rows.length === 0) {
      console.log('✓ every public base table has full service_role DML (SELECT/INSERT/UPDATE/DELETE)')
      process.exitCode = 0
    } else {
      console.error(`✖ ${rows.length} table(s) missing service_role privileges:\n`)
      for (const r of rows) {
        console.error(`  ${r.table_name}: missing ${r.missing_privileges.join(', ')}`)
      }
      console.error(
        '\nFix: GRANT ALL ON public.<table> TO service_role; (or GRANT the specific missing ones), then re-run this check.',
      )
      process.exitCode = 1
    }
  }
}

// ★process.exitCode, NOT process.exit() -- on this Windows/Node combo,
// process.exit() forces immediate handle teardown and races with the
// Supabase client's lingering fetch/keep-alive handle, crashing with
// `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` regardless of the
// exit code requested (reproduced: printed the ✓ success line, then crashed,
// and the crash's exit code -- not 0 -- was what deploy-prod.mjs's spawnSync
// saw, refusing a deploy the check had actually passed). exitCode lets the
// event loop drain naturally instead of forcing it.
