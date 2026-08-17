// Where a season is in its life, resolved ONCE for every surface that shows it.
//
// The stage machine itself is getBannerStage (lib/watch.ts) and this module does
// not reimplement it. What it does own is the four numbers that machine needs --
// finalistCount, finalistFilmCount, winnerCount, theme -- because those come from
// queries, not from the season row, and deriving them a second time somewhere else
// is how two surfaces end up disagreeing about the same instant.
//
// That disagreement is not hypothetical: the landing has been rendering
// "Submission Closes In / 00 00 00 00" from the close date all the way to the
// awards, underneath a CTA that already said "Join the waitlist". One screen, two
// answers. The fix is not a second mapping on the landing -- it is this one.
//
// SERVER ONLY (it reads through the service role). Client components reach it
// through the server action in app/_actions/season-stage.ts.

import 'server-only'
import {
  getBannerStage,
  getFinalists,
  getFinalistRevealState,
  type BannerContent,
  type Finalist,
} from './watch'
import { getRevealedTheme } from './seasons-theme'
import { isMainThemeRevealed } from './theme-reveal'
import type { Season } from './seasons'

// Re-exported for existing callers/tests -- the function itself now lives in
// lib/theme-reveal.ts (no local imports, so lib/seasons-theme.ts can depend
// on it without a cycle back through this file). See that file for the full
// history/rationale comment.
export { isMainThemeRevealed }

export type SeasonStage = {
  content: BannerContent
  // now >= main_round_start_at. No upper bound -- the terminal stages are read off
  // `content.stage`, which is why callers must not re-derive a round label from
  // this alone (see the cardRoundName stopgap in ArenaWatch).
  inMainRound: boolean
  // Finalists are only loaded once the reveal date has passed; before that the
  // count comes from finalistReveal and the roster stays private.
  finalists: Finalist[]
  finalistReveal: { count: number; revealAt: string } | null
  // The main-round theme LABEL (main_round_theme_label). Never gated
  // (2026-08-17 TK decision -- see ThemeDisplay.mainTheme, lib/seasons.ts) --
  // shown as soon as it's set, prelim included. Never the full
  // main_round_theme brief, and never the twist/required element -- those
  // stay off this type entirely.
  theme: string | null
}

const CLOSED: SeasonStage = {
  content: { stage: 'accepting' },
  inMainRound: false,
  finalists: [],
  finalistReveal: null,
  theme: null,
}

// `seasonId` is passed separately because the Watch surface resolves an id even
// when the season row itself is unavailable, and the finalist queries are keyed on
// the id alone. A null season means we know nothing about the calendar, so the
// honest answer is the neutral 'accepting' strip rather than a guessed stage.
export async function resolveSeasonStage(
  season: Season | null,
  seasonId: string,
  now: Date = new Date(),
): Promise<SeasonStage> {
  const mainStart = season?.main_round_start_at ? Date.parse(season.main_round_start_at) : null
  const inMainRound = mainStart != null && now.getTime() >= mainStart

  // ★theme comes from getRevealedTheme() (lib/seasons-theme.ts), NOT from
  // season.main_round_theme_label directly -- that field sat on
  // seasons_public (anon-readable, reproduced live 2026-08-16) and reading it
  // here would be a second independent access path to a column only
  // getRevealedTheme() may touch. It is also unconditional now (2026-08-17):
  // the label carries no time gate at all, so this is not "the same gate,
  // called from one more place" -- there is no gate on this field any more.
  // finalistReveal is unrelated -- it feeds the separate "N finalists
  // advanced, revealed on {date}" roster teaser, not the theme.
  const [finalistReveal, revealedTheme] = await Promise.all([
    getFinalistRevealState(seasonId),
    getRevealedTheme(seasonId, now),
  ])
  const finalists = inMainRound ? await getFinalists(seasonId) : []

  if (!season) return { ...CLOSED, inMainRound, finalists, finalistReveal }

  const theme = revealedTheme.mainTheme

  const content = getBannerStage(
    {
      applicationCloseAt: season.application_close_at ?? null,
      mainRoundStartAt: season.main_round_start_at ?? null,
      voteStartAt: season.community_vote_start_at ?? null,
      voteEndAt: season.community_vote_end_at ?? null,
      awardsAt: season.awards_announcement_at ?? null,
      finalistCount: finalistReveal?.count ?? finalists.length,
      finalistFilmCount: finalists.filter((f) => f.mainVideoUrl).length,
      // Real winners, not the calendar: award_rank is written by a manual admin
      // approval, so "announced" must never be claimed before any rank exists.
      winnerCount: finalists.filter((f) => f.awardRank != null).length,
      theme,
    },
    now,
  )

  return { content, inMainRound, finalists, finalistReveal, theme }
}
