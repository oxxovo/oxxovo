// Whether /profile offers an activated partner a way back to their host area.
//
// The gap this closes: the ONLY link to /host/new anywhere in app/ is
// app/partner/activate/ActivateView.tsx:64, which is reachable exactly once --
// during activation. After that the partner has no route back. They are expected
// to remember a URL.
//
// The rule is derived from the destination's own gate, not declared next to it.
// /host/new refuses on three facts, in this order:
//
//   1. app/host/layout.tsx        notFound() unless isMemberHostedEnabled()
//   2. createPartnerTournament    signed in
//   3. createPartnerTournament    profiles.partner_status === 'active'
//
// So those are the three facts the link reads. Anything else and the link would
// be free to disagree with the page it points at -- the same defect the landing's
// hardcoded WATCH_NAV_ENABLED had (see lib/watch-nav.ts): a second gate on a fact
// that was already decided somewhere else.
//
// 'suspended' is the case worth naming. Admin tooling lists suspended partners
// alongside active ones so they can be restored (lib/partners.ts:245-246), so it
// is tempting to treat them as partners. The destination does not: it compares
// against 'active' exactly, and a suspended host reaching the form gets
// "Only active partner hosts can create tournaments." after filling it in.
//
// Not a condition here, deliberately: partner_tier. createPartnerTournament also
// refuses when partner_tier is null, but 'active' is only reachable from
// 'invited' (app/partner/activate/actions.ts:58) or from 'suspended' via admin
// restore (app/admin/partners/actions.ts:107), and invitePartner writes
// partner_tier at invite time (:200) while neither transition clears it. So
// active-with-no-tier does not exist. If that stops being true -- an active row
// created by some future path that skips the invite -- the link would point at a
// form that rejects the submission, and this comment is where to look.
//
// No imports in this module, deliberately. The rule has to be reachable from a
// unit test, and every route into the partner code (lib/partners.ts,
// lib/user-auth.ts, lib/member-hosted.ts) reaches next/headers or 'server-only'
// and cannot be loaded outside a Next server. The two facts are therefore passed
// in; the reads that establish them live in app/profile/actions.ts beside the
// other profile reads.

// The route the link targets. Kept beside the rule so the two cannot drift: this
// path is what app/host/layout.tsx gates, and the rule below is that gate.
export const HOST_LINK_HREF = '/host/new'

// `partnerStatus` is whatever the column holds -- unknown values (a status added
// to the CHECK later, a typo, null) read as "not a host" rather than throwing or
// defaulting open.
export function partnerHostLinkVisible(input: {
  memberHostedEnabled: boolean
  partnerStatus: string | null
}): boolean {
  if (!input.memberHostedEnabled) return false
  return input.partnerStatus === 'active'
}
