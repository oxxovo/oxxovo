// Pure helpers for /admin/contents (design SS8, SS6-4). No env, no DB, no React.
//
// The page, the server actions and the tests all import from here so the rules
// that matter -- "a probe- row never goes out", "what counts as needs-action",
// "what the [release] confirmation says" -- live in one place.
import {
  CONTENT_KINDS,
  dbaOfKind,
  isContentKind,
  kindsOfDba,
  DBAS,
  type ContentKind,
  type Dba,
  type Platform,
} from '@/lib/content-kinds'

// ---- probe rows (HQ 2026-10-06) --------------------------------------------
// Test rows are named `probe-...` by scripts/probe-contents.mjs. They are
// permanent (contents cannot be deleted) and one of them is `cleared`. Hiding
// them in the list is a convenience; the thing that matters is that nobody can
// push one into the dispatch queue, so the server actions call this too.
export const PROBE_PREFIX = 'probe-'
export const PROBE_BLOCK_MESSAGE = '시험 행입니다. 송출할 수 없습니다'

export function isProbeRef(sourceRef: unknown): boolean {
  return typeof sourceRef === 'string' && sourceRef.trim().toLowerCase().startsWith(PROBE_PREFIX)
}

// ---- filters ---------------------------------------------------------------
export const STATUS_FILTERS = ['all', 'action', 'rights', 'scheduled', 'held', 'returned', 'hidden'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]
export const DBA_FILTERS = ['all', ...DBAS] as const
export type DbaFilter = (typeof DBA_FILTERS)[number]

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: '전체',
  action: '⚠️ 조치 필요',
  rights: '⏸ 권리 대기',
  scheduled: '예약',
  held: '정지',
  returned: '반송',
  hidden: '숨김',
}
export const DBA_LABEL: Record<Dba, string> = { news: '데일리', entertainment: '엔터' }

export function parseStatusFilter(v: unknown): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(v as string) ? (v as StatusFilter) : 'all'
}
export function parseDbaFilter(v: unknown): DbaFilter {
  return (DBA_FILTERS as readonly string[]).includes(v as string) ? (v as DbaFilter) : 'all'
}
export function parseKindFilter(v: unknown): ContentKind | 'all' {
  return isContentKind(v) ? v : 'all'
}

// DBA toggle + kind dropdown -> the kinds to query. null = no restriction.
// Both set and disagreeing -> [] (nothing matches, the query is skipped).
export function kindsForFilter(dba: DbaFilter, kind: ContentKind | 'all'): ContentKind[] | null {
  if (dba === 'all' && kind === 'all') return null
  const fromDba: readonly ContentKind[] = dba === 'all' ? CONTENT_KINDS : kindsOfDba(dba)
  if (kind === 'all') return [...fromDba]
  return fromDba.includes(kind) ? [kind] : []
}

// ---- classification (design SS8) -------------------------------------------
export type ContentLite = { status: string; rights_status: string; held_reason: string | null }
export type DistLite = { status: string; attempts: number; next_attempt_at: string | null }

// "Rights waiting": held because rights are not cleared. Nobody here has
// anything to do (the maker fixes and resends), so it is its own bucket and is
// kept OUT of needs-action -- mixing them keeps needs-action permanently full.
export function isRightsWaiting(c: ContentLite): boolean {
  return c.status === 'held' && c.rights_status !== 'cleared'
}

// A failed row that will retry by itself is not "needs action" -- a person
// walking over to it would be a wasted trip. Exhausted = attempts >= max, or no
// next_attempt_at (failed_terminal). maxAttempts null = key missing = the
// dispatcher retries 0 times, so every failed row is exhausted.
export function isFailedExhausted(d: DistLite, maxAttempts: number | null): boolean {
  if (d.status !== 'failed') return false
  if (d.next_attempt_at === null) return true
  return d.attempts >= (maxAttempts ?? 0)
}

