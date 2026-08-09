#!/usr/bin/env node
/**
 * The app's grid vocabulary must equal the worker's. CROSS-REPO, read-only.
 *
 * ★WHY IT EXISTS. The keys are stored by the worker (from
 * oxxovo-studio/assets/music-grid.json) and rendered by the app (from
 * lib/music-grid-labels.ts). Two copies of one vocabulary is a thing that goes stale,
 * and the way it goes stale is silent: add a genre on the worker side and load 100
 * tracks with it, and the picker renders the raw key `synthwave` to a Korean
 * participant, offers no chip for it, and nothing errors. Remove one and the reverse.
 *
 * ★NOT IN `npm test`, deliberately. CI has no worker checkout (the workflow runs tsc /
 * npm test / build only), so this would fail there for a reason that has nothing to do
 * with the change under test. Same placement as test:kat, and the same resolver
 * (scripts/worker-repo.mjs) so a lane compares against ITS OWN worker tree rather than
 * another lane's mirror.
 *
 * Writes: ZERO. Two files are read.
 *
 *   npm run test:music-grid-parity
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { resolveWorkerRepo } from '../scripts/worker-repo.mjs'
import {
  MUSIC_GENRE_KEYS,
  MUSIC_MOOD_KEYS,
  TEMPO_BUCKET_EDGES_BPM,
} from '../lib/music-grid-labels.ts'

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_ROOT = resolveWorkerRepo(APP_ROOT)
const GRID_PATH = join(WORKER_ROOT, 'assets', 'music-grid.json')

let pass = 0
let fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

console.log(`app   : ${APP_ROOT}`)
console.log(`worker: ${WORKER_ROOT}`)

// ★Control first, the same one test:kat makes: if the resolver ever pointed back at this
// repo, every comparison below would be this file against itself and would pass
// vacuously.
if (WORKER_ROOT === APP_ROOT || !WORKER_ROOT.includes('oxxovo-studio')) {
  console.error(`\n★the worker path did not resolve to a worker repo: ${WORKER_ROOT}`)
  console.error('  set WORKER_REPO, or check scripts/worker-repo.mjs')
  process.exit(2)
}
if (!existsSync(GRID_PATH)) {
  console.error(`\n★no vocabulary file at ${GRID_PATH}`)
  console.error('  this check needs a worker checkout; it is not part of `npm test` for that reason.')
  process.exit(2)
}

const worker = JSON.parse(readFileSync(GRID_PATH, 'utf8'))

const cmp = (name, appKeys, workerKeys) => {
  const a = [...appKeys]
  const w = (workerKeys ?? []).map((s) => String(s))
  const missingInApp = w.filter((k) => !a.includes(k))
  const missingInWorker = a.filter((k) => !w.includes(k))
  ok(
    missingInApp.length === 0,
    `every worker ${name} has an app label${missingInApp.length ? ` -- MISSING: ${missingInApp.join(', ')}` : ''}`,
  )
  ok(
    missingInWorker.length === 0,
    `every app ${name} exists in the worker vocabulary${missingInWorker.length ? ` -- EXTRA: ${missingInWorker.join(', ')}` : ''}`,
  )
  // ★Order too: the app renders chips in its own array order, and the worker file is
  // the document 제니3 approved. Divergent order is not a bug today, but a silent
  // reorder is how "the approved list" stops meaning anything.
  ok(a.join(',') === w.join(','), `${name} order matches the approved file`)
}

console.log('\n1. axis values')
cmp('genre', MUSIC_GENRE_KEYS, worker.genre)
cmp('mood', MUSIC_MOOD_KEYS, worker.mood)

console.log('\n2. counts (the approved 10 x 8 = 80 cells)')
ok((worker.genre ?? []).length === 10, `worker genre count is 10 [${(worker.genre ?? []).length}]`)
ok((worker.mood ?? []).length === 8, `worker mood count is 8 [${(worker.mood ?? []).length}]`)
ok(
  (worker.genre ?? []).length * (worker.mood ?? []).length === 80,
  `cells = ${(worker.genre ?? []).length * (worker.mood ?? []).length}`,
)

console.log('\n3. tempo buckets (the app derives a bucket the worker must agree with)')
ok(
  JSON.stringify([...TEMPO_BUCKET_EDGES_BPM]) === JSON.stringify(worker.tempoBucketsBpm ?? []),
  `edges match [app ${JSON.stringify([...TEMPO_BUCKET_EDGES_BPM])} vs worker ${JSON.stringify(worker.tempoBucketsBpm)}]`,
)

console.log(`\n== music grid parity: ${pass} pass, ${fail} fail ==`)
console.log('Writes performed: 0')
process.exit(fail ? 1 : 0)
