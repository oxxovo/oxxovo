// Shared /membership types. Plain module (no 'use server' / 'server-only') so
// both the server action layer (actions.ts) and the client page can import it --
// a 'use server' file may only export async functions.

export type MembershipLandingData = {
  // Master switch. When false (dark launch) the page still shows all info but
  // the join CTA renders disabled ("Coming soon").
  enabled: boolean
  // Creator price + interval from config (no hardcode). null when unset/invalid.
  price: number | null
  interval: string
  // Founding free term in months (config). null when unset/invalid.
  foundingMonths: number | null
  founding: { remaining: number; cap: number; open: boolean }
  // Cookie-session state -> drives the CTA target (signup / apply / profile).
  signedIn: boolean
  isActiveCreator: boolean
  // platform_config.member_hosted_enabled -- the same switch that 404s /host and
  // /partner. False live today, and the standard rules give season 0 no partners,
  // so the Partner column and the Host tournaments row stay off the page. See
  // lib/membership-tiers.ts; this is the only surface that was showing a
  // member-hosted feature without asking the switch.
  memberHostedEnabled: boolean
}
