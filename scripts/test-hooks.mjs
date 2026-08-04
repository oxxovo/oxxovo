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
