// Disposable season fixture for harnesses that need to MOVE A CLOCK.
//
// ★Why this exists. A deadline test has to say "now it is before the close" and
// then "now it is after", which means writing to a season row. The two seasons a
// harness might reach for are both wrong for that:
//   season_0    is live -- applications have been open since 7/25 and production
//               reads those columns;
//   season_test is shared, and e2e/lib.mjs states the rule (TK 2026-07-14): the
//               harness never touches it.
// season_e2e (e2e/run.mjs) is the right idea but takes season_number 9999, which
// makes it the LATEST season -- and the tick's create-ahead clones the latest one
// once it has opened, so a long-lived 9999 invites a junk season_10000.
//
// So: a `zz_`-prefixed season of our own (C7 discipline), created and dropped by
// the harness, with a season_number BELOW the existing maximum so create-ahead
// never looks at it, and with its awards date in the past so desiredStatus() pins
// it at 'completed' -- the hourly production tick has nothing to do to it no
// matter where we put the application window.
//
// The clips are cloned from the template season's real ready clips (same R2 URLs,
// so the worker can actually render them) and RE-SIGNED for the new tournament id,
// because a CryptoBind is bound to its tid -- a copied signature would be refused,
// which is the point of the scheme.
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveWorkerRepo } from '../scripts/worker-repo.mjs'

const TEMPLATE = 'season_test'
// Below season_1006 (the current maximum), so the tick's create-ahead keeps
// looking at the same latest season it looks at today.
const ZZ_SEASON_NUMBER = 997

export async function createZzSeason(admin, id, schedule) {
  if (!id.startsWith('zz_')) throw new Error(`REFUSED: fixture season id must start with zz_ (got ${id})`)
  const { data: tmpl, error } = await admin.from('seasons').select('*').eq(   'id', TEMPLATE).single()
  if (error) throw new Error('template read failed: ' + error.message)
  const row = { ...tmpl }
  for (const generated of ['created_at', 'updated_at', 'prize_first', 'prize_second', 'prize_third']) delete row[generated]
  Object.assign(row, {
    id,
    season_number: ZZ_SEASON_NUMBER,
    name: 'zz-lane-a',
    display_name: '[LANE A] disposable fixture',
    // 'completed' + an awards date in the past == desiredStatus('completed'), so
    // the tick's forward-only transition is a no-op whatever the window says.
    status: 'completed',
    awards_announcement_at: new Date(Date.now() - 86_400_000).toISOString(),
    ...schedule,
  })
  const { error: insErr } = await admin.from('seasons').insert(row)
  if (insErr) throw new Error('fixture season insert failed: ' + insErr.message)
  return row
}

// Clone N ready video clips into the fixture season and re-sign them for it.
export async function mintClips(admin, seasonId, userId, n) {
  if (!seasonId.startsWith('zz_')) throw new Error('REFUSED: mintClips is for zz_ fixtures only')
  const secret = process.env.STUDIO_CRYPTOBIND_SECRET
  if (!secret) throw new Error('STUDIO_CRYPTOBIND_SECRET is not set -- the clips could not be signed')
  const { buildCryptoBind } = await import('../lib/cryptobind.ts')
  // The app has no v1c builder (the worker stamps content bindings in
  // production), so the real one is imported rather than reimplemented here.
  const { buildContentBind } = await import(
    pathToFileURL(join(resolveWorkerRepo(process.cwd()), 'src', 'cryptobind.ts')).href
  )

  const { data: pool, error } = await admin
    .from('generation_jobs')
    .select('*')
    .eq('season_id', TEMPLATE).eq('status', 'ready').eq('media_type', 'video')
    .is('deleted_at', null).neq('tier', 'draft')
    .not('video_url', 'is', null)
    .limit(n)
  if (error) throw new Error('clip pool read failed: ' + error.message)
  if (!pool?.length) throw new Error(`no ready clips in ${TEMPLATE} to clone`)

  const made = []
  for (let i = 0; i < n; i++) {
    const src = pool[i % pool.length]
    const row = { ...src }
    for (const generated of ['created_at', 'updated_at']) delete row[generated]
    const id = randomUUID()
    const generatedAt = new Date()
    Object.assign(row, {
      id,
      user_id: userId,
      season_id: seasonId,
      status: 'ready',
      submitted_at: null,
      // Clone as a plain t2v clip -- no parent chain to re-sign. The column is
      // NOT NULL with an empty-array default, so "no parents" is [] and not null.
      parent_image_job_ids: [],
      ...buildCryptoBind({
        jobId: id, pid: userId, tid: seasonId,
        modelId: src.model_id, durationSeconds: src.duration_seconds, generatedAt,
      }),
      ...(src.cryptobind_content_hash
        ? buildContentBind(secret, { jobId: id, tid: seasonId, contentHash: src.cryptobind_content_hash })
        : { cryptobind_content_hash: null, cryptobind_content_signature: null }),
      cryptobind_parent_bundle: null,
    })
    const { error: insErr } = await admin.from('generation_jobs').insert(row)
    if (insErr) throw new Error('clip insert failed: ' + insErr.message)
    made.push({ id, duration_seconds: src.duration_seconds, video_url: src.video_url })
  }
  return made
}

// Scoped teardown, and it reports what it deleted rather than claiming success.
export async function dropZzSeason(admin, id) {
  if (!id.startsWith('zz_')) throw new Error('REFUSED: dropZzSeason is for zz_ fixtures only')
  const counts = {}
  const { data: apps } = await admin.from('genesis_applications').select('id').eq('season_id', id)
  const appIds = (apps ?? []).map((a) => a.id)
  if (appIds.length) {
    for (const t of ['watch_votes', 'watch_likes', 'watch_comments', 'watch_views']) {
      await admin.from(t).delete().in('application_id', appIds)
    }
  }
  for (const [table, col] of [
    ['render_jobs', 'season_id'], ['genesis_applications', 'season_id'],
    ['generation_jobs', 'season_id'], ['seasons', 'id'],
  ]) {
    const { data } = await admin.from(table).delete().eq(col, id).select('id')
    counts[table] = data?.length ?? 0
  }
  const { data: leftoverSeason } = await admin.from('seasons').select('id').eq('id', id).maybeSingle()
  const { data: leftoverJobs } = await admin.from('generation_jobs').select('id').eq('season_id', id)
  counts.leftover = (leftoverSeason ? 1 : 0) + (leftoverJobs?.length ?? 0)
  return counts
}
