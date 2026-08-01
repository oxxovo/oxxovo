// What is actually running in production.
//
// ★Why this exists: on 2026-07-30 we could not answer "which commit is live?" at all.
// `vercel inspect` carries no commit/branch/sha because a CLI directory upload ships
// no git metadata, and production had been a single 17-day-old deployment. The date
// happening to match main's HEAD was circumstantial, not evidence.
//
// ★force-static is load-bearing, not a performance choice. `vercel deploy
// --build-env BUILD_SHA=...` sets a BUILD-time variable; a dynamic route reads
// process.env at REQUEST time, where that variable does not exist and this would
// serve "unknown" forever. force-static evaluates the handler during the build, so
// the values are baked into the response. Measured, not assumed -- see the build
// output check in scripts/deploy-prod.mjs.
export const dynamic = 'force-static'

// Set by scripts/deploy-prod.mjs (npm run deploy:prod). VERCEL_GIT_* is the fallback
// for a git-triggered deploy; it is absent for the CLI uploads we actually use, which
// is precisely the gap this closes.
const sha = process.env.BUILD_SHA || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown'

export function GET() {
  return Response.json({
    // '<sha>' or '<sha>-dirty'. The suffix means the deploy carried uncommitted or
    // untracked files, so the commit alone does NOT describe what shipped.
    sha,
    dirty: sha.endsWith('-dirty'),
    // Build time, which for a CLI deploy is the deploy time to within a minute.
    // BUILD_TIME is passed explicitly; the fallback is evaluated during the build
    // because of force-static above.
    builtAt: process.env.BUILD_TIME || new Date().toISOString(),
  })
}
