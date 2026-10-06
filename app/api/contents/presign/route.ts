// POST /api/contents/presign -- one-time upload URL for a source (design SS3-2).
//
// The RPC records the issue (key, source/ref/version/role, bytes, expiry) and
// enforces rate limits, size cap, role list and "already imported -> 409".
// This route only turns the recorded key into a signed PUT URL, so the URL
// can never be for anything the RPC did not approve.
//
// R2 config is checked FIRST: a 503 here must not burn the source's hourly
// presign allowance on a request that could never be signed.
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authenticate, jsonError, jsonOk, onlyKeys, readJsonBody, rpcErrorResponse } from '@/lib/content-route'
import { r2Config, signPutUrl } from '@/lib/content-r2'

export const dynamic = 'force-dynamic'

const ROUTE = 'contents/presign'
const FIELDS = ['source_ref', 'source_version', 'role', 'bytes', 'content_type'] as const

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
  if (typeof body.role !== 'string') return jsonError(400, 'role_invalid')
  if (typeof body.bytes !== 'number' || !Number.isSafeInteger(body.bytes)) return jsonError(400, 'bytes_invalid')
  if (typeof body.content_type !== 'string') return jsonError(400, 'content_type_invalid')

  const r2 = r2Config()
  if (!r2) return jsonError(503, 'r2_not_configured')

  const admin = createSupabaseAdmin()
  const { data, error } = await admin.rpc('content_presign', {
    p_source: source,
    p_source_ref: body.source_ref,
    p_source_version: body.source_version,
    p_role: body.role,
    p_bytes: body.bytes,
    p_content_type: body.content_type,
  })
  if (error) return rpcErrorResponse(ROUTE, source, error.message)

  const issued = data as { key: string; expires_at: string }
  // Sign for exactly the remaining life of the record; never longer.
  const seconds = Math.floor((Date.parse(issued.expires_at) - Date.now()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 1) return jsonError(500, 'internal_error')

  try {
    const uploadUrl = await signPutUrl(r2, {
      key: issued.key,
      contentType: body.content_type,
      bytes: body.bytes,
      expiresInSeconds: Math.min(seconds, 7 * 24 * 3600),
    })
    return jsonOk(200, {
      key: issued.key,
      upload_url: uploadUrl,
      expires_at: issued.expires_at,
      // The PUT must send exactly these; both are part of the signature.
      required_headers: { 'Content-Type': body.content_type, 'Content-Length': String(body.bytes) },
    })
  } catch (e) {
    console.error(`[${ROUTE}] signing failed:`, e instanceof Error ? e.message : e)
    return jsonError(500, 'internal_error')
  }
}
