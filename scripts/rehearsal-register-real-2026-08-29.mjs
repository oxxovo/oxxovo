#!/usr/bin/env node
// Real-account registration for the 2026-08-29 rehearsal (HQ approved
// 2026-08-29: "registerForSeason service-role call, approved -- run as-is
// tomorrow"). /apply's UI can NEVER show season_test -- getCurrentSeason()
// filters every fixture season out on both branches (lib/seasons.ts:481,497,
// fixed 2026-08-23), and season_test matches FIXTURE_ID_PREFIXES by id
// unconditionally (lib/season-fixture.ts:17). So this calls the SAME
// registerForSeason() the real /apply form calls (lib/studio.ts:1301) --
// membership/nickname/age/capacity gates all run for real -- just without
// the browser step that structurally cannot reach season_test.
//
// PRECONDITION per participant: they must be logged in at least once AND
// have already set their own nickname (display_name) themselves -- mandatory
// nickname (HQ 2026-08-19) is read from the profile, not passed here, and
// this script does not set it. Fill in PARTICIPANTS below with real
// userId/email after they've done that tomorrow morning, then run once.
//
// This is a REAL, PERSISTING registration -- not a zz_ probe. No cleanup
// block. Revert path is scripts/../reports/jisu_hq_2026-08-28_eod.md STEP 1/2
// (genesis_applications -> pending, not delete) after the rehearsal ends.
//
// Run: node --env-file=.env.local --import ./scripts/test-register.mjs scripts/rehearsal-register-real-2026-08-29.mjs

import { registerForSeason } from '../lib/studio.ts'

const SEASON_ID = 'season_test'

// ★FILL IN TOMORROW MORNING, after both have logged in once and set their
// own nickname. age must be a real number (>=18 gate is live,
// lib/studio.ts:1222-1226) -- self-reported, no ID check (HQ 2026-08-29:
// stays as-is, false-statement=disqualification wording is a separate track).
const PARTICIPANTS = [
  {
    label: 'spouse (Founding #2, free)',
    userId: '<FILL_IN>',
    email: '<FILL_IN>',
    creatorName: '<FILL_IN>', // display name for the entry, not the account nickname
    creatorStatement:
      '<FILL_IN -- 150-250 chars, describes the rehearsal entry>',
    country: '<FILL_IN>',
    age: 0, // <FILL_IN>
  },
  {
    label: 'TK new email account (paid $19.99)',
    userId: '<FILL_IN>',
    email: '<FILL_IN>',
    creatorName: '<FILL_IN>',
    creatorStatement:
      '<FILL_IN -- 150-250 chars, describes the rehearsal entry>',
    country: '<FILL_IN>',
    age: 0, // <FILL_IN>
  },
]

function assertFilledIn(p) {
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'string' && v.startsWith('<FILL_IN')) {
      throw new Error(`PARTICIPANTS.${p.label ?? '?'}.${k} is still a placeholder -- fill in before running`)
    }
  }
}

async function main() {
  for (const p of PARTICIPANTS) {
    assertFilledIn(p)
    console.log(`\n--- registering: ${p.label} (${p.email}) ---`)
    const result = await registerForSeason({
      seasonId: SEASON_ID,
      userId: p.userId,
      email: p.email,
      applicant: {
        creatorName: p.creatorName,
        creatorStatement: p.creatorStatement,
        country: p.country,
        age: p.age,
        agreedRules: true,
        agreedPrivacy: true,
        agreedIntegrity: true,
      },
    })
    console.log(`registerForSeason(${p.label}) =`, JSON.stringify(result))
    if (!result.ok) {
      console.error(`STOPPED: ${p.label} was rejected (reason: ${result.reason}). Fix and re-run for this participant only -- do not retry the one(s) that already succeeded (already_registered is expected and harmless for those).`)
    }
  }
}

main().catch((e) => {
  console.error('\nREGISTRATION SCRIPT FAILED:', e.message)
  process.exitCode = 1
})
