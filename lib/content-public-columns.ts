// The column lists of the public query (design SS7-2), in ONE pure file so the
// server code (lib/content-public.ts, server-only) and the live read-only probe
// (scripts/probe-public-columns.mjs) look at the SAME strings. No imports: it
// has to load under plain `node` as well.
//
// Why this matters: a wrong column name makes the query fail, every failure
// answers 404, and a 404 from a broken query looks exactly like a 404 from a
// closed switch. The probe runs these strings against the live database.

// Selected so the post-check can re-verify what the SQL filtered. The
// RECHECK_ONLY columns are read for that check and are NOT part of the
// returned projection (toPublicContent does not copy them).
export const PUBLIC_CONTENT_COLUMNS =
  'id, kind, form, language, title, description, ai_generated, publish_at, status, rights_status, source_ref'
export const RECHECK_ONLY_COLUMNS: readonly string[] = ['status', 'rights_status', 'source_ref']

export const PUBLIC_ASSET_COLUMNS = 'content_id, role, media_type, file_format, url, duration_sec, width, height'

// Keys that must never be selected for, or appear in, the public asset query or
// the projected content (source_ref only ever as a RECHECK_ONLY column).
export const NEVER_PUBLIC_KEYS: readonly string[] = [
  'script',
  'text_content',
  'sha256',
  'source',
  'source_ref',
  'source_version',
  'caption',
  'rights_reason',
  'payload_hash',
  'upstream_approved_by',
  'upstream_approved_at',
  'upstream_approval_id',
  'held_reason',
  'returned_reason',
  'returned_by',
  'returned_at',
  'notified_at',
  'bytes',
]
