// ★★★ THIS COMMAND IS THE LAUNCH. IT PUTS ~216 COMMITS ON www.oxxovo.ai. ★★★
//
// Production has been one deployment since 2026-07-13. There is no staged rollout and
// no auto-rollback: this replaces what participants see, in one step, immediately.
// Do NOT run it until E2E and the go-live checklist (reports/studio_go_live_checklist
// _2026-07.md, Phase C3) are done. To look without deploying, use `vercel deploy`
// WITHOUT `--prod`, which publishes a Preview URL only.
//
// Controlled production deploy. `npm run deploy:prod`
//
// The app has no git auto-deploy (vercel.json git.deploymentEnabled.main=false), so
// production only ever moves through this command. It exists because the manual form
// -- `vercel deploy --prod --build-env BUILD_SHA=$(git rev-parse --short HEAD)` --
// depends on a person remembering the SHA flag every time, and the one time it is
// forgotten is the deploy nobody can identify afterwards. A stamp that is optional in
// practice is not a stamp.
//
// ★Dirty-tree policy: REFUSE by default, `--allow-dirty` to override, and an override
// stamps `-dirty` into the SHA.
//
// Why not a plain suffix with no refusal: the suffix alone makes an unreproducible
// deploy feel routine. Why not a hard refusal with no escape: a hotfix during the
// tournament would then have to leave this script, and a bypassed guard records
// nothing at all -- which is the state we are trying to leave. Refusing by default
// makes clean the normal path; keeping the escape hatch INSIDE the tool means even
// the exception is recorded, in the deploy log and in /api/version.
//
// ★Untracked files are treated as dirty on purpose. `vercel deploy` uploads the
// working directory, not a commit, so an untracked file under public/ ships to
// production -- that is exactly how the reference mockups leaked on 2026-07-02. A
// clean `git status` is the only thing that makes "this deploy == this commit" true.

import { spawnSync } from 'node:child_process'

const allowDirty = process.argv.includes('--allow-dirty')

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(`git ${args.join(' ')} failed:\n${r.stderr}`)
    process.exit(1)
  }
  return r.stdout.trim()
}

const shaShort = git(['rev-parse', '--short', 'HEAD'])
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
const porcelain = git(['status', '--porcelain'])
const dirtyFiles = porcelain ? porcelain.split('\n').filter(Boolean) : []

if (dirtyFiles.length) {
  const untrackedPublic = dirtyFiles.filter((l) => l.startsWith('??') && l.includes('public/'))
  console.error(`\n★Working tree is not clean (${dirtyFiles.length} entries):\n`)
  for (const l of dirtyFiles.slice(0, 40)) console.error(`   ${l}`)
  if (dirtyFiles.length > 40) console.error(`   ... and ${dirtyFiles.length - 40} more`)
  if (untrackedPublic.length) {
    console.error(
      `\n★${untrackedPublic.length} untracked file(s) under public/ WOULD BE PUBLISHED.` +
        `\n vercel deploy uploads the working directory, not the commit.`,
    )
  }
  if (!allowDirty) {
    console.error(
      '\nRefusing to deploy. Commit or stash first -- then the deployed SHA actually' +
        '\ndescribes what shipped. To override (emergency only):' +
        '\n\n   npm run deploy:prod -- --allow-dirty' +
        '\n\nThe override stamps the version as "-dirty" so the record stays honest.\n',
    )
    process.exit(1)
  }
  console.error('\n--allow-dirty given: proceeding and stamping the version as -dirty.\n')
}

const buildSha = dirtyFiles.length ? `${shaShort}-dirty` : shaShort
const buildTime = new Date().toISOString()

// Unpushed commits are not a refusal (a deploy can legitimately precede a push) but
// they do mean nobody else can reconstruct this build from the remote, so say it.
const unpushed = spawnSync('git', ['log', '@{u}..HEAD', '--oneline'], { encoding: 'utf8' })
if (unpushed.status === 0 && unpushed.stdout.trim()) {
  const n = unpushed.stdout.trim().split('\n').length
  console.error(`★${n} commit(s) on ${branch} are not pushed. This SHA is not on the remote yet.\n`)
}

// The header warning is for whoever reads the file; this is for whoever runs it, which
// is the person who needs it. One line, above the deploy, in the place TK actually looks.
console.error('★ PRODUCTION DEPLOY -- this replaces www.oxxovo.ai for everyone, now.\n')
console.error(`Deploying ${branch} @ ${buildSha}  (built ${buildTime})\n`)

const res = spawnSync(
  'vercel',
  ['deploy', '--prod', '--build-env', `BUILD_SHA=${buildSha}`, '--build-env', `BUILD_TIME=${buildTime}`],
  { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8', shell: process.platform === 'win32' },
)
const out = (res.stdout ?? '').trim()
if (out) console.log(out)
if (res.status !== 0) process.exit(res.status ?? 1)

// ★Close the loop. A stamp nobody reads is not evidence, so verify the deployment
// serves the SHA we just built rather than trusting that it did.
const url = (out.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).pop()
if (!url) {
  console.error('\nCould not read the deployment URL from the CLI output.')
  console.error(`Check manually: <deployment>/api/version should report sha=${buildSha}`)
  process.exit(0)
}
console.error(`\nVerifying ${url}/api/version ...`)
try {
  const r = await fetch(`${url}/api/version`, { redirect: 'follow' })
  const body = await r.json()
  if (body.sha === buildSha) {
    console.error(`✓ live version: ${JSON.stringify(body)}`)
  } else {
    console.error(`✖ MISMATCH -- expected sha=${buildSha}, got ${JSON.stringify(body)}`)
    console.error('  The stamp did not reach the build. Do not treat this deploy as identified.')
    process.exit(1)
  }
} catch (e) {
  // Deployment protection (SSO) returns an auth page rather than JSON. Not a failure
  // of the deploy -- but it is not a verification either, so say which one it is.
  console.error(`Could not verify automatically (${e instanceof Error ? e.message : String(e)}).`)
  console.error(`Open ${url}/api/version in a browser -- it should report sha=${buildSha}`)
}
