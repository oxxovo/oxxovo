// Resolve the worker repo (oxxovo-studio) that pairs with THIS app checkout.
//
// ★ LANE-AWARE. The app and the worker live as sibling git worktrees, and a lane
// suffixes BOTH of them:
//     C:\Users\Tom\oxxovo          <-> C:\Users\Tom\oxxovo-studio
//     C:\Users\Tom\oxxovo-lane-c   <-> C:\Users\Tom\oxxovo-studio-lane-c
// So the sibling name is this repo's own directory name with '-studio' inserted
// after the 'oxxovo' prefix. A hard-coded '../oxxovo-studio' made a lane measure
// ANOTHER lane's worker mirror -- the numbers looked fine because the mirrors
// happened to be identical, which is exactly how that kind of bug survives.
//
// WORKER_REPO env overrides for any other layout (CI, a plain clone pair).

import { basename, join } from 'node:path'

export function resolveWorkerRepo(appRoot) {
  return process.env.WORKER_REPO || join(appRoot, '..', basename(appRoot).replace(/^oxxovo/, 'oxxovo-studio'))
}
