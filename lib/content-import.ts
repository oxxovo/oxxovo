// Request validation + RPC payload construction for POST /api/contents/import.
//
// Pure (no env, no DB, no R2): the route supplies the clock, the R2 public
// base and the schedule. Everything here answers "is this request well-formed
// and allowed for this source" -- the RPC stays the authority on anything that
// needs the database (lead time, size caps, version continuity, presign
// consumption, uniqueness).
//
// Unknown fields are rejected, never ignored, and nothing is silently
// remapped (design SS3-3).
import {
  dbaOfKind,
  formAllowed,
  hasMainVideoRole,
  isAssetRole,
  isContentKind,
  isPlatform,
  languageAllowed,
  pickAssetRole,
  sourceMaySend,
  type AssetRole,
  type ContentKind,
  type ContentSource,
  type Platform,
} from '@/lib/content-kinds'
import { canonicalizeImportPayload, computePayloadHash, HashInputError } from '@/lib/content-hash'

export type ImportFail = { ok: false; status: 400; code: string }

const REF_RE = /^[A-Za-z0-9._-]{1,128}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256_RE = /^[0-9a-f]{64}$/
const RIGHTS = ['cleared', 'restricted', 'blocked'] as const
export const RIGHTS_REASON_MAX = 2000
export const TEXT_ASSET_MAX_BYTES = 64 * 1024

export type ParsedAsset = {
  role: AssetRole
  media_type: 'video' | 'image' | 'text'
  key: string | null
  file_format: string | null
  bytes: number | null
  duration_sec: number | null
  width: number | null
  height: number | null
  sha256: string | null
  text_content: string | null
}

export type ParsedImport = {
  source: ContentSource
  source_ref: string
  source_version: number
  kind: ContentKind
  form: string
  language: string
  rights_status: (typeof RIGHTS)[number]
  rights_reason: string | null
  title: string
  description: string | null
  caption: string | null
  upstream_approved_by: string
  upstream_approved_at: Date
  upstream_approval_id: string
  allowed_platforms: Platform[]
  not_before: Date | null
  ai_generated: boolean
  assets: ParsedAsset[]
  payload_hash: string
}

const fail = (code: string): ImportFail => ({ ok: false, status: 400, code })

export function mediaTypeOfRole(role: AssetRole): ParsedAsset['media_type'] {
  if (role === 'thumbnail') return 'image'
  if (role === 'script') return 'text'
  return 'video'
}

export function assetKeyPrefix(source: string, sourceRef: string, version: number, role: string): string {
  return `imports/${source}/${sourceRef}/v${version}/${role}-`
}

function optStr(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null
  return typeof v === 'string' ? v : undefined // undefined = wrong type
}

function posInt(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return null
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined
}

