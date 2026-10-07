// Every user-facing string of the public content pages, in ONE place so the
// wording can be replaced without touching the pages.
//
// ★TEMPORARY neutral English (HQ 2026-10-07). These pages answer 404 until a
// content_path_<kind> slug AND the DBA's publication switch exist, so nothing
// here is visible yet. Final wording is a PRE-OPEN CHECKLIST item (design doc,
// SS7-3): the switch must not be turned on while this file still holds
// placeholders. Not mine to write (Jenny3 owns user-facing copy).
export const PUBLIC_TEXT = {
  aiGenerated: 'AI-generated', // platform-specific disclosure wording: Jenny3
  emptyList: 'Nothing here yet.',
  back: 'Back',
  videoUnavailable: 'Video unavailable.',
  published: 'Published',
} as const
