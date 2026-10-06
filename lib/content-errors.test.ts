import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapContentRpcError } from './content-errors'

test('exact codes map per the EOD SS7 table', () => {
  const table: Record<string, number> = {
    source_invalid: 400, request_invalid: 400, rights_up_denied: 400, main_asset_required: 400, version_invalid: 400,
    lead_too_short: 422, bytes_over_limit: 422, approval_not_newer: 422,
    already_imported: 409, approval_id_reused: 409, concurrent_import: 409, rate_limited: 409, not_sending: 409,
    not_found: 404,
  }
  for (const [m, s] of Object.entries(table)) assert.deepEqual(mapContentRpcError(m), { status: s, code: m }, m)
})

test('detail forms keep the detail in the code', () => {
  assert.deepEqual(mapContentRpcError('asset_invalid:main_9x16'), { status: 400, code: 'asset_invalid:main_9x16' })
  assert.deepEqual(mapContentRpcError('channels_invalid:duplicate_platform'), { status: 400, code: 'channels_invalid:duplicate_platform' })
  assert.deepEqual(mapContentRpcError('payload_invalid:ai_generated'), { status: 400, code: 'payload_invalid:ai_generated' })
  assert.deepEqual(mapContentRpcError('config_missing:content_min_lead_minutes'), { status: 503, code: 'config_missing:content_min_lead_minutes' })
  assert.deepEqual(mapContentRpcError('config_invalid:news_publish_timezone'), { status: 503, code: 'config_invalid:news_publish_timezone' })
  assert.deepEqual(mapContentRpcError('invalid_transition:held->held'), { status: 409, code: 'invalid_transition:held->held' })
  assert.deepEqual(mapContentRpcError('presign_invalid:thumbnail'), { status: 409, code: 'presign_invalid:thumbnail' })
})

test('unknown / DB-internal text is a 500 that does NOT echo the message', () => {
  for (const m of [
    'check_violation:contents_scheduled_requires_cleared',
    'conflict:some_constraint',
    'permission denied for table contents',
    'syntax error at or near "x"',
    '',
    null,
    undefined,
  ]) {
    assert.deepEqual(mapContentRpcError(m as string), { status: 500, code: 'internal_error' }, String(m))
  }
})

test('a known prefix with an unsafe detail is still a 500 (no request text leaks into a code)', () => {
  assert.deepEqual(mapContentRpcError('asset_invalid:<script>alert(1)</script>'), { status: 500, code: 'internal_error' })
  assert.deepEqual(mapContentRpcError('config_missing:' + 'x'.repeat(200)), { status: 500, code: 'internal_error' })
})

test('unknown prefix with a colon is a 500', () => {
  assert.deepEqual(mapContentRpcError('weird:thing'), { status: 500, code: 'internal_error' })
})
