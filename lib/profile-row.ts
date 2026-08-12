// Ensures an account has its public.profiles row. SERVER ONLY.
//
// The signup trigger (on_auth_user_created -> public.handle_new_user, definition
// in reports/auth_handle_new_user_2026-07-28.sql) normally creates the row inside
// the auth.users insert transaction. This is the app-side SECOND path, so a
// missing or broken trigger degrades to one extra write instead of a silent,
// total loss of profile state.
//
// 2026-07-28 incident: a migration from an unrelated project replaced
// public.handle_new_user, so no profiles row was created at signup -- and every
// app path that could have covered the gap upserted WITHOUT email, hit the
// profiles.email NOT NULL constraint, and threw the error away. Founding Creator
// claims returned no_profile and nickname saves silently did nothing, with no
// trace anywhere. Hence: email is a required argument, and failures are logged.
//
// SELF PATHS ONLY. `email` must come from the caller's own session. Never call
// this for another account's id. If the trigger is ever down again, a public read
// path creating rows would turn one broken signup into a write storm across all
// Watch audience traffic (TK, 2026-07-28) -- read paths log and fall back
// instead, and the historical gap is closed by a one-off backfill
// (reports/profiles_backfill_missing_rows_2026-07-28.sql).

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

// Creates the row if it is absent. Returns false (and logs) on failure -- never
// throws, so callers decide whether their path is fatal.
export async function ensureProfileRow(userId: string, email: string): Promise<boolean> {
  const addr = (email ?? '').trim().toLowerCase()
  if (!addr) {
    // profiles.email is NOT NULL: without an address there is nothing to insert.
    console.error('[profile-row] no email for account -- cannot ensure profiles row', { userId })
    return false
  }

  const admin = createSupabaseAdmin()
  // ignoreDuplicates => INSERT ... ON CONFLICT (id) DO NOTHING, so an existing
  // row's email (or any other column) is never overwritten by a session value.
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, email: addr }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    console.error('[profile-row] ensure failed', {
      userId,
      code: error.code,
      message: error.message,
    })
    return false
  }
  return true
}