function parseAsset(
  raw: Record<string, unknown>,
  source: ContentSource,
  sourceRef: string,
  version: number,
): ParsedAsset | ImportFail {
  const role = raw.role
  if (!isAssetRole(role)) return fail('asset_role_invalid')
  const media_type = mediaTypeOfRole(role)
  const tag = `asset_invalid:${role}`

  const file_format = optStr(raw.file_format)
  const key = optStr(raw.key)
  const sha256 = optStr(raw.sha256)
  const text = optStr(raw.text_content)
  const bytes = posInt(raw.bytes)
  const width = posInt(raw.width)
  const height = posInt(raw.height)
  if (file_format === undefined || key === undefined || sha256 === undefined || text === undefined) return fail(tag)
  if (bytes === undefined || width === undefined || height === undefined) return fail(tag)
  let duration: number | null = null
  if (raw.duration_sec !== undefined && raw.duration_sec !== null) {
    if (typeof raw.duration_sec !== 'number' || !Number.isFinite(raw.duration_sec) || raw.duration_sec <= 0) return fail(tag)
    duration = raw.duration_sec
  }

  if (media_type === 'text') {
    // script: text only. A key/sha256/bytes here would be ignored by the RPC
    // and look like a file that is not there -- reject instead.
    if (!text || key || sha256 || bytes || width || height || duration) return fail(tag)
    if (Buffer.byteLength(text, 'utf8') > TEXT_ASSET_MAX_BYTES) return fail(`${tag}:too_long`)
    return { role, media_type, key: null, file_format: file_format ?? null, bytes: null, duration_sec: null, width: null, height: null, sha256: null, text_content: text }
  }

  if (text) return fail(tag)
  if (!key || !sha256 || !bytes) return fail(tag)
  if (!SHA256_RE.test(sha256)) return fail(`${tag}:sha256`)
  // The key must be one this source/ref/version was issued (design SS3-2);
  // otherwise source A could reference source B's object. The RPC re-checks
  // against content_presigns; this rejects early and cheaply.
  const prefix = assetKeyPrefix(source, sourceRef, version, role)
  if (!key.startsWith(prefix) || key.length <= prefix.length || key.length > 512 || /[^A-Za-z0-9._\-/]/.test(key) || key.includes('..')) {
    return fail(`${tag}:key`)
  }
  if (role === 'main_16x9' || role === 'main_9x16') {
    if ((width === null) !== (height === null)) return fail(`${tag}:size`)
    if (width !== null && height !== null) {
      // Aspect is validated, never stored (SS2-2). 2% tolerance on the
      // cross-product so 1080x1920 and 1088x1920 both read as 9:16.
      const [a, b] = role === 'main_16x9' ? [16, 9] : [9, 16]
      if (Math.abs(width * b - height * a) / (height * a) > 0.02) return fail(`${tag}:aspect`)
    }
  }
  return { role, media_type, key, file_format: file_format ?? null, bytes, duration_sec: duration, width, height, sha256, text_content: null }
}

export function validateImportRequest(source: ContentSource, body: unknown): { ok: true; req: ParsedImport } | ImportFail {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('request_invalid')
  const b = body as Record<string, unknown>
  if (b.spec_version !== 1) return fail('spec_version_invalid')

  // Throws on unknown top-level/asset fields, wrong types and duplicates; the
  // same function computes the hash so the two can never disagree about what
  // the request contains.
  let payload_hash: string
  try {
    canonicalizeImportPayload(b)
    payload_hash = computePayloadHash(b)
  } catch (e) {
    if (e instanceof HashInputError) return fail(e.message)
    throw e
  }

  const source_ref = b.source_ref
  if (typeof source_ref !== 'string' || !REF_RE.test(source_ref)) return fail('source_ref_invalid')
  const source_version = b.source_version
  if (typeof source_version !== 'number' || !Number.isInteger(source_version) || source_version < 1 || source_version > 1_000_000) {
    return fail('source_version_invalid')
  }

  if (!isContentKind(b.kind)) return fail('kind_invalid')
  const kind = b.kind
  if (!sourceMaySend(source, kind)) return fail('kind_not_allowed_for_source')
  if (typeof b.form !== 'string' || !formAllowed(kind, b.form)) return fail('form_invalid')
  if (typeof b.language !== 'string' || !languageAllowed(b.language)) return fail('language_invalid')

  if (typeof b.rights_status !== 'string' || !(RIGHTS as readonly string[]).includes(b.rights_status)) return fail('rights_status_invalid')
  const rights_status = b.rights_status as ParsedImport['rights_status']
  const rr = optStr(b.rights_reason)
  if (rr === undefined) return fail('rights_reason_invalid')
  if (rights_status === 'cleared' && rr !== null) return fail('rights_reason_forbidden')
  if (rights_status !== 'cleared' && (rr === null || rr.trim() === '' || rr.length > RIGHTS_REASON_MAX)) return fail('rights_reason_required')

  const title = b.title
  if (typeof title !== 'string' || title.trim() === '') return fail('title_invalid')
  const description = optStr(b.description)
  const caption = optStr(b.caption)
  if (description === undefined || caption === undefined) return fail('text_invalid')

  const by = b.upstream_approved_by
  if (typeof by !== 'string' || by.trim() === '') return fail('upstream_approved_by_invalid')
  if (typeof b.upstream_approved_at !== 'string' || !Number.isFinite(Date.parse(b.upstream_approved_at))) return fail('upstream_approved_at_invalid')
  const approvedAt = new Date(Date.parse(b.upstream_approved_at))
  // Lowercase UUID only (HQ 2026-10-05): a case-insensitive match would let the
  // same id re-enter through UNIQUE(source, upstream_approval_id) in a new case,
  // and the stored value would differ from what the source sent.
  if (typeof b.upstream_approval_id !== 'string' || !UUID_RE.test(b.upstream_approval_id)) return fail('upstream_approval_id_invalid')

  if (typeof b.ai_generated !== 'boolean') return fail('ai_generated_invalid')

  // The KEY and an array are required; an explicit [] is valid (a master kept
  // for the site only, HQ/Jenny2 2026-10-05). Omitting the key or sending null
  // is a 400, so "forgot to send" stays distinguishable from "intentionally none".
  const platforms = b.allowed_platforms
  if (!Array.isArray(platforms)) return fail('allowed_platforms_required')
  if (!platforms.every(isPlatform)) return fail('allowed_platforms_invalid')

  let not_before: Date | null = null
  const dba = dbaOfKind(kind)
  if (dba === 'news') {
    if (b.not_before !== undefined && b.not_before !== null) return fail('not_before_forbidden_for_news')
  } else {
    if (typeof b.not_before !== 'string' || !Number.isFinite(Date.parse(b.not_before))) return fail('not_before_required')
    not_before = new Date(Date.parse(b.not_before))
  }

  if (!Array.isArray(b.assets) || b.assets.length === 0) return fail('assets_required')
  const assets: ParsedAsset[] = []
  for (const raw of b.assets) {
    const a = parseAsset(raw as Record<string, unknown>, source, source_ref, source_version)
    if ('ok' in a) return a
    assets.push(a)
  }
  if (!hasMainVideoRole(assets.map((a) => a.role))) return fail('main_asset_required')

  return {
    ok: true,
    req: {
      source, source_ref, source_version, kind, form: b.form, language: b.language,
      rights_status, rights_reason: rr, title, description, caption,
      upstream_approved_by: by, upstream_approved_at: approvedAt, upstream_approval_id: b.upstream_approval_id,
      allowed_platforms: platforms as Platform[], not_before, ai_generated: b.ai_generated, assets, payload_hash,
    },
  }
}

