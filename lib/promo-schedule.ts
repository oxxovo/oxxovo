import type { ParsedConfigValue } from '@/lib/partners'

// Promo publish cadence: weekday/time/timezone from platform_config, entirely
// operator-set (no hardcoded schedule). Empty weekdays IS the pause state --
// there is no separate promo_auto_publish_enabled bool (HQ 2026-08-14, see
// reports/promo_auto_publish_design_2026-08-14.md SS0).
//
// ★No `server-only` here on purpose: every function in this file is pure date
// arithmetic + Intl, no secrets, no DB. The cadence FORM (app/admin/promo/
// PromoView.tsx, a client component) needs the exact same weekday/window/
// next-slot logic the cron uses for its "next publish is..." preview -- a
// second, hand-copied implementation in the client file is how the preview
// and the actual cron behavior drift apart.

const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export type PromoCadence = {
  weekdays: string[]
  time: string | null
  timezone: string | null
}

// Closed set, not free text (HQ 2026-08-14 -- TK typed "korea", which is not
// an IANA name, and it would have saved silently and then just never fired,
// undetected until someone noticed nothing was going out). The admin UI
// renders this as a <select>; the server action validates against the same
// list, so a request that bypasses the dropdown still can't write a
// timezone the cron can't parse.
export const PROMO_TIMEZONES = [
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
] as const

export function isValidPromoTimezone(tz: string): boolean {
  return PROMO_TIMEZONES.some((t) => t.value === tz)
}

// "6" -> "06:00", "630" -> "06:30", "6:30" -> "06:30", "18" -> "18:00".
// Returns null for anything that isn't a valid 24h time -- the caller is
// responsible for rejecting/flagging null rather than saving it (HQ
// 2026-08-14: "사람이 형식을 맞추게 하지 마라", but an unparseable value must
// still block the save, not get silently coerced to something wrong).
export function normalizePromoTime(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const pad = (n: number) => String(n).padStart(2, '0')

  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hh = Number(hhmm[1])
    const mm = Number(hhmm[2])
    return hh <= 23 && mm <= 59 ? `${pad(hh)}:${pad(mm)}` : null
  }

  const digits = s.match(/^(\d{1,4})$/)
  if (digits) {
    const d = digits[1]
    if (d.length <= 2) {
      const hh = Number(d)
      return hh <= 23 ? `${pad(hh)}:00` : null
    }
    const hh = Number(d.length === 3 ? d.slice(0, 1) : d.slice(0, 2))
    const mm = Number(d.length === 3 ? d.slice(1) : d.slice(2))
    return hh <= 23 && mm <= 59 ? `${pad(hh)}:${pad(mm)}` : null
  }

  return null
}

export function parseCadence(map: Map<string, ParsedConfigValue>): PromoCadence {
  const weekdaysRaw = String(map.get('promo_publish_weekdays') ?? '').trim()
  const weekdays = weekdaysRaw
    ? weekdaysRaw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => (WEEKDAY_ABBR as readonly string[]).includes(s))
    : []
  const time = String(map.get('promo_publish_time') ?? '').trim() || null
  const timezone = String(map.get('promo_publish_timezone') ?? '').trim() || null
  return { weekdays, time, timezone }
}

// Is `now` inside this tick's publish window? Window = [target, target +
// windowMinutes) on a configured weekday, evaluated in the configured
// timezone. Missing/empty weekdays, time, or timezone means "paused" --
// returns false, matching the "0 weekdays = 0 publishes" rule.
export function isInPublishWindow(cadence: PromoCadence, now: Date, windowMinutes: number): boolean {
  if (cadence.weekdays.length === 0 || !cadence.time || !cadence.timezone) return false

  const [hh, mm] = cadence.time.split(':').map((n) => Number.parseInt(n, 10))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false

  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: cadence.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    // Invalid IANA name in platform_config -- treat as paused rather than
    // throwing, the tick log records inWindow=false either way.
    return false
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday').slice(0, 3).toLowerCase()
  if (!cadence.weekdays.includes(weekday)) return false

  const nowMinutes = Number.parseInt(get('hour'), 10) * 60 + Number.parseInt(get('minute'), 10)
  const targetMinutes = hh * 60 + mm
  const diff = nowMinutes - targetMinutes
  return diff >= 0 && diff < windowMinutes
}

// The UTC instant corresponding to a Y-M-D HH:MM wall-clock reading in
// `timeZone`. Standard "format the guess, diff the offset" trick -- accurate
// except right at the instant of a DST transition, which is an acceptable
// error for a preview label (the cron's own gate, isInPublishWindow above,
// never uses this and is not subject to that edge case).
function zonedWallTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guessMs = Date.UTC(y, m - 1, d, hh, mm)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guessMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const offsetMs = asIfUtc - guessMs
  return new Date(guessMs - offsetMs)
}

// First instant at/after `from` where isInPublishWindow would fire -- for the
// "다음 발행은 언제" save-time preview (HQ 2026-08-14). Scans the next 8
// calendar days (in the target timezone) rather than re-deriving the
// weekday/time math separately, so the preview can never say one thing while
// the cron does another.
export function nextPublishSlot(cadence: PromoCadence, from: Date): Date | null {
  if (cadence.weekdays.length === 0 || !cadence.time || !cadence.timezone) return null
  const [hh, mm] = cadence.time.split(':').map((n) => Number.parseInt(n, 10))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const probe = new Date(from.getTime() + dayOffset * 86_400_000)
    let parts: Intl.DateTimeFormatPart[]
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: cadence.timezone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(probe)
    } catch {
      return null
    }
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const weekday = get('weekday').slice(0, 3).toLowerCase()
    if (!cadence.weekdays.includes(weekday)) continue

    const candidate = zonedWallTimeToUtc(Number(get('year')), Number(get('month')), Number(get('day')), hh, mm, cadence.timezone)
    if (candidate.getTime() >= from.getTime()) return candidate
  }
  return null
}
