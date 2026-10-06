// GET /api/contents/returns[?since=<cursor>][&limit=<n>]
// Returned (sent-back) items of the caller's source, oldest first, paged by a
// (returned_at, id) cursor (design SS6-2). Polling, not a webhook (SS6-2).
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authenticate, jsonError, jsonOk } from '@/lib/content-route'
import { decodeCursor, encodeCursor } from '@/lib/content-cursor'

export const dynamic = 'force-dynamic'

const ROUTE = 'contents/returns'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { source } = auth

  const sp = request.nextUrl.searchParams
  let limit = DEFAULT_LIMIT
  const limRaw = sp.get('limit')
  if (limRaw !== null) {
    if (!/^[1-9][0-9]{0,3}$/.test(limRaw)) return jsonError(400, 'limit_invalid')
    limit = Math.min(Number(limRaw), MAX_LIMIT)
  }
  const sinceRaw = sp.get('since')
  const cursor = sinceRaw ? decodeCursor(sinceRaw) : null
  if (sinceRaw && !cursor) return jsonError(400, 'since_invalid')

  const admin = createSupabaseAdmin()
  let q = admin
    .from('contents')
    .select('id, source_ref, source_version, returned_reason, returned_at')
    .eq('source', source)
    .eq('status', 'returned')
    .not('returned_at', 'is', null)
    .order('returned_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)
  if (cursor) {
    // (returned_at, id) > (t, id): later time, or same time and larger id.
    // Both values were validated by decodeCursor, so quoting is safe.
    q = q.or(`returned_at.gt."${cursor.t}",and(returned_at.eq."${cursor.t}",id.gt.${cursor.id})`)
  }

  const { data, error } = await q
  if (error) {
    console.error(`[${ROUTE}] query failed:`, error.message)
    return jsonError(500, 'internal_error')
  }
  const items = data ?? []
  const last = items[items.length - 1]
  return jsonOk(200, {
    items,
    // Echo the same cursor when nothing is new, so the source can keep polling from it.
    next_cursor: last ? encodeCursor({ t: last.returned_at as string, id: last.id as string }) : sinceRaw ?? null,
  })
}
