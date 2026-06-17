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
}
