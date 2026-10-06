// RPC error text -> HTTP status for the /api/contents/* endpoints.
//
// The RPCs `RAISE EXCEPTION '<code>[:detail]'` and supabase-js hands that text
// back as error.message. This table is the contract recorded in
// reports/jisu_hq_2026-10-05_eod.md SS7. An UNKNOWN message is a 500 whose
// body does not echo the message (it can carry constraint names or SQL text).
//
// 409 means "terminal: do not retry" to a source (design SS4-3). 503 means a
// platform_config value is missing/invalid -- the endpoint is closed, not the
// request wrong.

export type ContentHttpError = { status: number; code: string }

const EXACT: Record<string, number> = {
  // 400
  source_invalid: 400,
  payload_invalid: 400,
  request_invalid: 400,
  role_invalid: 400,
  bytes_invalid: 400,
  content_type_invalid: 400,
  version_invalid: 400,
  rights_up_denied: 400,
  rights_reason_required: 400,
  rights_reason_forbidden: 400,
  main_asset_required: 400,
  actor_required: 400,
  result_invalid: 400,
  reason_required: 400,
  title_empty: 400,
  nothing_to_update: 400,
  threshold_invalid: 400,
  url_invalid: 400,
  url_required: 400,
  // 422
  lead_too_short: 422,
  bytes_over_limit: 422,
  approval_not_newer: 422,
  // 409
  already_imported: 409,
  approval_id_reused: 409,
  concurrent_import: 409,
  rate_limited: 409,
  not_sending: 409,
  // 404
  not_found: 404,
}

// `code:detail` forms. The detail is kept in the code ("asset_invalid:main_9x16")
// because it names which part of the request is wrong; it never contains
// request content.
const PREFIX: Record<string, number> = {
  payload_invalid: 400,
  asset_invalid: 400,
  channels_invalid: 400,
  config_missing: 503,
  config_invalid: 503,
  invalid_transition: 409,
  precondition_failed: 409,
  presign_invalid: 409,
}

const SAFE_DETAIL = /^[A-Za-z0-9._:>-]{1,120}$/

export function mapContentRpcError(message: string | null | undefined): ContentHttpError {
  const msg = (message ?? '').trim()
  if (msg in EXACT) return { status: EXACT[msg], code: msg }
  const i = msg.indexOf(':')
  if (i > 0) {
    const head = msg.slice(0, i)
    if (head in PREFIX && SAFE_DETAIL.test(msg)) return { status: PREFIX[head], code: msg }
  }
  return { status: 500, code: 'internal_error' }
}
