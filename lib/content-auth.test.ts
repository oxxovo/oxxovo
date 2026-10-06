import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSource, secretEnvName } from './content-auth'

const NEWS = 'n'.repeat(40)
const PROD = 'p'.repeat(40)
const env = {
  CONTENT_IMPORT_SECRET_NEWS_DESK: NEWS,
  CONTENT_IMPORT_SECRET_PRODUCTION_OS: PROD,
}

test('env names are computed from the source', () => {
  assert.equal(secretEnvName('news_desk'), 'CONTENT_IMPORT_SECRET_NEWS_DESK')
  assert.equal(secretEnvName('production_os'), 'CONTENT_IMPORT_SECRET_PRODUCTION_OS')
})

test('each secret resolves to its own source', () => {
  assert.equal(resolveSource(`Bearer ${NEWS}`, env), 'news_desk')
  assert.equal(resolveSource(`Bearer ${PROD}`, env), 'production_os')
})

test('wrong, missing, malformed -> null', () => {
  assert.equal(resolveSource(`Bearer ${'x'.repeat(40)}`, env), null)
  assert.equal(resolveSource(null, env), null)
  assert.equal(resolveSource('', env), null)
  assert.equal(resolveSource(NEWS, env), null) // no scheme
  assert.equal(resolveSource(`Basic ${NEWS}`, env), null)
  assert.equal(resolveSource(`Bearer ${NEWS} extra`, env), null)
  assert.equal(resolveSource(`Bearer ${NEWS.slice(0, -1)}`, env), null) // prefix
  assert.equal(resolveSource(`Bearer ${NEWS}x`, env), null) // longer
})

test('FAIL-CLOSED: unset, empty or short secret never matches (the control for the cases above)', () => {
  // Same presented values as the passing cases, but the env is not configured.
  assert.equal(resolveSource(`Bearer ${NEWS}`, {}), null)
  assert.equal(resolveSource(`Bearer ${NEWS}`, { CONTENT_IMPORT_SECRET_NEWS_DESK: '' }), null)
  const short = 'short-secret'
  assert.equal(resolveSource(`Bearer ${short}`, { CONTENT_IMPORT_SECRET_NEWS_DESK: short }), null)
  // Empty env + "Bearer " must not match an empty secret.
  assert.equal(resolveSource('Bearer ', { CONTENT_IMPORT_SECRET_NEWS_DESK: '' }), null)
})

test('one source unconfigured does not disable the other', () => {
  assert.equal(resolveSource(`Bearer ${PROD}`, { CONTENT_IMPORT_SECRET_PRODUCTION_OS: PROD }), 'production_os')
  assert.equal(resolveSource(`Bearer ${NEWS}`, { CONTENT_IMPORT_SECRET_PRODUCTION_OS: PROD }), null)
})

test('the same secret configured for both sources is refused, not resolved to either', () => {
  const same = 's'.repeat(40)
  assert.equal(resolveSource(`Bearer ${same}`, { CONTENT_IMPORT_SECRET_NEWS_DESK: same, CONTENT_IMPORT_SECRET_PRODUCTION_OS: same }), null)
})
