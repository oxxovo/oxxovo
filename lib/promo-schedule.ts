import 'server-only'
import type { ParsedConfigValue } from '@/lib/partners'

// Promo publish cadence: weekday/time/timezone from platform_config, entirely
// operator-set (no hardcoded schedule). Empty weekdays IS the pause state --
// there is no separate promo_auto_publish_enabled bool (HQ 2026-08-14, see
// reports/promo_auto_publish_design_2026-08-14.md SS0).

const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export type PromoCadence = {
  weekdays: string[]
  time: string | null
  timezone: string | null
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
