// Registers the test-only resolve hooks (stubs `server-only`). Loaded via
// `node --import ./scripts/test-register.mjs`. Test infra only.
import { register } from 'node:module'
register('./test-hooks.mjs', import.meta.url)