export function needsAction(c: ContentLite, dists: readonly DistLite[], maxAttempts: number | null): boolean {
  if (c.status !== 'scheduled' && c.status !== 'held') return false
  if (isRightsWaiting(c)) return false
  if (c.status === 'held' && c.held_reason === 'late_for_slot') return true
  return dists.some(
    (d) => d.status === 'unknown' || d.status.startsWith('skipped_') || isFailedExhausted(d, maxAttempts),
  )
}

export function matchesStatusFilter(
  f: StatusFilter,
  c: ContentLite,
  dists: readonly DistLite[],
  maxAttempts: number | null,
): boolean {
  switch (f) {
    case 'all':
      return true
    case 'action':
      return needsAction(c, dists, maxAttempts)
    case 'rights':
      return isRightsWaiting(c)
    case 'held':
      return c.status === 'held' && !isRightsWaiting(c)
    case 'scheduled':
    case 'returned':
    case 'hidden':
      return c.status === f
  }
}

// ---- dispatch switches / banner ---------------------------------------------
// Same fail-closed reading as the dispatcher: only the text 'true' is open.
export function isSwitchOpen(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true'
}

export type DispatchSwitches = { master: boolean; news: boolean; entertainment: boolean }

export function dispatchClosedReason(kind: ContentKind, s: DispatchSwitches): string | null {
  if (!s.master) return '전체 송출 마스터 스위치가 닫혀 있어'
  const dba = dbaOfKind(kind)
  if (!s[dba]) return `현재 ${DBA_LABEL[dba]} 송출 스위치가 닫혀 있어`
  return null
}

// The "no dispatch config" banner (design SS5-3 step 3): without these two
// keys the dispatcher sends NOTHING and says so only in a daily mail, so the
// admin screen shows it too. Retry keys are only informational.
export const REQUIRED_DISPATCH_KEYS = ['content_dispatch_per_tick', 'content_dispatch_max_bytes_default'] as const
export const RETRY_DISPATCH_KEYS = ['content_dispatch_max_attempts', 'content_dispatch_backoff_base_minutes'] as const

export function missingKeys(config: ReadonlyMap<string, string> | null, keys: readonly string[]): string[] {
  if (!config) return [...keys]
  return keys.filter((k) => (config.get(k) ?? '').trim() === '')
}

export function parsePositiveInt(v: string | undefined | null): number | null {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,15}$/.test(v.trim())) return null
  const n = Number(v.trim())
  return Number.isSafeInteger(n) ? n : null
}

export function isOversize(bytes: number | string | null | undefined, max: number | null): boolean {
  if (max === null || bytes === null || bytes === undefined) return false
  const n = typeof bytes === 'number' ? bytes : Number(bytes)
  return Number.isFinite(n) && n > max
}

