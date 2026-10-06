// GET /api/contents/status?source_ref=<ref>[&source_version=<n>]
// A source reads the state of ITS OWN rows (design SS3-1, SS6-2). Rows of
// another source are not distinguishable from rows that do not exist.
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authenticate, jsonError, jsonOk } from '@/lib/content-route'

export const dynamic = 'force-dynamic'

const ROUTE = 'contents/status'
const REF_RE = /^[A-Za-z0-9._-]{1,128}$/

export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { source } = auth

  const sp = request.nextUrl.searchParams
  const ref = sp.get('source_ref')
  if (!ref || !REF_RE.test(ref)) return jsonError(400, 'source_ref_invalid')
  const verRaw = sp.get('source_version')
  let version: number | null = null
  if (verRaw !== null) {
    if (!/^[1-9][0-9]{0,6}$/.test(verRaw)) return jsonError(400, 'source_version_invalid')
    version = Number(verRaw)
  }

  const admin = createSupabaseAdmin()
  let q = admin
    .from('contents')
    .select(
      'id, source_ref, source_version, kind, status, rights_status, rights_reason, held_reason, returned_reason, returned_at, publish_at, created_at, updated_at, content_distributions(platform, status, external_url, published_at)',
    )
    .eq('source', source) // ownership: always the caller's source, never a parameter
    .eq('source_ref', ref)
    .order('source_version', { ascending: true })
  if (version !== null) q = q.eq('source_version', version)

  const { data, error } = await q
  if (error) {
    console.error(`[${ROUTE}] query failed:`, error.message)
    return jsonError(500, 'internal_error')
  }
  if (!data || data.length === 0) return jsonError(404, 'not_found')
  return jsonOk(200, { items: data })
}
