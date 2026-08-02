#!/usr/bin/env node
/**
 * R2 orphan sweep -- delete render artifacts whose render_jobs row is gone.
 *
 * ★WHY THIS EXISTS. Every harness that exercises the compose path creates real
 * renders, and the deployed worker really renders them: it writes an mp4 (and a
 * poster) to R2 and then the harness deletes the ROW. The file stays. Rows are
 * cheap to clean up inside a `finally`; objects are not, because the harness
 * process has no R2 credentials -- so they accumulate, and "we will tidy that
 * later" is how a bucket becomes unauditable.
 *
 * ★THE RULE IT ENFORCES: an object whose id appears in NONE of render_jobs,
 * generation_jobs or genesis_applications is an orphan. If any row exists the
 * object is live and is never touched -- so a participant's submitted final
 * cannot be deleted by this script, because the finalized row is exactly what
 * keeps it. All three are checked because the bucket mixes key schemes:
 * `renders/` is keyed by render id, `seasons/` and `images/` by generation job
 * id, and `posters/` by a render id OR an application id.
 *
 * DRY RUN BY DEFAULT. It prints what it would delete and exits; `--delete` is the
 * only thing that removes anything.
 *
 *   npm run r2:orphans                       -- survey renders/ (dry run)
 *   npm run r2:orphans -- --prefix=posters/   -- any other prefix
 *   npm run r2:orphans -- --delete --owner=<uid> [--only-allowed]
 *
 * Flags: --delete does the removal; --owner=<uid> (repeatable) is the allowlist
 * and is REQUIRED unless --any-owner; --only-allowed deletes just the allowlisted
 * subset and reports the rest instead of refusing the whole run.
 *
 * The R2 credentials live in the worker's .env (the app never needs them at
 * runtime), and so does the S3 client -- this script borrows both from the
 * sibling checkout rather than adding a dependency the app does not otherwise
 * have. Nothing here prints a secret.
 */
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { resolveWorkerRepo } from './worker-repo.mjs'

const args = process.argv.slice(2)
const DO_DELETE = args.includes('--delete')
const PREFIX = (args.find((a) => a.startsWith('--prefix=')) ?? '--prefix=renders/').split('=')[1]

const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
const missing = need.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`missing ${missing.join(', ')} -- pass the worker env too:\n` +
    '  node --env-file=.env.local --env-file=../oxxovo-studio/.env scripts/r2-orphan-sweep.mjs')
  process.exit(1)
}

const workerRepo = resolveWorkerRepo(process.cwd())
const req = createRequire(pathToFileURL(join(workerRepo, 'package.json')).href)
let S3Client, ListObjectsV2Command, DeleteObjectsCommand
try {
  ({ S3Client, ListObjectsV2Command, DeleteObjectsCommand } =
    await import(pathToFileURL(req.resolve('@aws-sdk/client-s3')).href))
} catch (e) {
  console.error(`could not load @aws-sdk/client-s3 from ${workerRepo}: ${e.message}`)
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
const BUCKET = process.env.R2_BUCKET
// process.exit() with the S3 client's sockets still open trips a libuv assertion
// on Windows; close it and let the event loop drain instead.
function done(code) { process.exitCode = code; s3.destroy() }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 1. every object under the prefix ────────────────────────────────────────
const objects = []
let token
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }))
  for (const o of page.Contents ?? []) objects.push({ key: o.Key, size: Number(o.Size ?? 0), at: o.LastModified })
  token = page.IsTruncated ? page.NextContinuationToken : undefined
} while (token)

// ── 2. the render id each one belongs to ────────────────────────────────────
// Keys are renders/<season>/<uid>/<renderId>-<claimToken>.<ext>; the render id is
// the first UUID in the FILE NAME (the season and uid segments are not UUIDs, but
// a key shape we do not recognise is reported and never deleted).
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const unparsed = []
const byRender = new Map()
for (const o of objects) {
  const file = o.key.split('/').pop() ?? ''
  const m = file.match(UUID)
  if (!m) { unparsed.push(o); continue }
  const id = m[0].toLowerCase()
  if (!byRender.has(id)) byRender.set(id, [])
  byRender.get(id).push(o)
}

// ── 3. which of those rows still exist ──────────────────────────────────────
// ★ALL THREE TABLES, always. The bucket mixes key schemes and each one belongs to
// a different table: `renders/` is keyed by render id, `seasons/` and `images/` by
// GENERATION job id, and `posters/` by either a render id or an APPLICATION id
// (`posters/<applicationId>.jpg` is an entry's poster on /watch). Measured while
// writing this: with render_jobs alone, --prefix=seasons/ called 37 live clips
// "orphans", and the top-level posters of real season_test entries came up as
// orphans too. Anything found in ANY of the three keeps its object.
// ★Fail closed. If a lookup errors the run stops rather than guessing: deleting
// on the strength of a failed query is the wrong direction to be wrong in.
const ids = [...byRender.keys()]
const live = new Set()
for (const table of ['render_jobs', 'generation_jobs', 'genesis_applications']) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await admin.from(table).select('id').in('id', chunk)
    if (error) {
      console.error(`${table} lookup failed (${error.message}) -- nothing deleted`)
      done(1)
      process.exit(1)
    }
    for (const r of data ?? []) live.add(String(r.id).toLowerCase())
  }
}