// ---- time ------------------------------------------------------------------
export function remainingLabel(publishAt: string, now: Date): string {
  const ms = new Date(publishAt).getTime() - now.getTime()
  if (!Number.isFinite(ms)) return '-'
  const abs = Math.abs(ms)
  const mins = Math.floor(abs / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const span = d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`
  return ms >= 0 ? `${span} 후` : `${span} 지남`
}

// ---- [나갔음] URL ----------------------------------------------------------
const PLATFORM_HOSTS: Record<Platform, readonly string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  x: ['x.com', 'twitter.com'],
}

export type UrlCheck = { ok: true; url: string | null } | { ok: false; error: string }

// https + the platform's own domain. Empty is allowed only when the caller says
// so (unknown/failed); a row we never sent (skipped_*) needs the URL because it
// is the only evidence a person uploaded it (live dist_mark_posted enforces the
// same, this just fails earlier with a readable message).
export function checkExternalUrl(platform: string, raw: string, required: boolean): UrlCheck {
  const s = raw.trim()
  if (s === '') return required ? { ok: false, error: '이 채널은 직접 올린 URL이 필요합니다' } : { ok: true, url: null }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false, error: 'URL 형식이 올바르지 않습니다' }
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'https 주소만 입력할 수 있습니다' }
  const hosts = PLATFORM_HOSTS[platform as Platform]
  if (!hosts) return { ok: false, error: '알 수 없는 채널입니다' }
  const host = u.hostname.toLowerCase()
  if (!hosts.some((h) => host === h || host.endsWith('.' + h))) {
    return { ok: false, error: `${platform} 도메인(${hosts.join(', ')}) 주소여야 합니다` }
  }
  return { ok: true, url: u.toString() }
}

// ---- [송출] confirmation ---------------------------------------------------
export type PreviousVersion = { version: number; platform: string; status: string; url: string | null }

export type ReleaseConfirmInput = {
  title: string
  kind: ContentKind
  platforms: readonly string[]
  // null = the switch rows could not be read; say so instead of claiming "closed".
  switches: DispatchSwitches | null
  previous: readonly PreviousVersion[]
  oversize: { bytes: number; max: number } | null
}

// [송출] does NOT post: it moves held -> scheduled with publish_at = now() and
// the 5-minute cron posts through the same guards (HQ 2026-10-07). So the text
// never says "posts now" -- with the switches closed that would be false.
export function releaseConfirmLines(i: ReleaseConfirmInput): string[] {
  const lines = [
    `「${i.title}」`,
    i.platforms.length > 0 ? `채널: ${i.platforms.join(', ')}` : '채널: 없음 (사이트 전용)',
    '송출 대기열에 넣습니다. 스위치가 열려 있으면 약 5분 안에 올라갑니다.',
  ]
  if (i.switches === null) {
    lines.push('송출 스위치 상태를 읽지 못했습니다. 열려 있는지 확인할 수 없습니다.')
  } else {
    const closed = dispatchClosedReason(i.kind, i.switches)
    if (closed) lines.push(`${closed} 대기열에만 들어갑니다.`)
  }
  const posted = i.previous.filter((p) => p.status === 'posted')
  if (posted.length > 0) {
    lines.push(
      `이전 버전이 이미 송출됐습니다 (${posted.map((p) => `v${p.version} ${p.platform}`).join(', ')}). 플랫폼에서 지우셨습니까?`,
    )
  }
  if (i.oversize) {
    lines.push(
      `영상이 송출 상한(${formatMB(i.oversize.max)})보다 큽니다 (${formatMB(i.oversize.bytes)}). 송출에서 실패 처리됩니다.`,
    )
  }
  return lines
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`
}

// ---- action errors ---------------------------------------------------------
const ERROR_TEXT: Record<string, string> = {
  actor_required: '어드민 이메일을 확인할 수 없습니다',
  not_found: '대상을 찾을 수 없습니다',
  reason_required: '사유를 입력하세요',
  title_empty: '제목은 비울 수 없습니다',
  nothing_to_update: '바뀐 내용이 없습니다',
  lead_too_short: '현재 시각 + 최소 리드 시간보다 늦은 시각이어야 합니다',
  url_invalid: 'https 주소만 입력할 수 있습니다',
  url_required: '이 채널은 직접 올린 URL이 필요합니다',
  'precondition_failed:rights_not_cleared': '권리가 cleared가 아니라 송출할 수 없습니다',
  'precondition_failed:no_main_asset': '송출할 메인 영상 에셋이 없습니다',
  'precondition_failed:asset_url_empty': '메인 영상 에셋의 URL이 비어 있습니다',
  internal_error: '서버 오류가 났습니다 (서버 로그를 확인하세요)',
}

export function describeActionError(code: string): string {
  if (code in ERROR_TEXT) return ERROR_TEXT[code]
  const m = /^invalid_transition:([A-Za-z_]+)->([A-Za-z_]+)$/.exec(code)
  if (m) return `현재 상태(${m[1]})에서는 할 수 없습니다`
  if (code.startsWith('config_missing:') || code.startsWith('config_invalid:')) return `설정 오류: ${code}`
  return `실패: ${code}`
}
