// Home (/) aggregation layer -- SERVER ONLY. Contents and competition stay in
// their own tables and their own doors; this file only CALLS the doors and shapes
// what they return into one card type. It never judges publicness itself:
//   competition -> isCompetitionWatchPublic() gate, then getWatchVideos() for the
//                  current season (which applies the hold / hidden / fixture rules)
//   contents    -> listPublicContents() (the only door to public `contents`)
// A new filter written here would be a third rule, which is how a list and a detail
// page once disagreed and leaked. The only thing done here is NARROWING a door's
// answer (current season, no fixture season, kinds of the chosen section), never
// widening it.
//
// FAIL-CLOSED: a door that throws contributes no cards. Deps are injectable so the
// tests can prove each of these without a database.
import 'server-only'
import { isCompetitionWatchPublic } from '@/lib/watch-gate'
import { getWatchVideos, type WatchVideo } from '@/lib/watch'
import { getCurrentSeason } from '@/lib/seasons'
import { listPublicContents, getContentPaths, type PublicListItem } from '@/lib/content-public'
import { contentUrl, type ContentPaths } from '@/lib/content-paths'
import type { ContentKind } from '@/lib/content-kinds'
import {
  badgeOfKind,
  COMPETITION_BADGE,
  getSection,
  type BadgeId,
  type SectionId,
} from '@/lib/home-sections'
import { DEFAULT_LOCALE } from '@/lib/locales'
import { pickTranslation, type ContentTranslations } from '@/lib/site-messages'

export const HOME_CARD_MAX = 24

// The only fields a card carries. Everything is already public on the door it came
// from; there is deliberately no score, rank, like count, source or upstream field.
export type HomeCard = {
  key: string
  href: string | null
  title: string
  subtitle: string | null
  // Longer text shown on hover (the description); null when there is none.
  summary: string | null
  badge: BadgeId
  publishedAt: string | null
  durationSec: number | null
  thumbnailUrl: string | null
  aiGenerated: boolean
}

export type HomeFeedDeps = {
  competitionOpen: () => Promise<boolean>
  currentSeasonId: () => Promise<string | null>
  competitionVideos: (seasonId: string) => Promise<WatchVideo[]>
  contents: (kind: ContentKind) => Promise<PublicListItem[]>
  paths: () => Promise<ContentPaths>
  // Translated title/description per content id (AI translation is not built yet: the
  // real implementation answers {} and every card keeps its English canonical text).
  translations: (ids: string[]) => Promise<Record<string, ContentTranslations>>
}

const realDeps: HomeFeedDeps = {
  competitionOpen: isCompetitionWatchPublic,
  currentSeasonId: async () => (await getCurrentSeason())?.id ?? null,
  competitionVideos: (seasonId) => getWatchVideos({ seasonId, sort: 'latest' }),
  // withThumbnails: the list door adds the url of the item's thumbnail (role thumbnail
  // only) -- the single extra field a card gets from it.
  contents: (kind) => listPublicContents({ kind, limit: HOME_CARD_MAX, withThumbnails: true }),
  paths: () => getContentPaths(),
  translations: async () => ({}),
}

const SUMMARY_MAX = 200
function clip(v: string | null | undefined): string | null {
  const t = typeof v === 'string' ? v.trim() : ''
  if (t === '') return null
  return t.length > SUMMARY_MAX ? `${t.slice(0, SUMMARY_MAX)}…` : t
}

export function competitionCard(v: WatchVideo): HomeCard {
  return {
    key: `competition:${v.applicationId}:${v.round}`,
    href: `/watch/${v.applicationId}?round=${v.round}`,
    title: v.videoTitle?.trim() || v.creatorName,
    subtitle: v.videoTitle?.trim() ? v.creatorName : null,
    summary: clip(v.videoDescription),
    badge: COMPETITION_BADGE,
    publishedAt: v.submittedAt,
    durationSec: v.durationSeconds,
    thumbnailUrl: httpsOrNull(v.thumbnailUrl),
    aiGenerated: false,
  }
}

export function contentCard(c: PublicListItem, paths: ContentPaths): HomeCard {
  return {
    key: `content:${c.id}`,
    // null = that kind has no public address configured: show the card, do not link.
    href: contentUrl(c.kind, c.id, paths),
    title: c.title,
    subtitle: c.description,
    summary: clip(c.description),
    badge: badgeOfKind(c.kind),
    publishedAt: c.publish_at,
    durationSec: null,
    thumbnailUrl: httpsOrNull(c.thumbnail_url),
    aiGenerated: c.ai_generated,
  }
}

// An image address is shown only if it is https; anything else is dropped (gradient frame).
function httpsOrNull(u: string | null | undefined): string | null {
  return typeof u === 'string' && u.trim().startsWith('https://') ? u.trim() : null
}

function time(s: string | null): number {
  const t = s ? Date.parse(s) : NaN
  return Number.isFinite(t) ? t : 0
}

export async function getHomeCards(
  section: SectionId,
  deps: HomeFeedDeps = realDeps,
  lang: string = DEFAULT_LOCALE,
): Promise<HomeCard[]> {
  const def = getSection(section)
  const cards: HomeCard[] = []

  if (def.competition) {
    try {
      if (await deps.competitionOpen()) {
        const seasonId = await deps.currentSeasonId()
        if (seasonId) {
          const videos = await deps.competitionVideos(seasonId)
          // Narrowing only: the current season (the door was asked for it; this
          // re-checks that the door honoured it) and never a fixture/rehearsal entry.
          for (const v of videos) {
            if (v.seasonId !== seasonId || v.isFixture) continue
            cards.push(competitionCard(v))
          }
        }
      }
    } catch (e) {
      console.error('[home-feed] competition door failed:', e instanceof Error ? e.name : 'unknown')
    }
  }

  if (def.kinds.length > 0) {
    try {
      const paths = await deps.paths()
      const lists = await Promise.all(
        def.kinds.map(async (kind) => {
          try {
            return (await deps.contents(kind)).filter((c) => c.kind === kind)
          } catch (e) {
            console.error('[home-feed] contents door failed:', kind, e instanceof Error ? e.name : 'unknown')
            return []
          }
        }),
      )
      const found = lists.flat()
      let tr: Record<string, ContentTranslations> = {}
      if (lang !== DEFAULT_LOCALE && found.length > 0) {
        try {
          tr = await deps.translations(found.map((c) => c.id))
        } catch (e) {
          console.error('[home-feed] translations failed:', e instanceof Error ? e.name : 'unknown')
        }
      }
      for (const c of found) {
        const loc = pickTranslation(c, lang, tr[c.id])
        cards.push(contentCard({ ...c, title: loc.title, description: loc.description }, paths))
      }
    } catch (e) {
      console.error('[home-feed] contents paths failed:', e instanceof Error ? e.name : 'unknown')
    }
  }

  // Newest first across sources; key breaks ties so the order is stable.
  cards.sort((a, b) => time(b.publishedAt) - time(a.publishedAt) || (a.key < b.key ? -1 : 1))
  return cards.slice(0, HOME_CARD_MAX)
}
