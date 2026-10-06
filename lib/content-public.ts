// The ONLY door to publicly visible `contents` (design SS7-2). SERVER ONLY.
//
// Public = status 'scheduled' AND rights_status 'cleared' AND publish_at <= now
//          AND the content's DBA publication switch is on.
// Nothing is stored as "live": it is computed at read time, so there is no
// cron that flips a state and nothing to forget (design SS2-1).
//
// How this differs from the competition path, on purpose:
//  - the filter runs in SQL with named columns; there is no load-everything-
//    then-filter-in-JS step (the pattern SS7-2 forbids copying);
//  - the switches are the two DBA keys (news_/entertainment_publication_enabled),
//    NOT competition_publication_enabled and NOT isWatchPublic(): competition
//    may be closed while news is open and vice versa;
//  - lib/watch-*, isRowPublic() and competition-publication.ts are not touched.
//
// FAIL-CLOSED: a missing switch row, a read error, any value other than
// 'true', or a thrown exception = that DBA is closed. A closed or unknown DBA
// contributes no kinds to the query, so its rows cannot be returned at all.
//
// What leaves this file is a PROJECTION: no source, source_ref, upstream_*,
// payload_hash, rights_reason, held/returned fields, caption (SNS text), and
// only assets whose role is in PUBLIC_ASSET_ROLES with a non-empty url
// (never script text or sha256).
import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  CONTENT_KINDS,
  DBAS,
  PUBLIC_ASSET_ROLES,
  isPublicAssetRole,
  openKinds,
  publicationSwitchKey,
  type ContentKind,
  type Dba,
} from '@/lib/content-kinds'
import { contentPathKey, contentUrl, parseContentPaths, type ContentPaths } from '@/lib/content-paths'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const PUBLIC_LIST_MAX = 50

// Selected so the post-check below can re-verify what the SQL filtered; the
// status/rights/publish_at columns are NOT part of the returned projection.
export const PUBLIC_CONTENT_COLUMNS =
  'id, kind, form, language, title, description, ai_generated, publish_at, status, rights_status'
export const PUBLIC_ASSET_COLUMNS = 'content_id, role, media_type, file_format, url, duration_sec, width, height'

type Admin = ReturnType<typeof createSupabaseAdmin>

export type PublicContent = {
  id: string
  kind: ContentKind
  form: string
  language: string
  title: string
  description: string | null
  ai_generated: boolean
  publish_at: string
}

export type PublicAsset = {
  role: string
  media_type: string
  file_format: string | null
  url: string
  duration_sec: number | null
  width: number | null
  height: number | null
}

// Pure: same shape as decideCompetitionPublication so every non-'true' input
// can be tested without a database. `row` = maybeSingle() result.
export function decidePublicationSwitch(row: { value: unknown } | null | undefined, error: unknown): boolean {
  if (error || !row) return false
  return String(row.value).trim().toLowerCase() === 'true'
}

// Pure re-check of one returned row. The SQL already filtered; this exists so a
// broken filter (a refactor that drops an .eq) shows up as a dropped row plus a
// log line instead of a published one.
export function isPublicRow(
  row: { kind: unknown; status: unknown; rights_status: unknown; publish_at: unknown },
  open: readonly ContentKind[],
  now: Date,
): boolean {
  if (row.status !== 'scheduled' || row.rights_status !== 'cleared') return false
  if (typeof row.kind !== 'string' || !(open as readonly string[]).includes(row.kind)) return false
  if (typeof row.publish_at !== 'string') return false
  const t = Date.parse(row.publish_at)
  return Number.isFinite(t) && t <= now.getTime()
}

export function toPublicAssets(rows: readonly Record<string, unknown>[]): PublicAsset[] {
  const out: PublicAsset[] = []
  for (const r of rows) {
    if (typeof r.role !== 'string' || !isPublicAssetRole(r.role)) continue
    if (typeof r.url !== 'string' || r.url.trim() === '') continue
    out.push({
      role: r.role,
      media_type: String(r.media_type),
      file_format: (r.file_format as string | null) ?? null,
      url: r.url,
      duration_sec: r.duration_sec === null || r.duration_sec === undefined ? null : Number(r.duration_sec),
      width: (r.width as number | null) ?? null,
      height: (r.height as number | null) ?? null,
    })
  }
  return out
}

function toPublicContent(r: Record<string, unknown>): PublicContent {
  return {
    id: String(r.id),
    kind: r.kind as ContentKind,
    form: String(r.form),
    language: String(r.language),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    ai_generated: r.ai_generated === true,
    publish_at: String(r.publish_at),
  }
}

