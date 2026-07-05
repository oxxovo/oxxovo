// Dashboard -- run this between every rehearsal step to see season_test state.
//   node --env-file=.env.local scripts/rehearsal-status.mjs
import { admin, printState } from './rehearsal-lib.mjs'
await printState(admin())
process.exit(0)
