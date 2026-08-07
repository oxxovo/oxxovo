// Official OXXOVO AI-actor roster -- SINGLE SOURCE OF TRUTH.
//
// KIRA / YUZU are OXXOVO's own marketing/demo actor identities, DISTINCT from a
// participant's freely-named character. Every UI string and demo label MUST
// reference these constants -- never a hardcoded "KIRA"/"YUZU" literal -- so a
// rename is a one-line swap here that propagates everywhere. Plain module (no
// server-only): client components (ActorMode) import it directly.
//
// ★THESE ARE REAL ACTOR NAMES, NOT PLACEHOLDER EXAMPLE TEXT. Reverted 2026-08-07:
// e27f5db moved them to lib/character-name-examples.ts on the premise that this
// file was "named and shaped like a roster" but was not one. The premise was
// wrong -- it IS the roster. The measurement that produced it ("the only thing
// anything imports is the joined string") was correct and still is; what it does
// not license is a conclusion about what the names ARE. A file with one consumer
// is a file with one consumer, not UI text.
//
// ★Head office confirmed the roster on 2026-08-07 and it has THREE members:
//   KIRA -- live
//   ANNA -- anime, REPLACES YUZU
//   RIN  -- live, CF
// This file still carries two entries and still says YUZU, deliberately. The
// YUZU -> ANNA swap waits on 제니3 clearance and is 제니2's to assign; adding RIN
// is the same call. Both are one line here when they come.
//
// ★`official_actors` (DB) is the onboarding table, not a second roster and not a
// count of the cast: one row live as of 2026-08-07, slug `actor-3-beauty-cf`,
// i.e. actor 3 = RIN. KIRA and ANNA are simply not onboarded yet. Any screen over
// that table must therefore be written for N rows -- a one-row reading of it is a
// reading of the onboarding backlog.
export type StudioActorKind = 'live' | 'anime'

export type StudioActor = {
  id: string
  name: string
  kind: StudioActorKind
  descriptor: string // brief look, for demo/marketing labels
}

export const STUDIO_ACTORS: readonly StudioActor[] = [
  { id: 'kira', name: 'KIRA', kind: 'live', descriptor: 'live-action, red hair' },
  { id: 'yuzu', name: 'YUZU', kind: 'anime', descriptor: 'anime, orange curls' },
] as const

// Ordered official names, e.g. ['KIRA', 'YUZU'].
export const STUDIO_ACTOR_NAMES: readonly string[] = STUDIO_ACTORS.map((a) => a.name)

// Illustrative example text for the "name your character" placeholder, e.g.
// "KIRA, YUZU". One place feeds every "e.g. …" label.
export const STUDIO_ACTOR_EXAMPLES: string = STUDIO_ACTOR_NAMES.join(', ')
