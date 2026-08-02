// Placeholder example names for the participant's "name your character" field.
//
// ★THIS IS UI TEXT, NOT A ROSTER. It was previously lib/studio-actors.ts, named
// and shaped like OXXOVO's official actor list, and it is not that and never
// was. Measured 2026-08-02: the only thing any code ever imported from it was
// the joined example string, rendered into one input placeholder
// (app/studio/ActorMode.tsx). Nothing read the structure.
//
// ★OXXOVO's actual actors live in the `official_actors` table -- service_role
// only, anon read verified refused (HTTP 401 / 42501), currently one row, and
// no application code reads it yet. The two have never shared an id, a slug or
// a name, so a screen showing both would have shown two different casts. The
// old filename made that collision easy to walk into, especially next to a
// future lib/studio-official-actors.ts.
//
// So the shape was dropped along with the name. The old version carried
// `kind: 'live' | 'anime'` and a `descriptor` ("live-action, red hair") per
// entry -- fields that describe a CAST MEMBER. Placeholder text has no look and
// no medium; keeping those fields is what made this read as a roster.
//
// ★The values are unchanged and deliberately so: character naming sits with head
// office (it is on the pending-decisions sheet), and renaming a module is not
// licence to edit what it says.

/**
 * Example names offered to a participant naming their own character. One place
 * to edit, so every "e.g. ..." label moves together.
 */
export const CHARACTER_NAME_EXAMPLE_LIST: readonly string[] = ['KIRA', 'YUZU'] as const

/** The same list as one display string, e.g. "KIRA, YUZU". */
export const CHARACTER_NAME_EXAMPLES: string = CHARACTER_NAME_EXAMPLE_LIST.join(', ')
