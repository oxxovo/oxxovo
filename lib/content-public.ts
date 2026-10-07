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
  dbaOfKind,
  PUBLIC_ASSET_ROLES,
  isPublicAssetRole,
  openKinds,
  publicationSwitchKey,
  type ContentKind,
  type Dba,
} from '@/lib/content-kinds'
import { isProbeRef } from '@/lib/content-admin'
import {
  contentPathKey,
  contentUrl,
  isValidSlug,
  kindForSlug,
  parseContentPaths,
  type ContentPaths,
} from '@/lib/content-paths'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const PUBLIC_LIST_MAX = 50

// The column lists live in a pure file (shared with the live read-only probe).
export { PUBLIC_CONTENT_COLUMNS, PUBLIC_ASSET_COLUMNS } from '@/lib/content-public-columns'
import { PUBLIC_CONTENT_COLUMNS, PUBLIC_ASSET_COLUMNS } from '@/lib/content-public-columns'

type Admin = ReturnType<typeof createSupabaseAdmin>

// Every failure below answers "not public" (404), so a broken query looks exactly
// like a closed switch. This line is the only way to tell them apart: the error
// CODE (e.g. 42703 = unknown column) and the item id, never message text or
// content. `where` is a fixed label.
function logQueryError(where: string, error: unknown, id?: string): void {
  const code = (error as { code?: unknown } | null)?.code
  console.error(`[content-public] query error where=${where} code=${typeof code === 'string' ? code : 'unknown'}${id ? ` id=${id}` : ''}`)
}
function logException(where: string, e: unknown, id?: string): void {
  console.error(`[content-public] exception where=${where} name=${e instanceof Error ? e.name : 'unknown'}${id ? ` id=${id}` : ''}`)
}

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
  row: { kind: unknown; status: unknown; rights_status: unknown; publish_at: unknown; source_ref: unknown },
  open: readonly ContentKind[],
  now: Date,
): boolean {
  if (row.status !== 'scheduled' || row.rights_status !== 'cleared') return false
  // Third layer for probe- rows (SQL filter x2 + this). A missing/non-string
  // source_ref fails closed: if the column ever stopped being selected, nothing
  // would be public instead of the test rows leaking.
  if (typeof row.source_ref !== 'string' || isProbeRef(row.source_ref)) return false
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
    if (error || !data) {
      if (error) logQueryError('switches', error)
      return []
    }
    const byKey = new Map((data as { key: string; value: unknown }[]).map((r) => [r.key, r]))
    return DBAS.filter((dba) => decidePublicationSwitch(byKey.get(publicationSwitchKey(dba)) ?? null, null))
  } catch (e) {
    logException('switches', e)
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
    if (error || !data) {
      if (error) logQueryError('paths', error)
      return {}
    }
    return parseContentPaths(data as { key: string; value: unknown }[])
  } catch (e) {
    logException('paths', e)
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
      // probe- rows are permanent test rows (one is cleared): never public.
      .not('source_ref', 'ilike', 'probe-%')
      .maybeSingle()
    if (error) logQueryError('content', error, id)
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
    if (aErr) {
      logQueryError('assets', aErr, id)
      return null
    }
    return { content: toPublicContent(row), assets: toPublicAssets((assets ?? []) as Record<string, unknown>[]) }
  } catch (e) {
    logException('content', e, id)
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
      .not('source_ref', 'ilike', 'probe-%')
      .order('publish_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (error) logQueryError('list', error)
    if (error || !data) return []
    const rows = (data as Record<string, unknown>[]).filter((r) => {
      const ok = isPublicRow(r as never, open, now)
      if (!ok) console.error('[content-public] list row failed the re-check, dropped:', r.id)
      return ok
    })
    return rows.map(toPublicContent)
  } catch (e) {
    logException('list', e)
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

// ---- section routing (app/[section]) -------------------------------------------
// The first path segment is a configured slug, never a hard-coded word. Order of
// checks keeps the cheap ones first: a segment that cannot be a slug (dots,
// capitals, reserved words, too long) answers null WITHOUT touching the database;
// only a slug-shaped segment costs one platform_config read. No cache on purpose
// (HQ 2026-10-07): changing or removing a slug must take effect at once.
// null always means 404, for every reason, with no way to tell them apart.

export async function resolveSectionKind(slug: string, opts: { admin?: Admin } = {}): Promise<ContentKind | null> {
  if (!isValidSlug(slug)) return null
  const paths = await getContentPaths(opts.admin ?? createSupabaseAdmin())
  return kindForSlug(slug, paths)
}

// One item under its section. The item must belong to the section's kind:
// /<news-slug>/<film-id> is 404, not a page under the wrong heading.
export async function getPublicContentBySection(
  slug: string,
  id: string,
  opts: { admin?: Admin; now?: Date } = {},
): Promise<{ kind: ContentKind; item: PublicContentResult } | null> {
  const admin = opts.admin ?? createSupabaseAdmin()
  const kind = await resolveSectionKind(slug, { admin })
  if (!kind) return null
  const item = await getPublicContent(id, { admin, now: opts.now })
  if (!item || item.content.kind !== kind) return null
  return { kind, item }
}

// The section's list. null = the surface does not exist (no slug, or its DBA's
// publication switch is closed) -> 404. [] = it exists and is empty.
export async function listPublicContentsBySection(
  slug: string,
  opts: { admin?: Admin; now?: Date; limit?: number } = {},
): Promise<{ kind: ContentKind; items: PublicContent[] } | null> {
  const admin = opts.admin ?? createSupabaseAdmin()
  const kind = await resolveSectionKind(slug, { admin })
  if (!kind) return null
  const open = await getOpenPublicationDbas(admin)
  if (!open.includes(dbaOfKind(kind))) return null
  const items = await listPublicContents({ kind, limit: opts.limit, admin, now: opts.now })
  return { kind, items }
}
