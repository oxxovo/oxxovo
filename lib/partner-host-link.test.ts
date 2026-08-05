// The /profile host return link: the rule, with no database in the way.
//
// What is worth pinning is not the boolean. It is that every status the column is
// allowed to hold has an answer, and that the two statuses which look like
// partners but cannot host ('invited', 'suspended') are refused -- because the
// page the link points at refuses them, after the user has filled in the form.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partnerHostLinkVisible, HOST_LINK_HREF } from './partner-host-link.ts'
import { PARTNER_STATUSES } from './partner-statuses.ts'

const on = (partnerStatus: string | null) =>
  partnerHostLinkVisible({ memberHostedEnabled: true, partnerStatus })

test('the switch outranks the status', () => {
  // member_hosted_enabled is "false" live (platform_config, measured 2026-08-05).
  // With it off, /host 404s -- app/host/layout.tsx. An active partner must not be
  // offered a link into a 404.
  assert.equal(
    partnerHostLinkVisible({ memberHostedEnabled: false, partnerStatus: 'active' }),
    false,
  )
})

test('an active partner with the switch on -> link', () => {
  assert.equal(on('active'), true)
})

test("★'invited' is not a host yet", () => {
  // Their destination is /partner/activate, not /host/new. createPartnerTournament
  // compares against 'active' exactly.
  assert.equal(on('invited'), false)
})

test('★a suspended partner is refused, though admin tooling lists them as partners', () => {
  // lib/partners.ts:245-246 shows suspended beside active so admins can restore.
  // The host form does not: a suspended host gets "Only active partner hosts can
  // create tournaments" -- after filling it in.
  assert.equal(on('suspended'), false)
})

test('eligible-but-not-invited is not a host', () => {
  // auto_eligible is the threshold promotion (lib/partners.ts:391). It means an
  // invitation is warranted, not that hosting is open.
  assert.equal(on('auto_eligible'), false)
})

test('the ordinary case: nobody', () => {
  // All 7 profiles read partner_status='none' live (measured 2026-08-05).
  assert.equal(on('none'), false)
  assert.equal(on(null), false)
})

test('★every status the column allows has an answer, and only one is true', () => {
  // Guards the direction the enum grows in. If a status is added to the profiles
  // CHECK and mirrored into PARTNER_STATUSES, this fails until someone decides
  // whether it can host -- rather than defaulting it open or silently closed.
  const visible = PARTNER_STATUSES.filter((s) => on(s))
  assert.deepEqual(visible, ['active'])
})

test('an unknown status reads as not-a-host rather than throwing', () => {
  // A value written by a migration or a future path this module has not seen.
  assert.equal(on('ACTIVE'), false, 'the column is lowercase; no case folding')
  assert.equal(on('active '), false, 'no trimming -- an exact compare, like the destination')
  assert.equal(on(''), false)
  assert.equal(on('partner'), false)
})

test('★the link targets the route the master switch actually gates', () => {
  // app/host/layout.tsx 404s the whole /host subtree when the switch is off. If
  // this href is ever repointed outside /host, the rule above stops describing
  // the destination and the link can disagree with it again.
  assert.ok(
    HOST_LINK_HREF.startsWith('/host/'),
    `${HOST_LINK_HREF} is not under the gated /host subtree`,
  )
})
