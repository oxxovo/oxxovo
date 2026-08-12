// Licence classification -- the ④ gate from lib/music-provider.ts, implemented.
// PURE: no env, no DB, no network. Mirrored byte-for-byte into
// oxxovo-studio/src/music-license.ts, because the registration that calls it
// happens in the worker while the label it returns is written by the app.
//
// ★This file decides whether a vendor may be wired in AT ALL. It does not decide
// what a vendor's terms are -- see MusicLicenseTerms, whose booleans are filled
// by 대표님/고문 from the contract text, never by an engineer reading a licence
// page. This file only says: given those facts, which of OUR labels do they
// earn, if any.

import { MUSIC_LICENSE_TYPES, type MusicLicenseTerms, type MusicLicenseType } from './music-provider'

// Everything in MusicLicenseTerms except the citation -- i.e. the facts a rule
// can be written against.
type MusicLicenseFlags = Omit<MusicLicenseTerms, 'source'>

// ★TOTAL BY CONSTRUCTION. This is typed as the full flag set, so adding a field
// to MusicLicenseTerms makes this object literal fail to compile until someone
// says what the new fact means for this label. That is the point: a licence
// question nobody answered must not default to "does not matter".
//
// Each entry, and why it is what it is:
const COMMERCIAL_REDISTRIBUTABLE: MusicLicenseFlags = {
  // The entry is a commercial artefact the moment it is broadcast on Watch and
  // used in promotion.
  commercialUse: true,
  // The entry is redistributed by definition -- that is what a competition is.
  redistribution: true,
  // Entries outlive the season and outlive our subscription to any vendor. A
  // licence that lapses turns the archive into a liability.
  perpetual: true,
  // No credit line, because there is nowhere honest to put one: the entry is the
  // participant's work, and burning a vendor's name into it is not ours to do.
  // ★A vendor requiring attribution is not rejected forever -- it is rejected
  // until someone decides where the credit goes. That decision is not this file's.
  attributionRequired: false,
  // A per-play royalty on a video we cannot count plays of is an open liability.
  royaltyFree: true,
  // Decides whether a third-party claim lands on the participant or the vendor.
  // We are not putting it on the participant.
  trainingDataLicensed: true,
  // ★The ElevenLabs §3.A shape. Participants generate through OUR key, which is
  // exactly what a no-reseller clause forbids. FALSE refuses registration no
  // matter how clean the output licence is -- the output licence is not the
  // clause we would be breaking.
  resaleToEndUsersPermitted: true,
}

const RULES: ReadonlyArray<{ label: MusicLicenseType; flags: MusicLicenseFlags }> = [
  { label: 'commercial_redistributable', flags: COMMERCIAL_REDISTRIBUTABLE },
]

// A citation that cannot be re-read is not a citation. All four parts required:
// a URL alone does not survive the page being edited, and without `clause`
// nobody can tell later which sentence anyone actually relied on.
function citationComplete(s: MusicLicenseTerms['source']): boolean {
  if (!s || typeof s !== 'object') return false
  return (
    typeof s.document === 'string' && s.document.trim().length > 0 &&
    typeof s.clause === 'string' && s.clause.trim().length > 0 &&
    typeof s.retrievedAt === 'string' && s.retrievedAt.trim().length > 0 &&
    typeof s.confirmedBy === 'string' && s.confirmedBy.trim().length > 0
  )
}

/**
 * The label these terms earn, or null.
 *
 * ★null means REFUSE REGISTRATION -- see registerMusicProvider in the worker.
 * It is returned for an unclassifiable vendor and for a vendor whose terms are
 * merely uncited, and deliberately does not distinguish them: "we have not
 * confirmed this yet" and "these terms do not qualify" have the same correct
 * consequence, which is that no participant's track is made under them.
 *
 * Conservative by construction -- a rule must match on EVERY flag. There is no
 * scoring, no "close enough", and no path that returns a label for terms nobody
 * wrote a rule for.
 */
export function classifyMusicLicense(terms: MusicLicenseTerms): MusicLicenseType | null {
  if (!terms || typeof terms !== 'object') return null
  if (!citationComplete(terms.source)) return null
  for (const rule of RULES) {
    const keys = Object.keys(rule.flags) as (keyof MusicLicenseFlags)[]
    if (keys.every((k) => terms[k] === rule.flags[k])) return rule.label
  }
  return null
}

/**
 * Is this string one of OUR labels? Used where a value crosses a boundary that
 * cannot type-check it -- studio_music_assets.license_type is plain nullable
 * text with no DB-level enum (probed live 2026-08-01), so the column will accept
 * anything and this is the only thing that will not.
 */
export function isMusicLicenseType(value: unknown): value is MusicLicenseType {
  return typeof value === 'string' && (MUSIC_LICENSE_TYPES as readonly string[]).includes(value)
}
