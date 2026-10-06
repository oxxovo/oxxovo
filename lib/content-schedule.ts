// News publish slot for POST /api/contents/import (design SS3-4).
//
// Why a new file instead of parseCadence(): parseCadence is hard-wired to the
// promo_* keys and silently DROPS invalid weekday tokens ("월~금" -> []), which
// is the quiet-stop trap SS3-4 warns about. Here an unparseable key is an
// error the endpoint turns into a 503.
//
// Node validation is deliberately LOOSER than the RPC: this only needs enough
// to compute a slot. content_import re-reads platform_config in the DB and
// makes the final call (strict regex, timezone against pg_timezone_names). If
// the two ever disagree Node passes and the RPC answers config_invalid:<key>
// -- a 503 either way, never a wrong slot.
//
// nextPublishSlot() is reused as is (pure); promo-schedule.ts is not touched.
import { nextPublishSlot, type PromoCadence } from '@/lib/promo-schedule'

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Seconds of clock skew allowed between this Node clock and the DB clock that
// content_import's lead check uses. Without it a slot landing within
// milliseconds of now+lead can pass here and fail there with lead_too_short.
const CLOCK_SKEW_MS = 30_000

export type NewsScheduleRaw = {
  weekdays: string | null
  time: string | null
  timezone: string | null
}

export type NewsScheduleResult =
  | { ok: true; cadence: PromoCadence }
  | { ok: false; error: string } // config_missing:<key> | config_invalid:<key>

const KEY = {
  weekdays: 'news_publish_weekdays',
  time: 'news_publish_time',
  timezone: 'news_publish_timezone',
} as const

export function parseNewsSchedule(raw: NewsScheduleRaw): NewsScheduleResult {
  if (raw.weekdays === null) return { ok: false, error: `config_missing:${KEY.weekdays}` }
  if (raw.time === null) return { ok: false, error: `config_missing:${KEY.time}` }
  if (raw.timezone === null) return { ok: false, error: `config_missing:${KEY.timezone}` }

  const tokens = raw.weekdays.split(',')
  // Every token must be a known abbreviation: a single bad token invalidates
  // the key (dropping it would quietly run on fewer days).
  if (tokens.length === 0 || tokens.some((t) => !(WEEKDAYS as readonly string[]).includes(t))) {
    return { ok: false, error: `config_invalid:${KEY.weekdays}` }
  }
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(raw.time)) {
    return { ok: false, error: `config_invalid:${KEY.time}` }
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw.timezone })
  } catch {
    return { ok: false, error: `config_invalid:${KEY.timezone}` }
  }
  return { ok: true, cadence: { weekdays: [...new Set(tokens)], time: raw.time, timezone: raw.timezone } }
}

export type NewsSlot = {
  publishAt: Date
  // The slot for "right now" differs from the slot after the minimum lead:
  // the slot was missed. The item is imported as held (late_for_slot) and a
  // person decides with [송출].
  lateForSlot: boolean
}

export function computeNewsSlot(now: Date, leadMinutes: number, cadence: PromoCadence): NewsSlot | null {
  const slotNow = nextPublishSlot(cadence, now)
  const slotLead = nextPublishSlot(cadence, new Date(now.getTime() + leadMinutes * 60_000 + CLOCK_SKEW_MS))
  if (!slotNow || !slotLead) return null
  return { publishAt: slotLead, lateForSlot: slotNow.getTime() !== slotLead.getTime() }
}