// The jsonb handed to content_import. The route has by now verified each
// uploaded object in R2 (exists, size, sha256) and passes the public base the
// asset urls are built from.
export function buildImportRpcPayload(
  req: ParsedImport,
  publishAt: Date,
  lateForSlot: boolean,
  publicBase: string,
): Record<string, unknown> {
  const base = publicBase.replace(/\/+$/, '')
  const roles = req.assets.map((a) => a.role)
  return {
    source_ref: req.source_ref,
    source_version: req.source_version,
    kind: req.kind,
    form: req.form,
    language: req.language,
    rights_status: req.rights_status,
    rights_reason: req.rights_reason,
    title: req.title,
    description: req.description,
    caption: req.caption,
    upstream_approved_by: req.upstream_approved_by,
    upstream_approved_at: req.upstream_approved_at.toISOString(),
    upstream_approval_id: req.upstream_approval_id,
    ai_generated: req.ai_generated,
    payload_hash: req.payload_hash,
    publish_at: publishAt.toISOString(),
    late_for_slot: lateForSlot,
    assets: req.assets.map((a) => ({
      role: a.role,
      media_type: a.media_type,
      key: a.key,
      url: a.key ? `${base}/${a.key}` : null,
      file_format: a.file_format,
      bytes: a.bytes,
      duration_sec: a.duration_sec,
      width: a.width,
      height: a.height,
      sha256: a.sha256,
      text_content: a.text_content,
    })),
    // The role is chosen HERE by pickAssetRole() -- the same function dispatch
    // uses -- and null means "no usable asset": the RPC then records
    // skipped_no_asset instead of silently picking another aspect ratio.
    channels: req.allowed_platforms.map((platform) => ({ platform, role: pickAssetRole(platform, roles) })),
  }
}

