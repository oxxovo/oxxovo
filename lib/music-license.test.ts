import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyMusicLicense, isMusicLicenseType } from './music-license'
import { MUSIC_LICENSE_TYPES, type MusicLicenseTerms } from './music-provider'

// The gate that decides whether a music vendor may be wired in at all. These are
// pure, so they run in CI -- which matters more here than usual: the thing being
// tested is a refusal, and a refusal that quietly stops refusing looks exactly
// like everything working.

const CITED: MusicLicenseTerms['source'] = {
  document: 'Example Vendor API Terms (2026-01-01)',
  clause: '§4.2(b)',
  retrievedAt: '2026-08-01',
  confirmedBy: '고문',
}

// A hypothetical vendor that satisfies every requirement. ★Not a real vendor:
// no real terms are asserted anywhere in this repo, and the booleans for a real
// vendor are filled from the contract text by 대표님/고문, never here.
const QUALIFYING: MusicLicenseTerms = {
  commercialUse: true,
  redistribution: true,
  perpetual: true,
  attributionRequired: false,
  royaltyFree: true,
  trainingDataLicensed: true,
  resaleToEndUsersPermitted: true,
  source: CITED,
}

test('terms that meet every requirement earn the label', () => {
  assert.equal(classifyMusicLicense(QUALIFYING), 'commercial_redistributable')
})

// One flag at a time. Written as a table rather than seven tests so that adding
// a flag to MusicLicenseTerms without adding a row here is visible: the count
// assertion below fails.
const DISQUALIFYING: ReadonlyArray<[keyof Omit<MusicLicenseTerms, 'source'>, boolean]> = [
  ['commercialUse', false],
  ['redistribution', false],
  ['perpetual', false],
  ['attributionRequired', true], // requiring a credit line is a refusal today
  ['royaltyFree', false],
  ['trainingDataLicensed', false],
  ['resaleToEndUsersPermitted', false], // the ElevenLabs §3.A shape
]

for (const [flag, bad] of DISQUALIFYING) {
  test(`a single wrong flag refuses the vendor: ${flag}=${bad}`, () => {
    assert.equal(classifyMusicLicense({ ...QUALIFYING, [flag]: bad }), null)
  })
}

test('every boolean in the terms has a rule -- no flag is silently ignored', () => {
  const flags = Object.keys(QUALIFYING).filter((k) => k !== 'source')
  assert.equal(
    flags.length,
    DISQUALIFYING.length,
    'MusicLicenseTerms gained a flag with no case here: decide what it means before a vendor is judged by it',
  )
})

// A citation nobody can re-read is not a citation. Each part is load-bearing.
for (const part of ['document', 'clause', 'retrievedAt', 'confirmedBy'] as const) {
  test(`an incomplete citation refuses the vendor: missing ${part}`, () => {
    const source = { ...CITED, [part]: '' }
    assert.equal(classifyMusicLicense({ ...QUALIFYING, source }), null)
  })
  test(`a whitespace-only citation is not a citation: ${part}`, () => {
    const source = { ...CITED, [part]: '   ' }
    assert.equal(classifyMusicLicense({ ...QUALIFYING, source }), null)
  })
}

test('missing terms, missing source and garbage all refuse', () => {
  assert.equal(classifyMusicLicense(null as unknown as MusicLicenseTerms), null)
  assert.equal(classifyMusicLicense(undefined as unknown as MusicLicenseTerms), null)
  assert.equal(classifyMusicLicense({ ...QUALIFYING, source: undefined as unknown as MusicLicenseTerms['source'] }), null)
  assert.equal(classifyMusicLicense({ source: CITED } as unknown as MusicLicenseTerms), null)
})

// ★"true-ish" is not true. A vendor questionnaire filled in as strings must not
// classify -- that is precisely how an unconfirmed answer becomes a yes.
test('non-boolean flag values do not satisfy a rule', () => {
  const stringy = { ...QUALIFYING, commercialUse: 'true' as unknown as boolean }
  assert.equal(classifyMusicLicense(stringy), null)
  const numeric = { ...QUALIFYING, royaltyFree: 1 as unknown as boolean }
  assert.equal(classifyMusicLicense(numeric), null)
})

test('the enumeration has exactly one member, and adding one is not an engineering change', () => {
  assert.deepEqual([...MUSIC_LICENSE_TYPES], ['commercial_redistributable'])
})

test('isMusicLicenseType is the only thing checking license_type -- the column is plain text', () => {
  assert.equal(isMusicLicenseType('commercial_redistributable'), true)
  assert.equal(isMusicLicenseType('royalty_free'), false)
  assert.equal(isMusicLicenseType(''), false)
  assert.equal(isMusicLicenseType(null), false)
  assert.equal(isMusicLicenseType(undefined), false)
  assert.equal(isMusicLicenseType(1), false)
})
