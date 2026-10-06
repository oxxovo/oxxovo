// POST /api/contents/import -- a source hands us finished content (design SS3).
//
// Order matters:
//  1. auth (bearer secret -> source)
//  2. shape validation (pure, lib/content-import)
//  3. same-version resend short-circuit: an existing (source, ref, version) is
//     answered from the row WITHOUT touching R2 or the schedule, so a retry
//     after a timeout is cheap and cannot fail on something that no longer
//     matters. content_import repeats this check atomically under a lock.
//  4. publish_at (news: fixed schedule; entertainment: not_before)
//  5. R2 verification of every uploaded object (exists, size, sha256)
//  6. content_import RPC -- one transaction, final authority
//
// The route never sets status or rights: the RPC decides scheduled vs held.
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { authenticate, jsonError, jsonOk, readJsonBody, readRawConfig, rpcErrorResponse } from '@/lib/content-route'
import { buildImportRpcPayload, validateImportRequest } from '@/lib/content-import'
import { dbaOfKind } from '@/lib/content-kinds'
import { computeNewsSlot, parseNewsSchedule } from '@/lib/content-schedule'
import { r2Config, r2Storage } from '@/lib/content-r2'
import { verifyUploadedAssets } from '@/lib/content-verify'

export const dynamic = 'force-dynamic'
// Streaming sha256 over up to content_max_bytes (500MB default) per asset.
export const maxDuration = 300

const ROUTE = 'contents/import'

export async function POST(request: NextRequest) {
  const auth = authenticate(request)
  if ('response' in auth) return auth.response
  const { source } = auth

  const parsed = await readJsonBody(request)
  if ('response' in parsed) return parsed.response

  const v = validateImportRequest(source, parsed.body)
  if (!v.ok) return jsonError(v.status, v.code)
  const req = v.req

  const admin = createSupabaseAdmin()

  // 3. same-version resend
  const { data: existing, error: exErr } = await admin
    .from('contents')
    .select('id, status, rights_status, held_reason, payload_hash')
    .eq('source', source)
    .eq('source_ref', req.source_ref)
    .eq('source_version', req.source_version)
    .maybeSingle()
  if (exErr) {
    console.error(`[${ROUTE}] existing-row lookup failed:`, exErr.message)
    return jsonError(500, 'internal_error')
  }
  if (existing) {
    const same = existing.payload_hash === req.payload_hash
    const body = {
      id: existing.id,
      status: existing.status,
      rights_status: existing.rights_status,
      held_reason: existing.held_reason,
      idempotent: same,
    }
    // 409 = terminal for the source; it needs a new version number.
    return same ? jsonOk(200, body) : jsonOk(409, { error: 'payload_conflict', ...body })
  }

  // 4. publish_at
  let publishAt: Date
  let late = false
  if (dbaOfKind(req.kind) === 'news') {
    const cfg = await readRawConfig(admin, [
      'content_min_lead_minutes',
      'news_publish_weekdays',
      'news_publish_time',
      'news_publish_timezone',
    ])
    if (!cfg) return jsonError(503, 'config_unreadable')
    const leadRaw = cfg.get('content_min_lead_minutes')
    if (leadRaw === undefined) return jsonError(503, 'config_missing:content_min_lead_minutes')
    if (!/^[1-9][0-9]{0,8}$/.test(leadRaw)) return jsonError(503, 'config_invalid:content_min_lead_minutes')
    const sched = parseNewsSchedule({
      weekdays: cfg.get('news_publish_weekdays') ?? null,
      time: cfg.get('news_publish_time') ?? null,
      timezone: cfg.get('news_publish_timezone') ?? null,
    })
    if (!sched.ok) return jsonError(503, sched.error)
    const slot = computeNewsSlot(new Date(), Number(leadRaw), sched.cadence)
    if (!slot) return jsonError(503, 'config_invalid:news_publish_weekdays')
    publishAt = slot.publishAt
    late = slot.lateForSlot
  } else {
    // validateImportRequest guarantees not_before for non-news. The lead
    // floor is the RPC's call (lead_too_short -> 422), not silently adjusted.
    publishAt = req.not_before as Date
  }

  // 5. R2
  const r2 = r2Config()
  if (!r2) return jsonError(503, 'r2_not_configured')
  try {
    const ver = await verifyUploadedAssets(req.assets, r2Storage(r2))
    if (!ver.ok) return jsonError(ver.status, ver.code)
  } catch (e) {
    console.error(`[${ROUTE}] r2 verification failed:`, e instanceof Error ? e.message : e)
    return jsonError(502, 'storage_unavailable')
  }

  // 6. RPC
  const payload = buildImportRpcPayload(req, publishAt, late, r2.publicBase)
  const { data, error } = await admin.rpc('content_import', { p_source: source, p_payload: payload })
  if (error) return rpcErrorResponse(ROUTE, source, error.message)

  const out = data as { outcome: string } & Record<string, unknown>
  if (out.outcome === 'created') return jsonOk(201, { ...out, idempotent: false })
  if (out.outcome === 'idempotent') return jsonOk(200, out)
  if (out.outcome === 'conflict') return jsonOk(409, { error: 'payload_conflict', ...out })
  console.error(`[${ROUTE}] unexpected rpc outcome:`, out.outcome)
  return jsonError(500, 'internal_error')
}
