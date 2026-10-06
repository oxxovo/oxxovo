// Registry for the Publishing Control Center (design SS7-1, SS6-5b).
//
// The ONE place that knows: which kinds exist, which DBA a kind belongs to,
// which source may send which kind, which asset roles a platform prefers, and
// the allow-lists the DB deliberately does not CHECK (form, language).
//
// Pure: no env, no DB. Imported by import (Node validation), dispatch (cron),
// public judgement and admin. The SQL only ever sees an expanded kind list
// (`dist_claim(open_kinds, ...)`), never a DBA name -- so a new kind is a
// change here and nowhere in SQL.

export const CONTENT_KINDS = ['news', 'drama', 'film', 'cf', 'music', 'music_video'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export const CONTENT_SOURCES = ['news_desk', 'production_os'] as const
export type ContentSource = (typeof CONTENT_SOURCES)[number]

export const DBAS = ['news', 'entertainment'] as const
export type Dba = (typeof DBAS)[number]

export const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'x'] as const
export type Platform = (typeof PLATFORMS)[number]

export const ASSET_ROLES = ['main_16x9', 'main_9x16', 'thumbnail', 'script'] as const
export type AssetRole = (typeof ASSET_ROLES)[number]

// kind -> DBA. The pipeline boundary is the DBA boundary (SS5-2).
const KIND_DBA: Record<ContentKind, Dba> = {
  news: 'news',
  drama: 'entertainment',
  film: 'entertainment',
  cf: 'entertainment',
  music: 'entertainment',
  music_video: 'entertainment',
}

// The secret decides `source`; the server then enforces what that source may
// send. A source sending a kind it does not own is a 400, not a remap.
const SOURCE_KINDS: Record<ContentSource, readonly ContentKind[]> = {
  news_desk: ['news'],
  production_os: ['drama', 'film', 'cf', 'music', 'music_video'],
}

// Switch keys live in platform_config; only their NAMES are here.
export const MASTER_DISPATCH_KEY = 'social_dispatch_enabled'
export function dispatchSwitchKey(dba: Dba): string {
  return `${dba}_dispatch_enabled`
}
export function publicationSwitchKey(dba: Dba): string {
  return `${dba}_publication_enabled`
}

export function isContentKind(v: unknown): v is ContentKind {
  return typeof v === 'string' && (CONTENT_KINDS as readonly string[]).includes(v)
}
export function isContentSource(v: unknown): v is ContentSource {
  return typeof v === 'string' && (CONTENT_SOURCES as readonly string[]).includes(v)
}
export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v)
}
export function isAssetRole(v: unknown): v is AssetRole {
  return typeof v === 'string' && (ASSET_ROLES as readonly string[]).includes(v)
}

export function dbaOfKind(kind: ContentKind): Dba {
  return KIND_DBA[kind]
}

export function kindsOfDba(dba: Dba): ContentKind[] {
  return CONTENT_KINDS.filter((k) => KIND_DBA[k] === dba)
}

// What dist_claim's `open_kinds` argument is: the open DBAs expanded to kinds.
export function openKinds(openDbas: readonly Dba[]): ContentKind[] {
  const set = new Set(openDbas)
  return CONTENT_KINDS.filter((k) => set.has(KIND_DBA[k]))
}

export function sourceMaySend(source: ContentSource, kind: ContentKind): boolean {
  return SOURCE_KINDS[source].includes(kind)
}

// ---- allow-lists the DB does not CHECK (SS3-3): a new value is one line here.
export const FORMS = ['short', 'long', 'full', 'trailer'] as const
export type ContentForm = (typeof FORMS)[number]

// news accepts short only for now; long is a 400, not a silent remap.
const KIND_FORMS: Record<ContentKind, readonly ContentForm[]> = {
  news: ['short'],
  drama: FORMS,
  film: FORMS,
  cf: FORMS,
  music: FORMS,
  music_video: FORMS,
}
export function formAllowed(kind: ContentKind, form: string): form is ContentForm {
  return (KIND_FORMS[kind] as readonly string[]).includes(form)
}

export const LANGUAGES = ['ko', 'en', 'ja', 'ko-KR', 'en-US', 'ja-JP'] as const
export function languageAllowed(lang: string): boolean {
  return (LANGUAGES as readonly string[]).includes(lang)
}

// ---- channel -> asset role --------------------------------------------------
// Used by BOTH import (decides skipped_no_asset) and dispatch (picks the file
// again, because the distribution row has no role column). One function, so
// the two can never disagree (EOD 2026-10-05 SS7). A preferred role that is
// missing is NOT silently replaced by the other aspect ratio -- except x,
// where HQ allowed main_9x16 as a fallback for main_16x9.
const PREFERRED_ROLES: Record<Platform, readonly AssetRole[]> = {
  youtube: ['main_16x9'],
  instagram: ['main_9x16'],
  tiktok: ['main_9x16'],
  x: ['main_16x9', 'main_9x16'],
}

export function pickAssetRole(platform: Platform, availableRoles: Iterable<string>): AssetRole | null {
  const have = new Set(availableRoles)
  for (const role of PREFERRED_ROLES[platform]) {
    if (have.has(role)) return role
  }
  return null
}

// Video kinds need at least one main_* role (either one; both not required).
export function hasMainVideoRole(roles: Iterable<string>): boolean {
  const have = new Set(roles)
  return have.has('main_16x9') || have.has('main_9x16')
}

// Roles that may leave the building on a public page (SS7-2). An ALLOW-list:
// script and any role not named here (audio_master and whatever is added to
// ASSET_ROLES later) stay private until someone decides otherwise. The public
// query filters on this same constant, so the predicate and the SQL cannot drift.
export const PUBLIC_ASSET_ROLES = ['main_16x9', 'main_9x16', 'thumbnail'] as const

export function isPublicAssetRole(role: string): boolean {
  return (PUBLIC_ASSET_ROLES as readonly string[]).includes(role)
}