// DBAs whose publication switch is currently 'true'. Any failure -> none.
export async function getOpenPublicationDbas(admin?: Admin): Promise<Dba[]> {
  try {
    const db = admin ?? createSupabaseAdmin()
    const keys = DBAS.map(publicationSwitchKey)
    const { data, error } = await db.from('platform_config').select('key, value').in('key', keys)
    if (error || !data) return []
    const byKey = new Map((data as { key: string; value: unknown }[]).map((r) => [r.key, r]))
    return DBAS.filter((dba) => decidePublicationSwitch(byKey.get(publicationSwitchKey(dba)) ?? null, null))
  } catch {
    return []
  }
}

export async function getContentPaths(admin?: Admin): Promise<ContentPaths> {
  try {
    const db = admin ?? createSupabaseAdmin()
    const { data, error } = await db
      .from('platform_config')
      .select('key, value')
      .in('key', CONTENT_KINDS.map(contentPathKey))
    if (error || !data) return {}
    return parseContentPaths(data as { key: string; value: unknown }[])
  } catch {
    return {}
  }
}

export type PublicContentResult = { content: PublicContent; assets: PublicAsset[] }

// One item by id. null = "not public for any reason" -- the caller answers 404
// and must not say why (a held / hidden / rights-blocked item must not be
// distinguishable from one that never existed).
export async function getPublicContent(
  id: string,
  opts: { admin?: Admin; now?: Date } = {},
): Promise<PublicContentResult | null> {
  if (!UUID_RE.test(id)) return null
  try {
    const admin = opts.admin ?? createSupabaseAdmin()
    const now = opts.now ?? new Date()
    const open = openKinds(await getOpenPublicationDbas(admin))
    if (open.length === 0) return null

    const { data, error } = await admin
      .from('contents')
      .select(PUBLIC_CONTENT_COLUMNS)
      .eq('id', id)
      .eq('status', 'scheduled')
      .eq('rights_status', 'cleared')
      .lte('publish_at', now.toISOString())
      .in('kind', open)
      .maybeSingle()
    if (error || !data) return null
    const row = data as Record<string, unknown>
    if (!isPublicRow(row as never, open, now)) {
      console.error('[content-public] row returned by the filter failed the re-check, dropped:', id)
      return null
    }

    const { data: assets, error: aErr } = await admin
      .from('content_assets')
      .select(PUBLIC_ASSET_COLUMNS)
      .eq('content_id', id)
      .in('role', [...PUBLIC_ASSET_ROLES])
      .not('url', 'is', null)
    if (aErr) return null
    return { content: toPublicContent(row), assets: toPublicAssets((assets ?? []) as Record<string, unknown>[]) }
  } catch {
    return null
  }
}

// Newest first. `kind` must itself be open; asking for a closed kind is empty.
export async function listPublicContents(
  opts: { kind?: ContentKind; limit?: number; admin?: Admin; now?: Date } = {},
): Promise<PublicContent[]> {
  try {
    const admin = opts.admin ?? createSupabaseAdmin()
    const now = opts.now ?? new Date()
    const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 20), 1), PUBLIC_LIST_MAX)
    let open = openKinds(await getOpenPublicationDbas(admin))
    if (opts.kind) open = open.filter((k) => k === opts.kind)
    if (open.length === 0) return []

    const { data, error } = await admin
      .from('contents')
      .select(PUBLIC_CONTENT_COLUMNS)
      .eq('status', 'scheduled')
      .eq('rights_status', 'cleared')
      .lte('publish_at', now.toISOString())
      .in('kind', open)
      .order('publish_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    const rows = (data as Record<string, unknown>[]).filter((r) => {
      const ok = isPublicRow(r as never, open, now)
      if (!ok) console.error('[content-public] list row failed the re-check, dropped:', r.id)
      return ok
    })
    return rows.map(toPublicContent)
  } catch {
    return []
  }
}

// /c/<id> -> the current address, or null. null covers: not public, no slug
// configured for the kind, slug invalid/duplicated. The caller must answer 404
// for every null and 308 only for a string -- otherwise this endpoint would
// reveal that a held, hidden or rights-blocked item exists.
export async function resolvePublicAddress(id: string, opts: { admin?: Admin; now?: Date } = {}): Promise<string | null> {
  const admin = opts.admin ?? createSupabaseAdmin()
  const found = await getPublicContent(id, { admin, now: opts.now })
  if (!found) return null
  const paths = await getContentPaths(admin)
  return contentUrl(found.content.kind, found.content.id, paths)
}
