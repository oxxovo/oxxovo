import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTENT_KINDS,
  CONTENT_SOURCES,
  dbaOfKind,
  kindsOfDba,
  openKinds,
  sourceMaySend,
  formAllowed,
  languageAllowed,
  pickAssetRole,
  hasMainVideoRole,
  isPublicAssetRole,
  PUBLIC_ASSET_ROLES,
  ASSET_ROLES,
  dispatchSwitchKey,
  publicationSwitchKey,
} from './content-kinds'

test('every kind belongs to exactly one DBA and every source owns at least one kind', () => {
  for (const k of CONTENT_KINDS) assert.ok(dbaOfKind(k) === 'news' || dbaOfKind(k) === 'entertainment')
  const owned = new Set<string>()
  for (const s of CONTENT_SOURCES) {
    const mine = CONTENT_KINDS.filter((k) => sourceMaySend(s, k))
    assert.ok(mine.length > 0, s)
    for (const k of mine) {
      assert.ok(!owned.has(k), `${k} is claimed by two sources`)
      owned.add(k)
    }
  }
  assert.equal(owned.size, CONTENT_KINDS.length, 'a kind no source may send can never be imported')
})

test('source/kind enforcement: no cross-sending', () => {
  assert.equal(sourceMaySend('news_desk', 'news'), true)
  assert.equal(sourceMaySend('news_desk', 'film'), false)
  assert.equal(sourceMaySend('production_os', 'news'), false)
  assert.equal(sourceMaySend('production_os', 'music_video'), true)
})

test('openKinds expands DBAs; an empty or closed set yields nothing', () => {
  assert.deepEqual(openKinds([]), [])
  assert.deepEqual(openKinds(['news']), ['news'])
  assert.deepEqual(openKinds(['entertainment']), ['drama', 'film', 'cf', 'music', 'music_video'])
  assert.deepEqual(openKinds(['news', 'entertainment']).sort(), [...CONTENT_KINDS].sort())
  assert.deepEqual(kindsOfDba('news'), ['news'])
})

test('switch key names', () => {
  assert.equal(dispatchSwitchKey('news'), 'news_dispatch_enabled')
  assert.equal(dispatchSwitchKey('entertainment'), 'entertainment_dispatch_enabled')
  assert.equal(publicationSwitchKey('news'), 'news_publication_enabled')
  assert.equal(publicationSwitchKey('entertainment'), 'entertainment_publication_enabled')
})

test('form: news is short only, others take all four; unknown rejected', () => {
  assert.equal(formAllowed('news', 'short'), true)
  assert.equal(formAllowed('news', 'long'), false)
  assert.equal(formAllowed('film', 'full'), true)
  assert.equal(formAllowed('film', 'movie'), false)
})

test('language allow-list is exact (no silent remap)', () => {
  for (const l of ['ko', 'en', 'ja', 'ko-KR', 'en-US', 'ja-JP']) assert.equal(languageAllowed(l), true, l)
  for (const l of ['kr', 'KO', 'ko-kr', 'zh', '']) assert.equal(languageAllowed(l), false, l)
})

test('pickAssetRole: no silent aspect substitution except x', () => {
  const only16 = ['main_16x9', 'thumbnail']
  const only9 = ['main_9x16', 'thumbnail']
  assert.equal(pickAssetRole('youtube', only16), 'main_16x9')
  assert.equal(pickAssetRole('youtube', only9), null)
  assert.equal(pickAssetRole('instagram', only9), 'main_9x16')
  assert.equal(pickAssetRole('instagram', only16), null)
  assert.equal(pickAssetRole('tiktok', only9), 'main_9x16')
  assert.equal(pickAssetRole('tiktok', only16), null)
  assert.equal(pickAssetRole('x', only16), 'main_16x9')
  assert.equal(pickAssetRole('x', only9), 'main_9x16')
  assert.equal(pickAssetRole('x', ['main_16x9', 'main_9x16']), 'main_16x9') // 16:9 preferred
  assert.equal(pickAssetRole('x', ['thumbnail', 'script']), null)
})

test('hasMainVideoRole: either main is enough, thumbnail alone is not', () => {
  assert.equal(hasMainVideoRole(['main_9x16']), true)
  assert.equal(hasMainVideoRole(['main_16x9']), true)
  assert.equal(hasMainVideoRole(['thumbnail', 'script']), false)
})

test('public roles: script is never public', () => {
  assert.equal(isPublicAssetRole('main_16x9'), true)
  assert.equal(isPublicAssetRole('thumbnail'), true)
  assert.equal(isPublicAssetRole('script'), false)
  assert.equal(isPublicAssetRole('audio_master'), false)
})

test('public role allow-list is exactly main_* + thumbnail; every defined role is decided on purpose (SS7-2)', () => {
  assert.deepEqual([...PUBLIC_ASSET_ROLES].sort(), ['main_16x9', 'main_9x16', 'thumbnail'])
  const isPublic = (r: string) => (PUBLIC_ASSET_ROLES as readonly string[]).includes(r)
  assert.deepEqual(ASSET_ROLES.filter(isPublic).sort(), ['main_16x9', 'main_9x16', 'thumbnail'])
  assert.deepEqual(ASSET_ROLES.filter((r) => !isPublic(r)), ['script'])
  // anything not on the list is private, including roles that do not exist yet
  for (const r of ['script', 'audio_master', 'audio', 'master', 'anything_new', '']) assert.equal(isPublicAssetRole(r), false, r)
})
