'use server'

import { getUserOrNull, type SiteUser } from '@/lib/user-auth'

// Server action exposing the current cookie-session user to client components
// (which cannot read the httpOnly session cookie directly). Returns null when
// signed out. See [[feedback-auth-pattern]].
export async function getSessionUser(): Promise<SiteUser | null> {
  return getUserOrNull()
}
