// Official OXXOVO AI-actor roster -- SINGLE SOURCE OF TRUTH.
//
// KIRA / ANNA / RIN are OXXOVO's own marketing/demo actor identities (a showcase
// trio), DISTINCT from a participant's freely-named character. Every UI string
// and demo label MUST reference these constants -- never a hardcoded name
// literal -- so a clearance rename is a one-line swap here that propagates
// everywhere. Plain module (no server-only): client components (ActorMode)
// import it directly.
//
// HQ, 2026-08-10: ANNA replaces YUZU (same anime slot; YUZU did not clear) and
// RIN (live-action) joins as the third seat. RIN is also onboarded in the
// service_role-only official_actors table under slug 'rin' (formerly
// 'actor-3-beauty-cf', see reports/hq_actor_slug_2026-08-08.sql), status
// 'draft' -- that row backs i2v reference images; this roster is the display
// layer and the two are not yet cross-linked by id. Exact look (hair/features)
// for ANNA and RIN is not established here -- descriptor stays at what HQ
// stated rather than inventing detail.
export type StudioActorKind = 'live' | 'anime'

export type StudioActor = {
  id: string
  name: string
  kind: StudioActorKind
  descriptor: string // brief look, for demo/marketing labels
}

export const STUDIO_ACTORS: readonly StudioActor[] = [
  { id: 'kira', name: 'KIRA', kind: 'live', descriptor: 'live-action, red hair' },
  { id: 'anna', name: 'ANNA', kind: 'anime', descriptor: 'anime' },
  { id: 'rin', name: 'RIN', kind: 'live', descriptor: 'live-action, CF' },
] as const

// Ordered official names, e.g. ['KIRA', 'ANNA', 'RIN'].
export const STUDIO_ACTOR_NAMES: readonly string[] = STUDIO_ACTORS.map((a) => a.name)

// Illustrative example text for the "name your character" placeholder, e.g.
// "KIRA, ANNA, RIN". One place feeds every "e.g. …" label.
export const STUDIO_ACTOR_EXAMPLES: string = STUDIO_ACTOR_NAMES.join(', ')
