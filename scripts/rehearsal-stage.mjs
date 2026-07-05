// Drive season_test through one pipeline phase: set the relevant seasons dates,
// then ping the REAL season-tick cron (idempotent) so the actual production
// automation applies the transition. Run the dashboard after to verify.
//   node --env-file=.env.local scripts/rehearsal-stage.mjs <phase>
// phases (run in order): open close advance main-open main-close vote awards
//
// WINDOW (minutes) for still-open windows: REHEARSAL_WINDOW (default 10).
import { admin, SEASON, iso, printState, pingCron } from './rehearsal-lib.mjs'

const phase = process.argv[2]
const W = parseInt(process.env.REHEARSAL_WINDOW ?? '10', 10)

const PHASES = {
  open:       { application_open_at: iso(-2), application_close_at: iso(W) },        // prelim accepting; LIVE + countdown
  close:      { application_close_at: iso(-1) },                                     // -> active->closed  [then RUN PRELIM WORKER]
  advance:    { scoring_complete_at: iso(-1) },                                      // -> advance_season_finalists  [prelim worker MUST be done]
  'main-open':{ main_round_start_at: iso(-1), main_round_end_at: iso(W) },           // main submission window open  [then submit-main]
  'main-close':{ main_round_end_at: iso(-1) },                                       // -> main worker gate opens  [then RUN MAIN WORKER]
  vote:       { community_vote_start_at: iso(-1), community_vote_end_at: iso(W) },    // voting open  [then seed-votes]
  awards:     { awards_announcement_at: iso(-1) },                                   // -> closed->completed  [then approve-awards]
}

const PRECOND = {
  advance: 'PRELIM worker must have finished (all 20 scored, no in-progress, no flagged) BEFORE this.',
  'main-close': 'submit-main must have run so finalists are main_round_submitted.',
}

if (!phase || !PHASES[phase]) {
  console.error('usage: rehearsal-stage.mjs <' + Object.keys(PHASES).join('|') + '>')
  process.exit(1)
}
if (PRECOND[phase]) console.log(`!! precondition: ${PRECOND[phase]}`)

const db = admin()
const { error } = await db.from('seasons').update({ ...PHASES[phase], updated_at: new Date().toISOString() }).eq('id', SEASON)
if (error) { console.error(`set ${phase} failed:`, error.message); process.exit(1) }
console.log(`set ${phase}: ${JSON.stringify(PHASES[phase])}`)

await pingCron()
await printState(db)
process.exit(0)
