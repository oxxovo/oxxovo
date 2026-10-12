// Banner rows: replaced by data, validated on read, default on any doubt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BANNER_PAGES, bannerKey, originOf, parseBanner, parseBanners } from './site-banner.ts'

const ORIGIN = 'https://pub.example.r2.dev'
const good = (over: object = {}) => JSON.stringify({ url: `${ORIGIN}/banners/daily.webp`, width: 1920, height: 1080, ...over })

test('control: a valid row is accepted', () => {
  assert.deepEqual(parseBanner(good(), ORIGIN), { url: `${ORIGIN}/banners/daily.webp`, width: 1920, height: 1080 })
  assert.ok(parseBanner(good({ width: 3840, height: 2160 }), ORIGIN))
})

test('★every doubt -> null (the page then uses the default banner)', () => {
  const bad: [string, unknown][] = [
    ['not a string', 42], ['empty', ''], ['bad json', '{nope'], ['array', '[]'], ['null', 'null'],
    ['below 1920 wide', good({ width: 1280, height: 720 })], ['below 1080 high', good({ width: 1920, height: 1000 })],
    ['not 16:9', good({ width: 1920, height: 1200 })], ['9:16', good({ width: 1080, height: 1920 })],
    ['http', good({ url: 'http://pub.example.r2.dev/x.webp' })], ['foreign host', good({ url: 'https://evil.example/x.webp' })],
    ['lookalike host', good({ url: 'https://pub.example.r2.dev.evil.example/x.webp' })],
    ['userinfo trick', good({ url: 'https://pub.example.r2.dev@evil.example/x.webp' })],
    ['javascript url', good({ url: 'javascript:alert(1)' })], ['relative', good({ url: '/x.webp' })],
    ['width as string', good({ width: '1920' })], ['fractional', good({ width: 1920.5 })], ['missing url', JSON.stringify({ width: 1920, height: 1080 })],
  ]
  for (const [why, v] of bad) assert.equal(parseBanner(v, ORIGIN), null, why)
})

test('no allowed origin configured -> no banner at all (fail closed)', () => {
  assert.equal(parseBanner(good(), null), null)
  assert.equal(originOf(undefined), null)
  assert.equal(originOf('http://insecure.example'), null)
  assert.equal(originOf('not a url'), null)
  assert.equal(originOf('https://pub.example.r2.dev/some/base'), ORIGIN)
})

test('rows: key per page, only valid ones kept, others absent; Daily absent = default', () => {
  assert.equal(bannerKey('daily'), 'banner_daily')
  const rows = [
    { key: 'banner_home', value: good() },
    { key: 'banner_jobs', value: good({ width: 800, height: 450 }) },
    { key: 'banner_market', value: '{bad' },
    { key: 'banner_unknown', value: good() },
    { key: 'other', value: good() },
  ]
  const m = parseBanners(rows, ORIGIN)
  assert.deepEqual(Object.keys(m), ['home'])
  assert.equal(m.daily, undefined)
  assert.equal(BANNER_PAGES.length, 8)
})
