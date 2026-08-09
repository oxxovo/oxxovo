// ⑥F -- "your film is live" notification rules. Pure; no database, no Resend.
//
// ★The rule is NOT "the cohort was released". Release is what usually flips an
// entry to visible, but it is not the same statement: an entry still awaiting the
// safety scan at release time becomes visible later, and an entry an admin hid
// never does. Keying the email off prelim_released_at would therefore mail people
// whose film nobody can see, and never mail the ones whose scan finished late.
// So the email follows the SAME predicate that puts the film on /watch
// (lib/watch-visibility.isRowPublic) plus "there is a file for this round".
//
// That also makes the notification self-healing: the tick re-evaluates every
// row every 15 minutes, and email_logs dedup makes a second evaluation a no-op.
// Nothing has to fire at the exact instant of release for the mail to be correct.

import type { TemplateKey } from './email/log'
import { isRowPublic, type VisibilityRow } from './watch-visibility'

export type VideoLiveRound = 'application' | 'main'

export type VideoLiveRow = VisibilityRow & {
  free_entry_url: string | null
  main_round_video_url: string | null
}

const TEMPLATE_BY_ROUND: Record<VideoLiveRound, TemplateKey> = {
  application: 'video_live_prelim',
  main: 'video_live_main',
}

export function videoLiveTemplateKey(round: VideoLiveRound): TemplateKey {
  return TEMPLATE_BY_ROUND[round]
}

// Which rounds of this entry have a film the public can watch right now.
//
// ★`votingOpen` gates the MAIN round on purpose. A main-round film becomes
// visible the moment it finalizes (there is no main-round hold), but the main
// email is not a "you are visible" email -- every line of it is about voting
// (deadline, vote count, share-to-get-votes). Sending it during the processing
// buffer, before community_vote_start_at, would hand the creator a deadline that
// has not started and a share CTA that leads to a disabled button. It fires when
// voting opens, which for the canonical schedule is the day after the films land.
export function videoLiveRounds(
  row: VideoLiveRow,
  opts: { votingOpen: boolean },
): VideoLiveRound[] {
  if (!isRowPublic(row)) return []
  const rounds: VideoLiveRound[] = []
  if (row.free_entry_url?.trim()) rounds.push('application')
  if (opts.votingOpen && row.main_round_video_url?.trim()) rounds.push('main')
  return rounds
}

// Is the community vote window open at `now`? Both ends must be known -- an
// unconfigured window is not an open one (fail closed: no email rather than an
// email promising a vote nobody can cast).
export function isVotingOpen(
  season: { community_vote_start_at?: string | null; community_vote_end_at?: string | null } | null,
  now: number,
): boolean {
  if (!season?.community_vote_start_at || !season.community_vote_end_at) return false
  const start = Date.parse(season.community_vote_start_at)
  const end = Date.parse(season.community_vote_end_at)
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return now >= start && now < end
}

// "2일 14시간" / "2d 14h" for the vote-deadline stat. Rounds DOWN on both units:
// a countdown that rounds up tells a creator they have longer than they do.
// Returns null when the deadline is unknown or already past -- the caller must
// not send a voting email in either case.
export function formatVoteDeadline(
  endAt: string | null | undefined,
  now: number,
  lang: 'ko' | 'en',
): string | null {
  if (!endAt) return null
  const end = Date.parse(endAt)
  if (Number.isNaN(end)) return null
  const ms = end - now
  if (ms <= 0) return null
  const totalHours = Math.floor(ms / 3_600_000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (lang === 'ko') return days > 0 ? `${days}일 ${hours}시간` : `${hours}시간`
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}
