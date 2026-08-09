// Schedule bullets for the submission receipts (⑤/⑪). Pure; no database.
//
// ★EVERY DATE COMES FROM THE SEASON ROW. Jenny3's copy names real dates
// (Nov 4 / Nov 5-7 / Nov 8 / Nov 13-15 / Nov 16), and typing those into a
// template would put the canonical schedule in a second place -- one that no
// migration touches. That schedule has already moved once (five weeks, 2026-07).
// So each bullet is rendered from its column, and ★a bullet whose column is null
// is OMITTED rather than guessed. A receipt with one line missing is recoverable;
// a receipt confidently naming a date the platform no longer runs on is not.
//
// ★And the two timezones are deliberate, not an accident of formatting. The
// Korean copy says 한국 시간 and the English copy says PT, because those are the
// clocks the two audiences plan against. Both come from the same instant.

export type ScheduleLine = { label: string; value: string }

type Lang = 'ko' | 'en'

const ZONE: Record<Lang, string> = { ko: 'Asia/Seoul', en: 'America/Los_Angeles' }

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

// ★Korean is composed here, NOT taken from ICU locale data.
//
// Measured 2026-08-08: `new Intl.DateTimeFormat('ko-KR', { hour12: true })` on
// this Node build returns the day period as "PM", not "오후" -- so the Korean
// copy would depend on which ICU data the runtime shipped with, and would differ
// between this machine and Vercel with nothing to catch it. Same class as the
// dissolve field depending on the ffmpeg build's libm.
//
// So Intl is used ONLY for what is genuinely locale-independent: the numeric
// year/month/day/hour/minute in a named timezone. The words are ours.
type Wall = { year: number; month: number; day: number; hour: number; minute: number }

function wallClock(d: Date, zone: string): Wall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour'), minute: n('minute') }
}

const EN_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The zone abbreviation is the one thing that must come from Intl -- it is the
// only part that changes with the date rather than with the locale (PST vs PDT),
// and it is an English string in both languages' copy.
function zoneAbbrev(d: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(d)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

// "11월 4일" / "Nov 4"
export function formatScheduleDay(iso: string | null | undefined, lang: Lang): string | null {
  const d = parse(iso)
  if (!d) return null
  const w = wallClock(d, ZONE[lang])
  return lang === 'ko' ? `${w.month}월 ${w.day}일` : `${EN_MONTH[w.month - 1]} ${w.day}`
}

// "11월 8일 오전 5시(한국 시간)" / "Nov 8, 12:00 PM PST"
//
// ★The zone abbreviation is produced by Intl, never typed. Season 0's dates fall
// after the 2026-11-01 DST change so they are PST -- but a season that runs in
// July is PDT, and a hardcoded "PST" would be wrong for it by an hour with
// nothing to catch it.
export function formatScheduleMoment(iso: string | null | undefined, lang: Lang): string | null {
  const d = parse(iso)
  if (!d) return null
  const w = wallClock(d, ZONE[lang])
  const day = formatScheduleDay(iso, lang)
  const h12 = w.hour % 12 || 12
  const mm = String(w.minute).padStart(2, '0')

  if (lang === 'ko') {
    const period = w.hour < 12 ? '오전' : '오후'
    // 제니3 writes "오전 5시", so a whole hour drops its minutes.
    const time = w.minute === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${mm}분`
    return `${day} ${time}(한국 시간)`
  }
  return `${day}, ${h12}:${mm} ${w.hour < 12 ? 'AM' : 'PM'} ${zoneAbbrev(d, ZONE.en)}`
}

// "11월 13일 ~ 11월 15일" / "Nov 13-15". Null unless BOTH ends are known -- half
// a range is not a range, and "Nov 13-" is worse than saying nothing.
export function formatScheduleRange(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
  lang: Lang,
): string | null {
  const from = formatScheduleDay(fromIso, lang)
  const to = formatScheduleDay(toIso, lang)
  if (!from || !to) return null
  return lang === 'ko' ? `${from} ~ ${to}` : `${from} – ${to}`
}

export type ReceiptSeason = {
  application_close_at?: string | null
  scoring_complete_at?: string | null
  community_vote_start_at?: string | null
  community_vote_end_at?: string | null
  awards_announcement_at?: string | null
}

// ⑤ preliminary receipt.
//
// ★Two of Jenny3's four bullets cannot be sourced yet and are therefore absent:
//   - "AI 심사 11/5 ~ 11/7" -- there is no scoring START column, only
//     scoring_complete_at, so only the end can be stated truthfully.
//   - "결과 안내 11/8" -- head office is still adding that column
//     (the 11/8 12:00 marker). When it lands, add one entry here.
export function prelimReceiptLines(season: ReceiptSeason, lang: Lang): ScheduleLine[] {
  const lines: ScheduleLine[] = []
  const live = formatScheduleDay(season.application_close_at, lang)
  if (live) {
    lines.push({
      label: lang === 'ko' ? '공개' : 'Goes live',
      value:
        lang === 'ko'
          ? `${live}부터 검증 통과 순서대로`
          : `from ${live}, as each entry clears verification`,
    })
  }
  const judged = formatScheduleDay(season.scoring_complete_at, lang)
  if (judged) {
    lines.push({
      label: lang === 'ko' ? 'AI 심사' : 'AI judging',
      value: lang === 'ko' ? `${judged}까지` : `through ${judged}`,
    })
  }
  return lines
}

// ⑪ main-round receipt. Both bullets are fully sourceable.
export function mainReceiptLines(season: ReceiptSeason, lang: Lang): ScheduleLine[] {
  const lines: ScheduleLine[] = []
  const voting = formatScheduleRange(
    season.community_vote_start_at,
    season.community_vote_end_at,
    lang,
  )
  if (voting) {
    lines.push({ label: lang === 'ko' ? '관객 투표' : 'Audience voting', value: voting })
  }
  const winners = formatScheduleMoment(season.awards_announcement_at, lang)
  if (winners) {
    lines.push({ label: lang === 'ko' ? '우승 발표' : 'Winners', value: winners })
  }
  return lines
}