const orphanKeys = []
let orphanBytes = 0
let liveBytes = 0, liveCount = 0
for (const [id, objs] of byRender) {
  if (live.has(id)) { liveCount += objs.length; for (const o of objs) liveBytes += o.size; continue }
  for (const o of objs) { orphanKeys.push(o.key); orphanBytes += o.size }
}
const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB'

// ★WHOSE orphans they are, before deleting any of them. A harness leaves objects
// under its own fixture seasons and the demo account; anything else showing up
// here is a real participant's file whose row went missing, which is a different
// problem and not one to answer with a delete.
function ownerOf(key) {
  const parts = key.split('/')
  return `${parts[1] ?? '?'} / ${parts[2] ?? '?'}`
}

console.log(`bucket ${BUCKET} | prefix ${PREFIX}`)
console.log(`  objects        ${objects.length}`)
console.log(`  ids            ${byRender.size} (${live.size} still have a row in one of the three tables)`)
console.log(`  live objects   ${liveCount} (${mb(liveBytes)}) -- never touched`)
console.log(`  ORPHANS        ${orphanKeys.length} (${mb(orphanBytes)})`)
const owners = new Map()
for (const k of orphanKeys) owners.set(ownerOf(k), (owners.get(ownerOf(k)) ?? 0) + 1)
for (const [owner, n] of [...owners].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(n).padStart(4)}  ${owner}`)
}
if (unparsed.length) {
  console.log(`  unrecognised   ${unparsed.length} -- reported, never deleted:`)
  for (const o of unparsed.slice(0, 10)) console.log(`      ${o.key}`)
  if (unparsed.length > 10) console.log(`      … and ${unparsed.length - 10} more`)
}

// ★An owner allowlist is required before anything is deleted: --owner=<uid>
// (repeatable) or --any-owner. Without it the script reports and stops, so a
// stranger's orphan can never be swept up by a run aimed at the harness's own
// leftovers. An orphan under an account nobody named is a different problem
// (a row went missing under a real participant) and a delete is the wrong answer.
// --only-allowed narrows the delete set to the allowlisted owners and REPORTS the
// rest instead of refusing: "I removed my own leftovers, and here is what else is
// lying around that is not mine to decide about."
const allowedOwners = args.filter((a) => a.startsWith('--owner=')).map((a) => a.split('=')[1])
const anyOwner = args.includes('--any-owner')
const onlyAllowed = args.includes('--only-allowed')
const isAllowed = (k) => allowedOwners.some((o) => o && k.includes(o))
const foreign = anyOwner ? [] : orphanKeys.filter((k) => !isAllowed(k))
if (onlyAllowed && !anyOwner && foreign.length) {
  console.log(`\n--only-allowed: ${foreign.length} orphan(s) belong to someone else and are LEFT ALONE:`)
  const others = new Map()
  for (const k of foreign) others.set(ownerOf(k), (others.get(ownerOf(k)) ?? 0) + 1)
  for (const [owner, n] of [...others].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${owner}`)
  for (let i = orphanKeys.length - 1; i >= 0; i--) if (!isAllowed(orphanKeys[i])) orphanKeys.splice(i, 1)
  // Re-total the bytes against what is actually going to be deleted -- reporting
  // the pre-filter figure would overstate every run of this flag.
  const kept = new Set(orphanKeys)
  orphanBytes = 0
  for (const [, objs] of byRender) for (const o of objs) if (kept.has(o.key)) orphanBytes += o.size
  foreign.length = 0
}

if (!orphanKeys.length) {
  console.log('\nnothing to delete')
  done(0)
} else if (!DO_DELETE) {
  console.log('\nDRY RUN -- nothing deleted. Re-run with --delete and --owner=<uid> (or --any-owner). First few:')
  for (const k of orphanKeys.slice(0, 15)) console.log(`  ${k}`)
  if (orphanKeys.length > 15) console.log(`  … and ${orphanKeys.length - 15} more`)
  done(0)
} else if (foreign.length) {
  console.log(`\n★REFUSING: ${foreign.length} orphan(s) belong to no allowed owner. Add --owner=<uid> or --any-owner.`)
  for (const k of foreign.slice(0, 10)) console.log(`  ${k}`)
  done(1)
} else {
  await sweep()
}

// ── 4. delete, then LIST AGAIN and report what is actually gone ─────────────
async function sweep() {
  let deleted = 0
  const failures = []
  for (let i = 0; i < orphanKeys.length; i += 1000) {
    const batch = orphanKeys.slice(i, i + 1000)
    const res = await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
    }))
    deleted += batch.length - (res.Errors?.length ?? 0)
    for (const e of res.Errors ?? []) failures.push(`${e.Key}: ${e.Message}`)
  }
  // The delete response is a claim; the listing is the evidence.
  const stillThere = new Set()
  let t2
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: t2 }))
    for (const o of page.Contents ?? []) stillThere.add(o.Key)
    t2 = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (t2)
  const remaining = orphanKeys.filter((k) => stillThere.has(k))

  console.log(`\ndeleted ${deleted} object(s) (${mb(orphanBytes)})`)
  console.log(`re-listed: ${stillThere.size} object(s) under ${PREFIX}; ${remaining.length} of the orphans remain`)
  if (failures.length) {
    console.log(`★${failures.length} delete error(s):`)
    for (const f of failures.slice(0, 10)) console.log(`  ${f}`)
  }
  done(remaining.length || failures.length ? 1 : 0)
}
