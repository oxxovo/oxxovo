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
import { DateTime } from 'luxon'
import {
  ACTION_ERROR_TEXT,
  CONFIRM_TEXT,
  CONTENT_STATUS_TEXT,
  DBA_TEXT,
  ERROR_TEXT,
  FILTER_TEXT,
  PROBE_BLOCK_MESSAGE,
  SWITCH_TEXT,
} from '@/lib/content-admin-text'

// All wording is in lib/content-admin-text.ts. Re-exported because the server actions
// and the tests have always imported it from here.
export { PROBE_BLOCK_MESSAGE }

// ---- probe rows (HQ 2026-10-06) --------------------------------------------
// Test rows are named `probe-...` by scripts/probe-contents.mjs. They are
// permanent (contents cannot be deleted) and one of them is `cleared`. Hiding
// them in the list is a convenience; the thing that matters is that nobody can
// push one into the dispatch queue, so the server actions call this too.
export const PROBE_PREFIX = 'probe-'

export function isProbeRef(sourceRef: unknown): boolean {
  return typeof sourceRef === 'string' && sourceRef.trim().toLowerCase().startsWith(PROBE_PREFIX)
}

// ---- filters ---------------------------------------------------------------
export const STATUS_FILTERS = ['all', 'action', 'rights', 'scheduled', 'held', 'returned', 'hidden'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]
export const DBA_FILTERS = ['all', ...DBAS] as const
export type DbaFilter = (typeof DBA_FILTERS)[number]

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: FILTER_TEXT.all,
  action: FILTER_TEXT.action,
  rights: FILTER_TEXT.rights,
  scheduled: CONTENT_STATUS_TEXT.scheduled,
  held: CONTENT_STATUS_TEXT.held,
  returned: CONTENT_STATUS_TEXT.returned,
  hidden: CONTENT_STATUS_TEXT.hidden,
}
export const DBA_LABEL: Record<Dba, string> = { news: DBA_TEXT.news, entertainment: DBA_TEXT.entertainment }

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
  if (!s.master) return SWITCH_TEXT.masterClosed
  const dba = dbaOfKind(kind)
  if (!s[dba]) return SWITCH_TEXT.dbaClosed(DBA_LABEL[dba])
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
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return ms >= 0 ? `in ${span}` : `${span} ago`
}

// ★One zone on this screen: US Pacific, "Oct 7, 2026, 14:30 PT" -- en-US, 24-hour
// (an ops screen: AM/PM gets misread), always suffixed. Cron logs and the EOD docs
// stay UTC; only this screen is PT. Built from formatToParts so the shape does not
// depend on the runtime's punctuation, and hourCycle h23 so midnight is 00, not 24.
export const PT_ZONE = 'America/Los_Angeles'
const PT_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: PT_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatPT(iso: string): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '-'
  const p = Object.fromEntries(PT_FORMAT.formatToParts(t).map((x) => [x.type, x.value]))
  return `${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} PT`
}

// A <input type="datetime-local"> value ("2026-10-08T07:00") is a wall-clock time with
// no zone. The screen shows PT, so the input is read as PT too -- NOT the browser's
// zone, which is what new Date(v) would use. null = not a valid time.
export function ptWallToIso(v: string): string | null {
  const dt = DateTime.fromISO(v, { zone: PT_ZONE })
  return dt.isValid ? dt.toUTC().toISO() : null
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
  if (s === '') return required ? { ok: false, error: ERROR_TEXT.urlRequired } : { ok: true, url: null }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false, error: ERROR_TEXT.urlInvalid }
  }
  if (u.protocol !== 'https:') return { ok: false, error: ERROR_TEXT.httpsOnly }
  const hosts = PLATFORM_HOSTS[platform as Platform]
  if (!hosts) return { ok: false, error: ERROR_TEXT.unknownChannel }
  const host = u.hostname.toLowerCase()
  if (!hosts.some((h) => host === h || host.endsWith('.' + h))) {
    return { ok: false, error: ERROR_TEXT.wrongDomain(platform, hosts.join(', ')) }
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
    `"${i.title}"`,
    i.platforms.length > 0 ? CONFIRM_TEXT.channels(i.platforms.join(', ')) : CONFIRM_TEXT.noChannels,
    CONFIRM_TEXT.queueNote,
  ]
  if (i.switches === null) {
    lines.push(CONFIRM_TEXT.switchesUnreadable)
  } else {
    const closed = dispatchClosedReason(i.kind, i.switches)
    if (closed) lines.push(CONFIRM_TEXT.onlyQueued(closed))
  }
  const posted = i.previous.filter((p) => p.status === 'posted')
  if (posted.length > 0) {
    lines.push(CONFIRM_TEXT.priorDispatched(posted.map((p) => `v${p.version} ${p.platform}`).join(', ')))
  }
  if (i.oversize) {
    lines.push(CONFIRM_TEXT.oversize(formatMB(i.oversize.max), formatMB(i.oversize.bytes)))
  }
  return lines
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`
}

// ---- action errors ---------------------------------------------------------
export function describeActionError(code: string): string {
  if (code in ACTION_ERROR_TEXT) return ACTION_ERROR_TEXT[code]
  const m = /^invalid_transition:([A-Za-z_]+)->([A-Za-z_]+)$/.exec(code)
  if (m) return ERROR_TEXT.invalidTransition(m[1])
  if (code.startsWith('config_missing:') || code.startsWith('config_invalid:')) return ERROR_TEXT.configError(code)
  return ERROR_TEXT.failed(code)
}
