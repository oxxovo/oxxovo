// payload_hash for POST /api/contents/import (design SS4-3, SS6-5b).
//
// "Same content" = same hash. A same-version resend with the same hash is an
// idempotent 200; a different hash is a 409. So this function IS the
// idempotency contract -- if two logically identical requests canonicalize
// differently, a harmless retry becomes a 409 ("terminal, do not retry")
// while the row is already stored.
//
// Pure: no env, no DB, no server-only. Unit-tested in content-hash.test.ts.
//
// Canonical form (decided 2026-10-05, not in the design doc before this):
//  - only the source-supplied fields below are hashed. Server-decided fields
//    (source, status, publish_at) and Node-derived ones (late_for_slot,
//    channels, media url) are NOT part of the request and never hashed.
//  - an unknown top-level or asset field THROWS (the endpoint rejects unknown
//    fields with 400 anyway; silently dropping one here would hide a content
//    difference from the hash).
//  - null and absent are the same ("not sent"); '' is different from absent.
//  - strings: Unicode NFC, otherwise byte-exact. NO trim/case-fold -- a title
//    that differs by a space is different content. (NFC because an NFD Hangul
//    string from a macOS source is the same text.)
//  - timestamps: parsed and re-emitted as UTC ISO with milliseconds, so
//    "+09:00" and "Z" spellings of one instant hash the same.
//  - allowed_platforms: order-insensitive (sorted); duplicates throw.
//  - assets: sorted by role; duplicate role throws.
//  - numbers: finite only; -0 -> 0. Object keys sorted at every level.
//  - upstream_approval_id and rights_reason ARE hashed (HQ 2026-10-05): the
//    approval id is part of what a version rests on, and excluding it would
//    let an id-only resend pass as idempotent.
import { createHash } from 'node:crypto'

export class HashInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HashInputError'
  }
}

const TOP_STRING_FIELDS = [
  'source_ref',
  'kind',
  'form',
  'language',
  'rights_status',
  'rights_reason',
  'title',
  'description',
  'caption',
  'upstream_approved_by',
  'upstream_approval_id',
] as const
const TOP_TIME_FIELDS = ['upstream_approved_at', 'not_before'] as const
const TOP_NUMBER_FIELDS = ['spec_version', 'source_version'] as const
const TOP_BOOL_FIELDS = ['ai_generated'] as const
const TOP_OTHER_FIELDS = ['allowed_platforms', 'assets'] as const

const ASSET_STRING_FIELDS = ['role', 'key', 'file_format', 'sha256', 'text_content'] as const
const ASSET_NUMBER_FIELDS = ['bytes', 'duration_sec', 'width', 'height'] as const

const TOP_KNOWN = new Set<string>([
  ...TOP_STRING_FIELDS,
  ...TOP_TIME_FIELDS,
  ...TOP_NUMBER_FIELDS,
  ...TOP_BOOL_FIELDS,
  ...TOP_OTHER_FIELDS,
])
const ASSET_KNOWN = new Set<string>([...ASSET_STRING_FIELDS, ...ASSET_NUMBER_FIELDS])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(field: string, v: unknown): string {
  if (typeof v !== 'string') throw new HashInputError(`${field}_not_string`)
  return v.normalize('NFC')
}

function num(field: string, v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new HashInputError(`${field}_not_number`)
  return Object.is(v, -0) ? 0 : v
}

function time(field: string, v: unknown): string {
  if (typeof v !== 'string') throw new HashInputError(`${field}_not_string`)
  const ms = Date.parse(v)
  if (!Number.isFinite(ms)) throw new HashInputError(`${field}_not_timestamp`)
  return new Date(ms).toISOString()
}

function present(v: unknown): boolean {
  return v !== undefined && v !== null
}

function canonicalAsset(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) throw new HashInputError('asset_not_object')
  for (const k of Object.keys(raw)) {
    if (!ASSET_KNOWN.has(k)) throw new HashInputError(`asset_unknown_field:${k}`)
  }
  const out: Record<string, unknown> = {}
  for (const f of ASSET_STRING_FIELDS) if (present(raw[f])) out[f] = str(`asset.${f}`, raw[f])
  for (const f of ASSET_NUMBER_FIELDS) if (present(raw[f])) out[f] = num(`asset.${f}`, raw[f])
  if (typeof out.role !== 'string' || out.role === '') throw new HashInputError('asset_role_required')
  return out
}

export function canonicalizeImportPayload(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) throw new HashInputError('payload_not_object')
  for (const k of Object.keys(input)) {
    if (!TOP_KNOWN.has(k)) throw new HashInputError(`unknown_field:${k}`)
  }

  const out: Record<string, unknown> = {}
  for (const f of TOP_STRING_FIELDS) if (present(input[f])) out[f] = str(f, input[f])
  for (const f of TOP_TIME_FIELDS) if (present(input[f])) out[f] = time(f, input[f])
  for (const f of TOP_NUMBER_FIELDS) if (present(input[f])) out[f] = num(f, input[f])
  for (const f of TOP_BOOL_FIELDS) {
    if (!present(input[f])) continue
    if (typeof input[f] !== 'boolean') throw new HashInputError(`${f}_not_boolean`)
    out[f] = input[f]
  }

  if (present(input.allowed_platforms)) {
    if (!Array.isArray(input.allowed_platforms)) throw new HashInputError('allowed_platforms_not_array')
    const list = input.allowed_platforms.map((p) => str('allowed_platforms[]', p))
    if (new Set(list).size !== list.length) throw new HashInputError('allowed_platforms_duplicate')
    out.allowed_platforms = list.sort()
  }

  if (present(input.assets)) {
    if (!Array.isArray(input.assets)) throw new HashInputError('assets_not_array')
    const list = input.assets.map(canonicalAsset)
    const roles = list.map((a) => a.role as string)
    if (new Set(roles).size !== roles.length) throw new HashInputError('assets_duplicate_role')
    out.assets = list.sort((a, b) => ((a.role as string) < (b.role as string) ? -1 : 1))
  }
  return out
}

// JSON with sorted keys at every level, no whitespace. Inputs here are already
// reduced to strings / finite numbers / booleans / arrays / plain objects.
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

// Prefix versions the canonical form. If the rules above ever change, bump it
// -- old rows keep the old hash, so a resend of an old version would 409
// instead of matching. Do not change the rules without a plan for that.
const HASH_DOMAIN = 'oxxovo.content-import.v1\n'

export function computePayloadHash(input: unknown): string {
  const canonical = stableStringify(canonicalizeImportPayload(input))
  return createHash('sha256').update(HASH_DOMAIN + canonical, 'utf8').digest('hex')
}
