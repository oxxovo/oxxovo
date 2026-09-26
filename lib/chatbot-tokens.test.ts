// Phase 0 chatbot fix (HQ 2026-09-27): ChatbotTokenContext.season went from
// Season to Season | null so loadChatbotContext() no longer has to throw when
// nothing is currently scheduled. Two things must both hold:
//   1. season=null -> season-derived tokens read as "not available", the same
//      marker an unrevealed/absent field already renders as -- no crash, no
//      fabricated fact.
//   2. season=<a real, fully-populated season> -> byte-identical output to
//      before this change (the edit was `season.x` -> `season?.x` throughout,
//      which is a no-op when season is not null).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveChatbotDocument, type ChatbotTokenContext } from './chatbot-tokens.ts'
import type { Season } from './seasons.ts'

const NOW = new Date('2026-09-27T00:00:00Z')

const FAKE_SEASON = {
  application_open_at: '2026-10-15T00:00:00Z',
  registration_close_at: '2026-11-02T01:00:00Z',
  application_close_at: '2026-11-05T01:00:00Z',
  prelim_results_announcement_at: '2026-11-09T01:00:00Z',
  main_round_start_at: '2026-11-10T01:00:00Z',
  community_vote_start_at: '2026-11-14T01:00:00Z',
  community_vote_end_at: '2026-11-17T01:00:00Z',
  awards_announcement_at: '2026-11-19T01:00:00Z',
  total_prize_pool: 2000,
  prize_first: 1200,
  prize_second: 500,
  prize_third: 300,
  application_video_min_seconds: 15,
  application_video_max_seconds: 30,
  main_round_video_min_seconds: 35,
  main_round_video_max_seconds: 40,
  aspect_ratio: '9:16',
  scoring_intent_clarity_weight: 0.3,
  scoring_execution_weight: 0.45,
  scoring_originality_weight: 0.25,
  min_participants: 100,
  max_defer_count: 3,
  absolute_min_participants: 80,
  scoring_complete_at: null,
  top_n_advance: 50,
  advance_pct: 0.1,
  advance_min: 10,
  advance_max: 50,
} as unknown as Season

const BASE_CTX: Omit<ChatbotTokenContext, 'season'> = {
  membership: { price: 19.99, interval: 'month', founding: { cap: 100 } },
  championshipRevealAt: null,
  revealedTheme: { prelimTheme: null, mainTheme: null, twist: null, twistRevealed: false },
  now: NOW,
}

const DOC = '{{application_open}} / {{prize_pool}} / {{video_length_range}} / {{advance_label}} / {{membership_price}} / {{now}}'

test('★no season scheduled: season tokens read as "not available", non-season tokens still resolve', () => {
  const out = resolveChatbotDocument(DOC, { ...BASE_CTX, season: null })
  assert.match(out, /\(not available -- do not guess\)/, 'a season-derived token must not crash or fabricate a value')
  assert.doesNotMatch(out, /undefined|NaN|null/, 'no raw JS null/undefined/NaN should ever reach the model')
  // Non-season facts are completely unaffected by season being null.
  assert.match(out, /\$19\.99\/month/)
})

test('a real, fully-scheduled season resolves every token to a real value (unchanged from before this fix)', () => {
  const out = resolveChatbotDocument(DOC, { ...BASE_CTX, season: FAKE_SEASON })
  assert.doesNotMatch(out, /not available/, 'a populated season must not show the absent-token marker anywhere')
  assert.match(out, /15–30 seconds/)
  assert.match(out, /\$2,000/)
  assert.match(out, /top 10% \(10–50\)/) // scoring_complete_at is null -> not yet decided -> policy label, unchanged behavior
})
