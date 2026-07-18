// Test-only module resolve hook: stub `server-only` (a Next.js bundler marker
// that is not resolvable from a plain `node --test` process) to an empty module.
// Used by scripts/test-register.mjs. Test infra only -- never imported by the app.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export{}', shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
