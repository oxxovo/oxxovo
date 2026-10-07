import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { CONTENT_KINDS, MASTER_DISPATCH_KEY, dispatchSwitchKey, dbaOfKind, isContentKind } from '@/lib/content-kinds'
import {
  REQUIRED_DISPATCH_KEYS,
  RETRY_DISPATCH_KEYS,
  isOversize,
  isSwitchOpen,
  kindsForFilter,
  matchesStatusFilter,
  missingKeys,
  parseDbaFilter,
  parseKindFilter,
  parsePositiveInt,
  parseStatusFilter,
  type DispatchSwitches,
} from '@/lib/content-admin'
import { ContentsView, type ContentRow } from './ContentsView'

// Switches and rows change without a redeploy; never bake this page.
export const dynamic = 'force-dynamic'

const LIMIT = 200

const COLUMNS =
  'id, kind, source, source_ref, source_version, title, description, caption, language, form, rights_status, rights_reason, status, held_reason, publish_at, returned_reason, created_at, ' +
  'content_distributions(id, platform, status, attempts, next_attempt_at, last_error, external_url, published_at), ' +
  'content_assets(role, url, bytes, width, height)'

type RawDist = {
  id: string; platform: string; status: string; attempts: number; next_attempt_at: string | null
  last_error: string | null; external_url: string | null; published_at: string | null
}
type RawAsset = { role: string; url: string | null; bytes: number | string | null; width: number | null; height: number | null }
type RawContent = {
  id: string; kind: string; source: string; source_ref: string; source_version: number; title: string
  description: string | null; caption: string | null; language: string; form: string; rights_status: string
  rights_reason: string | null; status: string; held_reason: string | null; publish_at: string
  returned_reason: string | null; created_at: string
  content_distributions: RawDist[] | null; content_assets: RawAsset[] | null
}

export default async function AdminContentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dba?: string; kind?: string; status?: string; probe?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const dba = parseDbaFilter(sp.dba)
  const kind = parseKindFilter(sp.kind)
  const status = parseStatusFilter(sp.status)
  const showProbe = sp.probe === '1'
  const admin = createSupabaseAdmin()

  // ---- dispatch config (banner + retry ceiling + size ceiling) --------------
  const keys = [
    ...REQUIRED_DISPATCH_KEYS,
    ...RETRY_DISPATCH_KEYS,
    MASTER_DISPATCH_KEY,
    dispatchSwitchKey('news'),
    dispatchSwitchKey('entertainment'),
  ]
  const { data: cfgRows, error: cfgErr } = await admin.from('platform_config').select('key, value').in('key', keys)
  const cfg = cfgErr || !cfgRows ? null : new Map((cfgRows as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  const missingRequired = missingKeys(cfg, REQUIRED_DISPATCH_KEYS)
  const missingRetry = missingKeys(cfg, RETRY_DISPATCH_KEYS)
  const maxAttempts = parsePositiveInt(cfg?.get('content_dispatch_max_attempts'))
  const maxBytes = parsePositiveInt(cfg?.get('content_dispatch_max_bytes_default'))
  const switches: DispatchSwitches | null = cfg
    ? {
        master: isSwitchOpen(cfg.get(MASTER_DISPATCH_KEY)),
        news: isSwitchOpen(cfg.get(dispatchSwitchKey('news'))),
        entertainment: isSwitchOpen(cfg.get(dispatchSwitchKey('entertainment'))),
      }
    : null

  // ---- rows: every restriction that matters is applied in SQL ---------------
  let loadError: string | null = null
  let rows: ContentRow[] = []
  let rawCount = 0
  const kinds = kindsForFilter(dba, kind)
  if (kinds === null || kinds.length > 0) {
    let q = admin.from('contents').select(COLUMNS).order('created_at', { ascending: false }).limit(LIMIT)
    // probe- rows are hidden by the QUERY (a UI-only filter is bypassed by a URL).
    if (!showProbe) q = q.not('source_ref', 'ilike', 'probe-%')
    if (kinds !== null) q = q.in('kind', kinds)
    if (status === 'scheduled' || status === 'returned' || status === 'hidden') q = q.eq('status', status)
    if (status === 'held') q = q.eq('status', 'held').eq('rights_status', 'cleared')
    if (status === 'rights') q = q.eq('status', 'held').neq('rights_status', 'cleared')
    if (status === 'action') q = q.in('status', ['scheduled', 'held'])
    const { data, error } = await q
    if (error) loadError = error.message
    const raw = (data ?? []) as unknown as RawContent[]
    rawCount = raw.length
    rows = raw
      .filter((c) => isContentKind(c.kind))
      .filter((c) => matchesStatusFilter(status, c, c.content_distributions ?? [], maxAttempts))
      .map((c) => {
        const assets = c.content_assets ?? []
        const mains = assets.filter((a) => a.role === 'main_16x9' || a.role === 'main_9x16')
        const main = mains.find((a) => a.role === 'main_16x9' && a.url) ?? mains.find((a) => a.url) ?? null
        const thumb = assets.find((a) => a.role === 'thumbnail')?.url ?? null
        return {
          id: c.id,
          kind: c.kind,
          dba: dbaOfKind(c.kind as (typeof CONTENT_KINDS)[number]),
          sourceRef: c.source_ref,
          version: c.source_version,
          title: c.title,
          description: c.description,
          caption: c.caption,
          rightsStatus: c.rights_status,
          rightsReason: c.rights_reason,
          status: c.status,
          heldReason: c.held_reason,
          publishAt: c.publish_at,
          returnedReason: c.returned_reason,
          videoUrl: main?.url ?? null,
          posterUrl: thumb,
          oversizeBytes: mains.map((a) => Number(a.bytes)).filter((b) => isOversize(b, maxBytes)).sort((a, b) => b - a)[0] ?? null,
          dists: (c.content_distributions ?? [])
            .map((d) => ({
              id: d.id, platform: d.platform, status: d.status, attempts: d.attempts,
              lastError: d.last_error, externalUrl: d.external_url, publishedAt: d.published_at,
            }))
            .sort((a, b) => a.platform.localeCompare(b.platform)),
        } satisfies ContentRow
      })
  }

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const cur = { dba, kind, status, probe: showProbe ? '1' : undefined, ...over }
    for (const [k, v] of Object.entries(cur)) if (v && v !== 'all') p.set(k, v)
    const s = p.toString()
    return `/admin/contents${s ? `?${s}` : ''}`
  }

  return (
    <ContentsView
      rows={rows}
      nowIso={new Date().toISOString()}
      filters={{ dba, kind, status, showProbe }}
      links={{
        dba: Object.fromEntries(['all', 'entertainment', 'news'].map((v) => [v, qs({ dba: v })])),
        status: Object.fromEntries(
          ['all', 'action', 'rights', 'scheduled', 'held', 'returned', 'hidden'].map((v) => [v, qs({ status: v })]),
        ),
        kind: Object.fromEntries(['all', ...CONTENT_KINDS].map((v) => [v, qs({ kind: v })])),
        probeToggle: qs({ probe: showProbe ? undefined : '1' }),
      }}
      banner={{
        configUnreadable: cfg === null,
        missingRequired,
        missingRetry,
        switches,
      }}
      loadError={loadError}
      limit={LIMIT}
      truncated={rawCount >= LIMIT}
    />
  )
}
