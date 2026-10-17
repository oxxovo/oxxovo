// Search-engine indexing switch for the public Watch pages -- SERVER ONLY (HQ 2026-10-14, A-8).
//
// Method: a `noindex` robots META on /watch, /watch/[id] and /watch/rankings (app/watch/layout.tsx).
// robots.ts stays `Allow: /` on purpose: a crawler blocked by Disallow never reads the noindex
// and an already-linked URL can still be listed.
//
// FAIL-CLOSED: only platform_config `search_index_allowed` = 'true' lifts the noindex. A missing
// row, a query error, a thrown exception or any other value keeps it. Lifting is a deliberate
// act (SQL / /admin/settings), never a side effect of a deleted row, and needs no redeploy.
import 'server-only'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// Pure, so the direction of every non-'true' input is testable without a database.
// `row` is the maybeSingle() result (null = no row).
export function decideSearchIndexAllowed(row: { value: unknown } | null | undefined, error: unknown): boolean {
  if (error || !row) return false
  return String(row.value).trim().toLowerCase() === 'true'
}

export async function isSearchIndexAllowed(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin.from('platform_config').select('value').eq('key', 'search_index_allowed').maybeSingle()
    return decideSearchIndexAllowed(data, error)
  } catch {
    return false
  }
}

// allowed -> no robots tag at all (the site default applies); otherwise noindex, nofollow.
export function searchIndexMetadata(allowed: boolean): Metadata {
  return allowed ? {} : { robots: { index: false, follow: false } }
}
