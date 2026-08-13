// Test-only module resolve hook: stub `server-only` (a Next.js bundler marker
// that is not resolvable from a plain `node --test` process) to an empty module.
// Used by scripts/test-register.mjs. Test infra only -- never imported by the app.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export{}', shortCircuit: true }
  }
  // `next/cache` is part of the Next server runtime and does not resolve here.
  // lib/watch.ts wraps the public list in unstable_cache, so without this a
  // harness cannot call the read path a participant actually gets -- it would be
  // left checking the watch_hold column by hand, which is not the same claim.
  if (specifier === 'next/cache') {
    return { url: new URL('./next-cache-stub.mjs', import.meta.url).href, shortCircuit: true }
  }
  // `next/headers` (lib/supabase-server.ts's cookie-based client) does not
  // resolve here either. lib/studio.ts importing checkApplyGate
  // (2026-08-12) pulled lib/membership.ts -> lib/user-auth.ts -> next/headers
  // into the graph of any test that reaches lib/studio.ts at all (e.g.
  // lib/dst-boundaries.test.ts, via an EDL/keyframe helper it did not
  // previously need to load this far to get). The stub THROWS rather than
  // no-ops: nothing under test should ever actually call cookies() (every
  // gate function under test takes userId directly), so a call reaching this
  // stub is a real bug, not a state this harness silently tolerates.
  if (specifier === 'next/headers') {
    return {
      url:
        'data:text/javascript,' +
        encodeURIComponent(
          'export const cookies = () => { throw new Error("next/headers stubbed under node --test -- a code path called it that the test did not expect to reach a cookie-based client") };\n' +
            'export const headers = cookies;\n',
        ),
      shortCircuit: true,
    }
  }
  // Same 2026-08-12 chain, second hop: lib/membership.ts also imports
  // getPlatformConfigMap from lib/partners.ts, which imports
  // sendPartnerEligible from lib/email/send.tsx -- a .tsx (JSX) file node's
  // native type-stripping cannot transform at all, regardless of which
  // export is used. Stubbed the same way: throws if actually called (it
  // should never be, from a test).
  if (specifier === '@/lib/email/send' || specifier.endsWith('/lib/email/send.tsx')) {
    return {
      url:
        'data:text/javascript,' +
        encodeURIComponent(
          'const stub = (name) => (...args) => { throw new Error(`lib/email/send stubbed under node --test -- ${name} must not be called from a test`) };\n' +
            'export const sendPartnerEligible = stub("sendPartnerEligible");\n',
        ),
      shortCircuit: true,
    }
  }
  // The `@/` path alias (tsconfig paths -> repo root) is a bundler feature; node
  // sees it as a bare package name and fails. Map it to the repo root, which is
  // this file's parent directory. Without this, any module under test that
  // reaches a dependency through the alias is untestable -- lib/pricing-health.ts
  // imports lib/music-gen.ts, which uses the alias throughout.
  if (specifier.startsWith('@/')) {
    const base = new URL('../' + specifier.slice(2), import.meta.url).href
    for (const candidate of [base + '.ts', base + '.tsx', base]) {
      try {
        return await nextResolve(candidate, context)
      } catch {
        /* try the next form */
      }
    }
  }
  // App code uses extensionless relative imports (bundler resolution). Under
  // `node --test` (native type strip) those need an explicit .ts -- append it.
  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context)
    } catch {
      /* fall through to default resolution */
    }
  }
  return nextResolve(specifier, context)
}
