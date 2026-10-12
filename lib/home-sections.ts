// Video sections of the new site and the card badge of each origin -- the ONE place
// that knows which content kinds a section lists and which badge a kind gets. Pure: no
// env, no DB. (Which pages exist, and their menus, is lib/site-nav.ts.)
//
// Which kinds a section lists is decided here and nowhere else. WHETHER a kind is
// public is not decided here at all: the two public doors (lib/watch-gate +
// lib/watch for the competition, lib/content-public for contents) answer that, and
// lib/home-feed only calls them.
import { CONTENT_KINDS, type ContentKind } from '@/lib/content-kinds'
import type { MessageKey } from '@/lib/site-messages-en'

export type SectionId = 'all' | 'competition' | 'entertainment' | 'news' | 'film' | 'drama' | 'cf' | 'music'

export type SectionDef = {
  id: SectionId
  labelKey: MessageKey
  // Videos this section lists. `competition` = the competition door; `kinds` = content
  // kinds asked of the contents door.
  competition: boolean
  kinds: readonly ContentKind[]
}

export const SECTIONS: readonly SectionDef[] = [
  { id: 'all', labelKey: 'section.all', competition: true, kinds: CONTENT_KINDS },
  { id: 'competition', labelKey: 'section.competition', competition: true, kinds: [] },
  { id: 'entertainment', labelKey: 'nav.entertainment', competition: false, kinds: ['film', 'drama', 'cf', 'music', 'music_video'] },
  { id: 'news', labelKey: 'section.news', competition: false, kinds: ['news'] },
  { id: 'film', labelKey: 'section.film', competition: false, kinds: ['film'] },
  { id: 'drama', labelKey: 'section.drama', competition: false, kinds: ['drama'] },
  { id: 'cf', labelKey: 'section.cf', competition: false, kinds: ['cf'] },
  // Music lists both music and music_video (TK 2026-10-11).
  { id: 'music', labelKey: 'section.music', competition: false, kinds: ['music', 'music_video'] },
]

const BY_ID = new Map<string, SectionDef>(SECTIONS.map((s) => [s.id, s]))

export function getSection(id: SectionId): SectionDef {
  return BY_ID.get(id) as SectionDef
}

export function isSectionId(v: unknown): v is SectionId {
  return typeof v === 'string' && BY_ID.has(v)
}

// Card badge by origin, as a catalog key suffix (badge.<id>). Change a badge here and
// nowhere else. cf is COMMERCIAL as a whole for now; telling own-made from commissioned
// CF is Phase 2 (TK 2026-10-11).
export type BadgeId = 'competition' | 'original' | 'daily' | 'commercial'

const KIND_BADGE: Record<ContentKind, BadgeId> = {
  news: 'daily',
  drama: 'original',
  film: 'original',
  music: 'original',
  music_video: 'original',
  cf: 'commercial',
}
export const COMPETITION_BADGE: BadgeId = 'competition'

export function badgeOfKind(kind: ContentKind): BadgeId {
  return KIND_BADGE[kind]
}

export function badgeKey(id: BadgeId): MessageKey {
  return `badge.${id}` as MessageKey
}
