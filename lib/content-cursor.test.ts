import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeCursor, encodeCursor } from './content-cursor'

const ID = '3f2b8c1e-5a47-4d9e-9c0a-1b2c3d4e5f60'

test('round-trips, keeping microsecond precision exactly', () => {
  const c = { t: '2026-10-05T01:02:03.123456+00:00', id: ID }
  assert.deepEqual(decodeCursor(encodeCursor(c)), c)
})

test('malformed input is null, never throws', () => {
  for (const raw of ['', '!!!', 'a'.repeat(300), Buffer.from('not json').toString('base64url'), Buffer.from('[]').toString('base64url'), Buffer.from('null').toString('base64url')]) {
    assert.equal(decodeCursor(raw), null, raw.slice(0, 20))
  }
})

test('bad fields inside valid JSON are rejected (this cursor ends up inside a PostgREST filter)', () => {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  assert.equal(decodeCursor(enc({ t: 'yesterday', id: ID })), null)
  assert.equal(decodeCursor(enc({ t: '2026-10-05T01:02:03Z', id: 'x' })), null)
  assert.equal(decodeCursor(enc({ t: '2026-10-05T01:02:03Z),id.gt.0,(x', id: ID })), null) // filter injection
  assert.equal(decodeCursor(enc({ t: 5, id: ID })), null)
  assert.deepEqual(decodeCursor(enc({ t: '2026-10-05T01:02:03Z', id: ID })), { t: '2026-10-05T01:02:03Z', id: ID })
})
