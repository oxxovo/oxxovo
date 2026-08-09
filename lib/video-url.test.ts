// video-url: parsing, the season-driven allow list, and the predicate the
// screens use to decide whether to offer a URL field at all.
//
// ★THE POINT OF THIS FILE. /apply used to carry its own ['youtube','vimeo']
// constant, so "what may a prelim entry be?" had two answers -- the season row
// and the code. They disagreed the day season_0 became ['studio']: the screen
// said the URL was fine and the server rejected it. The proof that the fix is
// real is not "a studio season rejects YouTube" on its own -- it is that THE
// SAME URL is rejected under one season's column and accepted under another's.
// A hardcoded gate cannot pass both of those at once.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptsExternalUrl,
  formatVideoPlatforms,
  formatVideoUrlPlaceholder,
  parseVideoUrl,
  validateVideoUrl,
} from './video-url'

// The two live column values, written out rather than imported: a test that read
// the same constant as the code would agree with it by construction.
const STUDIO_ONLY = ['studio']
const FOUR_PLATFORMS = ['youtube', 'vimeo', 'instagram', 'tiktok']

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

// ─── the season decides, not the code ───────────────────────────────────────

test('same YouTube URL: rejected under [studio], accepted under the four platforms', () => {
  const underStudio = validateVideoUrl(YT, STUDIO_ONLY)
  assert.equal(underStudio.valid, false)
  assert.equal(underStudio.valid === false && underStudio.error, 'not_allowed')

  const underFour = validateVideoUrl(YT, FOUR_PLATFORMS)
  assert.equal(underFour.valid, true)
  assert.equal(underFour.valid === true && underFour.platform, 'youtube')
})

test('an arbitrary string is unknown_platform under every column value', () => {
  // The case that was actually open: /api/apply had no URL check at all, so any
  // non-empty string went straight into free_entry_url.
  for (const allowed of [STUDIO_ONLY, FOUR_PLATFORMS]) {
    const v = validateVideoUrl('just some text', allowed)
    assert.equal(v.valid, false)
    assert.equal(v.valid === false && v.error, 'unknown_platform')
  }
})

test("'studio' matches no URL, which is what closes the route", () => {
  // Nothing parseVideoUrl can return is named 'studio', so a ['studio'] season
  // rejects every input. That is the whole mechanism -- lib/video-url.ts was not
  // modified to make it work.
  for (const url of [
    YT,
    'https://vimeo.com/123456',
    'https://www.tiktok.com/@someone/video/1234567890',
    'https://instagram.com/reel/abc/',
    'https://pub-bf4080d3.r2.dev/renders/x.mp4',
  ]) {
    assert.equal(validateVideoUrl(url, STUDIO_ONLY).valid, false, url)
  }
})

test('a per-platform column is honoured exactly, not rounded up to "external"', () => {
  const vimeoOnly = ['vimeo']
  assert.equal(validateVideoUrl(YT, vimeoOnly).valid, false)
  assert.equal(validateVideoUrl('https://vimeo.com/123456', vimeoOnly).valid, true)
})

// ─── acceptsExternalUrl: the screen/server shared predicate ─────────────────

test('acceptsExternalUrl is false for a studio-only season', () => {
  assert.equal(acceptsExternalUrl(STUDIO_ONLY), false)
})

test('acceptsExternalUrl is true when any parseable platform is present', () => {
  assert.equal(acceptsExternalUrl(FOUR_PLATFORMS), true)
  assert.equal(acceptsExternalUrl(['youtube']), true)
  // Mixed is still true: one linkable source is enough to justify the field.
  assert.equal(acceptsExternalUrl(['studio', 'youtube']), true)
})

test('★acceptsExternalUrl fails CLOSED on a missing column', () => {
  // seasons_public is read with select('*'). "The view did not expose the
  // column" must never render as "everything is allowed" -- that would put the
  // form back on screen in front of a server that 403s.
  assert.equal(acceptsExternalUrl(null), false)
  assert.equal(acceptsExternalUrl(undefined), false)
  assert.equal(acceptsExternalUrl([]), false)
  assert.equal(acceptsExternalUrl(['nonsense']), false)
})

test('acceptsExternalUrl agrees with validateVideoUrl on every column value', () => {
  // The two must not drift: if the predicate says the season takes links, some
  // URL has to be acceptable, and if it says otherwise, none may be.
  const samples = [
    YT,
    'https://vimeo.com/123456',
    'https://www.tiktok.com/@someone/video/1234567890',
    'https://instagram.com/reel/abc/',
  ]
  for (const allowed of [STUDIO_ONLY, FOUR_PLATFORMS, ['vimeo'], [], ['studio', 'tiktok']]) {
    const anyValid = samples.some((u) => validateVideoUrl(u, allowed).valid)
    assert.equal(acceptsExternalUrl(allowed), anyValid, JSON.stringify(allowed))
  }
})

// ─── display ────────────────────────────────────────────────────────────────

test("formatVideoPlatforms names 'studio' instead of printing it lowercase", () => {
  assert.equal(formatVideoPlatforms(STUDIO_ONLY), 'OXXOVO Studio')
  assert.equal(formatVideoPlatforms(['youtube', 'vimeo']), 'YouTube · Vimeo')
  // An unknown value still falls through to itself rather than disappearing.
  assert.equal(formatVideoPlatforms(['whatever']), 'whatever')
})

test('the placeholder follows the column and never invents an allowed source', () => {
  assert.equal(
    formatVideoUrlPlaceholder(['youtube', 'vimeo']),
    'https://youtube.com/watch?v=…  or  https://vimeo.com/…',
  )
  // 'studio' has no example URL, and must not borrow one.
  assert.equal(formatVideoUrlPlaceholder(STUDIO_ONLY), 'https://…')
  assert.equal(formatVideoUrlPlaceholder([]), 'https://…')
  // At most two, so the single-line input stays readable.
  assert.equal(formatVideoUrlPlaceholder(FOUR_PLATFORMS).split('  or  ').length, 2)
})

// ─── parser regressions (the allow list is only as good as the parse) ───────

test('empty input is empty, not unknown_platform', () => {
  assert.equal(parseVideoUrl('').kind, 'empty')
  assert.equal(parseVideoUrl(null).kind, 'empty')
  assert.equal(parseVideoUrl('   ').kind, 'empty')
  assert.equal(validateVideoUrl('', FOUR_PLATFORMS).valid, false)
})

test('the short and shorts YouTube forms parse to the same id', () => {
  for (const u of [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    YT,
  ]) {
    const p = parseVideoUrl(u)
    assert.equal(p.kind, 'youtube', u)
    assert.equal(p.kind === 'youtube' && p.videoId, 'dQw4w9WgXcQ')
  }
})

test('instagram validates with a null embed (href-only, by design)', () => {
  const v = validateVideoUrl('https://instagram.com/reel/abc/', FOUR_PLATFORMS)
  assert.equal(v.valid, true)
  assert.equal(v.valid === true && v.embedSrc, null)
})
