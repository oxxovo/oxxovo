// Post-deploy verification: does www.oxxovo.ai serve the build we just shipped?
//
// ★Why it checks www and not the deployment URL: the *.vercel.app URL sits behind
// Deployment Protection, so it answers with an HTML login page, never JSON. Every
// deploy printed "Could not verify automatically" -- a warning that is always there
// cannot be told apart from a real failure, i.e. it verified nothing. www is what
// people actually get, and it has no wall.
//
// ★The one rule that matters: an OLD sha is a reason to retry, never a pass. Between
// the deploy finishing and the alias moving, www still serves the previous build;
// reading that as success is a false pass, worse than the old warning. A pass needs
// sha (and, when known, builtAt) to match exactly. builtAt also separates "same
// commit deployed again" from "the build I just made".
//
// Pure + injected fetch/sleep so it is testable without a network. The CLI at the
// bottom re-verifies a deploy without redeploying:
//   node scripts/deploy-verify.mjs <sha> [builtAt]
import { pathToFileURL } from 'node:url'

export const LIVE_BASE = 'https://www.oxxovo.ai'
// 12 x 5s. Measured: the alias is assigned 0.25-0.45s after the deployment is ready
// (15 production deploys, 2026-10-02..07). Edge propagation after that is NOT
// measurable from deployment records, so the window is deliberately generous; a false
// failure costs one re-run of the verify command, a false pass costs a wrong belief.
export const ATTEMPTS = 12
export const DELAY_MS = 5000
const FETCH_TIMEOUT_MS = 8000

// kind: match | stale | html | http | badjson | network
export function classifyVersionResponse({ status, contentType, text }, expected) {
  const t = (text ?? '').trim()
  if ((contentType ?? '').toLowerCase().includes('text/html') || t.startsWith('<')) {
    return { kind: 'html', detail: `HTTP ${status}, an HTML page instead of JSON` }
  }
  if (status !== 200) return { kind: 'http', detail: `HTTP ${status}` }
  let body
  try {
    body = JSON.parse(t)
  } catch {
    return { kind: 'badjson', detail: 'response is not valid JSON' }
  }
  if (!body || typeof body.sha !== 'string') {
    return { kind: 'badjson', detail: `no sha field: ${t.slice(0, 120)}` }
  }
  if (body.sha !== expected.sha) {
    return { kind: 'stale', detail: `serving sha=${body.sha}, expected sha=${expected.sha}`, body }
  }
  if (expected.builtAt && body.builtAt !== expected.builtAt) {
    return {
      kind: 'stale',
      detail: `same sha=${body.sha} but builtAt=${body.builtAt}, expected ${expected.builtAt} (an earlier build of this commit)`,
      body,
    }
  }
  return { kind: 'match', detail: `sha=${body.sha} builtAt=${body.builtAt}`, body }
}

async function fetchOnce(url, expected, fetchImpl) {
  try {
    const res = await fetchImpl(`${url}/api/version?v=${Date.now()}`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const text = await res.text()
    return classifyVersionResponse({ status: res.status, contentType: res.headers.get('content-type'), text }, expected)
  } catch (e) {
    return { kind: 'network', detail: e instanceof Error ? e.message : String(e) }
  }
}

// -> { ok: true, attempts, result } | { ok: false, attempts, last }
export async function verifyLive({
  sha,
  builtAt,
  base = LIVE_BASE,
  attempts = ATTEMPTS,
  delayMs = DELAY_MS,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = () => {},
}) {
  let last = null
  for (let i = 1; i <= attempts; i++) {
    last = await fetchOnce(base, { sha, builtAt }, fetchImpl)
    if (last.kind === 'match') return { ok: true, attempts: i, result: last }
    log(`  try ${i}/${attempts}: ${last.kind} -- ${last.detail}`)
    if (i < attempts) await sleep(delayMs)
  }
  return { ok: false, attempts, last }
}

// One look at the deployment's own URL, only to explain a www failure.
export async function diagnoseDeployment({ url, sha, builtAt, fetchImpl = fetch }) {
  const r = await fetchOnce(url, { sha, builtAt }, fetchImpl)
  if (r.kind === 'html') {
    return 'the deployment URL is behind the Vercel auth wall (HTML, not JSON) -- expected, that is why verification runs on www. It tells us nothing about the build.'
  }
  if (r.kind === 'match') {
    return 'the deployment itself serves the right build, so the problem is the alias / propagation to www, not the build.'
  }
  if (r.kind === 'stale') {
    return `the deployment ITSELF serves the wrong build (${r.detail}) -- the stamp did not reach the build.`
  }
  return `the deployment URL gave ${r.kind} (${r.detail}) -- no diagnosis from it.`
}

// ---- CLI --------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sha, builtAt] = process.argv.slice(2)
  // ★exitCode, not process.exit(): on Windows, process.exit() while fetch sockets are
  // still closing aborts Node with a libuv assertion (exit 127) -- a PASS that reported
  // as a failure, measured 2026-10-07. Let the loop drain instead.
  if (!sha) {
    console.error('usage: node scripts/deploy-verify.mjs <sha> [builtAt]')
    process.exitCode = 2
  } else {
    console.error(`Verifying ${LIVE_BASE}/api/version for sha=${sha}${builtAt ? ` builtAt=${builtAt}` : ''} ...`)
    const v = await verifyLive({ sha, builtAt, log: (m) => console.error(m) })
    if (v.ok) {
      console.error(`✓ live version (try ${v.attempts}): ${v.result.detail}`)
    } else {
      console.error(`✖ NOT VERIFIED after ${v.attempts} tries -- ${v.last.kind}: ${v.last.detail}`)
      process.exitCode = 1
    }
  }
}
