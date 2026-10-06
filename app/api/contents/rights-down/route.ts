// POST /api/contents/rights-down -- a source lowers the rights of its own
// content (design SS4-3). Downward only (cleared -> restricted -> blocked);
// raising is a new version. The RPC does the whole change in one transaction:
// rights, status -> held, queued distributions -> cancelled.
//
// 200 for both "lowered" and "idempotent" (same value twice changes nothing).
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authenticate, jsonError, jsonOk, onlyKeys, readJsonBody, rpcErrorResponse } from '@/lib/content-route'

export const dynamic = 'force-dynamic'

const ROUTE = 'contents/rights-down'
const FIELDS = ['source_ref', 'source_version', 'rights_status', 'rights_reason'] as const

export async function POST(request: NextRequest) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { source } = auth

  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response
  const b = parsed.body
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return jsonError(400, 'request_invalid')
  const body = b as Record<string, unknown>

  const unknown = onlyKeys(body, FIELDS)
  if (unknown) return jsonError(400, unknown)
  if (typeof body.source_ref !== 'string') return jsonError(400, 'source_ref_invalid')
  if (typeof body.source_version !== 'number' || !Number.isInteger(body.source_version)) return jsonError(400, 'source_version_invalid')
  if (typeof body.rights_status !== 'string') return jsonError(400, 'rights_status_invalid')
  if (typeof body.rights_reason !== 'string') return jsonError(400, 'rights_reason_required')

  // Everything else (ref format, direction, reason length, ownership) is the
  // RPC's call; it only ever touches rows of `source`.
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.rpc('content_rights_down', {
    p_source: source,
    p_source_ref: body.source_ref,
    p_source_version: body.source_version,
    p_rights_status: body.rights_status,
    p_rights_reason: body.rights_reason,
  })
  if (error) return rpcErrorResponse(ROUTE, source, error.message)
  return jsonOk(200, data)
}
