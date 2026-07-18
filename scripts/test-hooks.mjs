// Test-only module resolve hook: stub `server-only` (a Next.js bundler marker
// that is not resolvable from a plain `node --test` process) to an empty module.
// Used by scripts/test-register.mjs. Test infra only -- never imported by the app.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export{}', shortCircuit: true }
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
