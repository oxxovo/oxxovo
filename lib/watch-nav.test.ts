// The landing's Watch link: the rule, with no database in the way.
//
// The thing worth pinning is not the boolean, it is that the link can never be
// offered when Watch would not serve. The old hardcoded constant could not express
// that -- it was a human's memory of an env switch living in a different file.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { watchNavVisible } from './watch-nav.ts'
import { isWatchPublic } from './watch-gate.ts'

test('no public Watch surface -> no link, however many videos there are', () => {
  assert.equal(watchNavVisible({ publicSurface: false, currentSeasonEntries: 0 }), false)
  assert.equal(watchNavVisible({ publicSurface: false, currentSeasonEntries: 500 }), false)
})

test('public surface but nothing public in the current season -> no link', () => {
  // This is launch day: WATCH_PUBLIC_ENABLED is on, the first films have not landed
  // (or the fairness hold is still on, which makes them non-public). Linking here
  // would send the first visitors to an empty grid.
  assert.equal(watchNavVisible({ publicSurface: true, currentSeasonEntries: 0 }), false)
})

test('public surface and one public entry -> link', () => {
  assert.equal(watchNavVisible({ publicSurface: true, currentSeasonEntries: 1 }), true)
})

test('★the surface gate is the same one /watch itself uses', () => {
  // isWatchPublic is what makes /watch notFound() in production. If the landing
  // ever stops deriving from it, the header can offer a 404 again -- which is what
  // the hardcoded constant risked in both directions.
  const before = process.env.WATCH_PUBLIC_ENABLED
  const beforeVercel = process.env.VERCEL_ENV
  try {
    process.env.VERCEL_ENV = 'production'
    delete process.env.WATCH_PUBLIC_ENABLED
    assert.equal(isWatchPublic(), false, 'production without the switch must be closed')
    assert.equal(watchNavVisible({ publicSurface: isWatchPublic(), currentSeasonEntries: 41 }), false)

    process.env.WATCH_PUBLIC_ENABLED = 'true'
    assert.equal(isWatchPublic(), true)
    assert.equal(watchNavVisible({ publicSurface: isWatchPublic(), currentSeasonEntries: 41 }), true)
  } finally {
    if (before === undefined) delete process.env.WATCH_PUBLIC_ENABLED
    else process.env.WATCH_PUBLIC_ENABLED = before
    if (beforeVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = beforeVercel
  }
})

test('preview and local stay open, the same way /watch does', () => {
  const before = process.env.WATCH_PUBLIC_ENABLED
  const beforeVercel = process.env.VERCEL_ENV
  try {
    delete process.env.WATCH_PUBLIC_ENABLED
    process.env.VERCEL_ENV = 'preview'
    assert.equal(watchNavVisible({ publicSurface: isWatchPublic(), currentSeasonEntries: 1 }), true)
    delete process.env.VERCEL_ENV
    assert.equal(watchNavVisible({ publicSurface: isWatchPublic(), currentSeasonEntries: 1 }), true)
  } finally {
    if (before === undefined) delete process.env.WATCH_PUBLIC_ENABLED
    else process.env.WATCH_PUBLIC_ENABLED = before
    if (beforeVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = beforeVercel
  }
})
