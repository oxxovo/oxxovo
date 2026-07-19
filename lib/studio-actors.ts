// Official OXXOVO AI-actor roster -- SINGLE SOURCE OF TRUTH.
//
// KIRA / YUZU are OXXOVO's own marketing/demo actor identities (a showcase pair),
// DISTINCT from a participant's freely-named character. The names are pending
// variety/trademark clearance + HQ alignment (YUZU especially may still change),
// so every UI string and demo label MUST reference these constants -- never a
// hardcoded "KIRA"/"YUZU" literal -- so a cleared/renamed actor is a one-line
// swap here that propagates everywhere. Plain module (no server-only): client
// components (ActorMode) import it directly.
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
