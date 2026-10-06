import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  RESERVED_SLUGS,
  contentPathKey,
  contentUrl,
  isValidSlug,
  kindForSlug,
  parseContentPaths,
  permanentPath,
} from './content-paths'

const ID = '3f2b8c1e-5a47-4d9e-9c0a-1b2c3d4e5f60'

test('slug validation: lowercase, digits, inner hyphens, bounded length', () => {
  for (const ok of ['movies', 'film-2', 'a', 'a1', 'drama-and-more']) assert.equal(isValidSlug(ok), true, ok)
  for (const bad of ['', 'Movies', '-x', 'x-', 'a_b', 'a b', 'a/b', '../x', 'x'.repeat(41), '한글', 'a.b']) assert.equal(isValidSlug(bad), false, bad)
})

test('reserved words are rejected, "c" included (it is the permanent-address prefix)', () => {
  for (const r of ['c', 'api', 'admin', 'watch', 'login', 'robots', '_next']) assert.equal(isValidSlug(r), false, r)
  assert.equal(isValidSlug('news'), true) // not reserved on purpose: it may be the very slug TK picks
})

test('EVERY top-level folder under app/ is reserved (a new route cannot be shadowed by a slug)', () => {
  const root = join(process.cwd(), 'app')
  const dirs = readdirSync(root).filter((n) => {
    if (!statSync(join(root, n)).isDirectory()) return false
    return !/^[_(@[]/.test(n) // private (_x), route group ((x)), parallel (@x), dynamic ([x]) are not fixed segments
  })
  assert.ok(dirs.length > 10, 'sanity: the app/ listing was actually read')
  const missing = dirs.filter((d) => !RESERVED_SLUGS.includes(d))
  assert.deepEqual(missing, [], `add these to RESERVED_SLUGS in lib/content-paths.ts: ${missing.join(', ')}`)
  assert.ok(!dirs.includes('c'), 'app/c must not exist: it would collide with /c/<id>')
})

test('parseContentPaths: only valid, unshared slugs count; no row = no path (fail-closed)', () => {
  const p = parseContentPaths([
    { key: 'content_path_film', value: 'movies' },
    { key: 'content_path_drama', value: ' series ' }, // trimmed
    { key: 'content_path_news', value: 'News' }, // invalid (uppercase)
    { key: 'content_path_cf', value: 'api' }, // reserved
    { key: 'content_path_music', value: '' }, // empty
    { key: 'unrelated_key', value: 'x' },
  ])
  assert.deepEqual(p, { film: 'movies', drama: 'series' })
})

test('parseContentPaths: a slug shared by two kinds closes BOTH (guessing would publish the wrong kind)', () => {
  const p = parseContentPaths([
    { key: 'content_path_film', value: 'cinema' },
    { key: 'content_path_drama', value: 'cinema' },
    { key: 'content_path_cf', value: 'ads' },
  ])
  assert.deepEqual(p, { cf: 'ads' })
})

test('parseContentPaths: nothing configured -> nothing public', () => {
  assert.deepEqual(parseContentPaths([]), {})
})

test('contentUrl / kindForSlug / permanentPath', () => {
  const paths = { film: 'movies' } as const
  assert.equal(contentUrl('film', ID, paths), `/movies/${ID}`)
  assert.equal(contentUrl('drama', ID, paths), null) // no slug -> no surface
  assert.equal(kindForSlug('movies', paths), 'film')
  assert.equal(kindForSlug('series', paths), null)
  assert.equal(kindForSlug('', paths), null)
  assert.equal(permanentPath(ID), `/c/${ID}`)
  assert.equal(contentPathKey('music_video'), 'content_path_music_video')
})
