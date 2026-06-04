import { createSupabaseServer } from './supabase-server'

// General (public-site) user identity, derived from the @supabase/ssr cookie
// session — the same session model admin uses (see lib/admin-auth.ts), now
// unified for everyone ([[feedback-auth-pattern]]).
//
// Supabase Auth normalizes emails to lowercase; callers that match against
// genesis_applications.email (which stores whatever the applicant typed) should
// compare case-insensitively. Until user_id backfill (Phase 6), identity is
// still matched by this email; afterwards by user_id = auth.uid().
export type SiteUser = {
  id: string
  email: string
}

// Returns the signed-in site user, or null when there is no valid session.
// Server components / server actions / route handlers only (reads cookies).
export async function getUserOrNull(): Promise<SiteUser | null> {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null
  return { id: user.id, email: user.email.toLowerCase() }
}
