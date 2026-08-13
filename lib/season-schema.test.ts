// The one field on the season form that has NO default, and why that has to
// stay true.
//
// ★WHAT IS BEING PROTECTED. is_fixture answers "is this a real competition", and
// as of 2026-08-09 that one boolean drives the public lobby (lib/lobby.ts
// isOfficialPublic) and is the column the mailer should be reading too. Both
// possible defaults are wrong, in opposite and unequal directions:
//
//   default false -> a rehearsal is filed as real. It shows on the lobby and its
//     test addresses get participant mail. NOT RECOVERABLE: the mail has left.
//   default true  -> a real season is filed as test data. Hidden, unmailed.
//     Recoverable -- but silent until someone notices.
//
// The DB DEFAULT is true, which is the right call for a row created by a path
// with no human in it. This form HAS a human, so the answer is asked rather than
// assumed. Every assertion below exists because "just give it a default" is the
// obvious-looking simplification, and it would undo the whole thing quietly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seasonSchema, DEFAULT_SEASON } from './season-schema'

// DEFAULT_SEASON deliberately has no is_fixture, so a submittable payload is it
// plus the answer -- exactly what the form posts.
const submitted = (isFixture?: unknown) => ({
  ...DEFAULT_SEASON,
  ...(isFixture === undefined ? {} : { is_fixture: isFixture }),
})

test('★is_fixture missing is an ERROR, not a false', () => {
  const parsed = seasonSchema.safeParse(submitted())
  assert.equal(parsed.success, false, 'a payload with no answer must be rejected')
  const paths = parsed.error!.issues.map((i) => i.path.join('.'))
  assert.ok(paths.includes('is_fixture'), `expected an is_fixture issue, got: ${paths.join(', ')}`)
  // The message has to tell the admin what to do. A bare "Invalid input" on a
  // field with no default is how someone concludes the form is broken.
  const msg = parsed.error!.issues.find((i) => i.path.join('.') === 'is_fixture')!.message
  assert.match(msg, /no default/i)
})

test('both answers parse, and to the right booleans', () => {
  const real = seasonSchema.safeParse(submitted('false'))
  assert.equal(real.success, true, real.success ? '' : JSON.stringify(real.error?.issues))
  assert.equal(real.data!.is_fixture, false, "'false' is the REAL competition")

  const rehearsal = seasonSchema.safeParse(submitted('true'))
  assert.equal(rehearsal.success, true)
  assert.equal(rehearsal.data!.is_fixture, true, "'true' is the rehearsal")

  // Booleans too, so a caller that is not an HTML form still works.
  assert.equal(seasonSchema.safeParse(submitted(false)).success, false, 'only the radio strings are accepted')
})

test('★nothing near-empty slips through as an answer', () => {
  // Each of these is a way a form can post "no choice" -- an empty select
  // option, a cleared field, a hand-built request. None may become a value.
  for (const junk of ['', null, 'on', 'yes', 'no', '0', '1', 'FALSE', 'True', ' false']) {
    assert.equal(
      seasonSchema.safeParse(submitted(junk)).success,
      false,
      `${JSON.stringify(junk)} was accepted as an answer`,
    )
  }
})

test('★DEFAULT_SEASON: lobby_featured has an invented default, is_fixture has none', () => {
  // ★THIS OBJECT is where "has a default" actually lives -- not the schema.
  // Measured on zod 4: lobby_featured is NOT optional at the schema level either
  // (an absent key fails with `expected nonoptional`), because .transform() makes
  // the output boolean. So the schema cannot be what distinguishes the two
  // fields, and an earlier version of this test asserted otherwise and was wrong.
  //
  // What distinguishes them is that the form always HAS a value to post for
  // lobby_featured -- DEFAULT_SEASON invents `false`, a checkbox shows it, a
  // hidden input mirrors it -- and has nothing to post for is_fixture until a
  // human clicks. That is fine for a pin-to-front flag, where both directions of
  // being wrong are trivial. It is not fine for the flag that decides whether
  // strangers get mail.
  assert.equal(DEFAULT_SEASON.lobby_featured, false, 'the pin flag may be invented')
  assert.equal(
    'is_fixture' in DEFAULT_SEASON,
    false,
    'DEFAULT_SEASON gained an is_fixture -- the new-season form now answers for the admin, ' +
      'and a pre-selected radio can be submitted without anyone reading it',
  )
})

// ★STRUCTURAL. The schema can reject an empty answer, but it cannot stop the FORM
// from inventing one before it posts. `initial.is_fixture ?? false` in the form
// would satisfy every assertion above and silently restore the default -- the
// radio would arrive pre-selected and the schema would never see an absence. So
// the source is checked for it.
test('★the form does not invent an answer before posting', () => {
  const src = readFileSync(new URL('../app/admin/seasons/SeasonForm.tsx', import.meta.url), 'utf8')

  const choice = src.match(/<RequiredChoice[\s\S]*?\/>/)
  assert.ok(choice, 'the is_fixture control is no longer a RequiredChoice')
  assert.match(choice[0], /value=\{initial\.is_fixture\}/, 'the control must pass the value through unchanged')
  assert.doesNotMatch(
    choice[0],
    /is_fixture\s*(\?\?|\|\|)/,
    'the form falls back to a default before posting -- the choice is no longer required',
  )

  // Radios, not a dropdown: a <select> always shows something, so it has no way
  // to render "nobody has answered".
  assert.match(src, /function RequiredChoice/, 'RequiredChoice was removed')
  // Two things this delimiter has to survive, both of which produced a vacuous
  // or failing match while it was being written:
  //   * `\n}` alone stops at the destructured parameter list's `}: {`, leaving
  //     the body unchecked -- the assertions below would pass on nothing.
  //   * the file is CRLF, so the closing brace is `\r\n}\r\n`. `\n}\n` never
  //     matches it at all.
  const impl = src.match(/function RequiredChoice[\s\S]*?\r?\n}\r?\n/)
  assert.ok(impl, 'could not isolate the RequiredChoice body -- fix this matcher, do not delete it')
  assert.match(impl[0], /type="radio"/)
  assert.match(impl[0], /required/, 'the browser must block submission too, not only the server')
})
