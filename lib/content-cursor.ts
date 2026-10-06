// Opaque cursor for GET /api/contents/returns (design SS6-2): a (returned_at,
// id) pair. Time alone would skip rows sharing a timestamp.
//
// `returned_at` is kept as the exact string PostgREST returned (microsecond
// precision). Round-tripping it through a JS Date would truncate to
// milliseconds and re-serve or skip rows.

export type ReturnsCursor = { t: string; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// ISO-8601 with optional fraction and an explicit offset; what PostgREST emits.
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

export function encodeCursor(c: ReturnsCursor): string {
  return Buffer.from(JSON.stringify({ t: c.t, id: c.id }), 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): ReturnsCursor | null {
  if (raw.length === 0 || raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null
  try {
    const o = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
    if (typeof o !== 'object' || o === null) return null
    const { t, id } = o as Record<string, unknown>
    if (typeof t !== 'string' || typeof id !== 'string') return null
    if (!TS_RE.test(t) || !UUID_RE.test(id)) return null
    return { t, id }
  } catch {
    return null
  }
}
