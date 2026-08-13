// Shared /apply types. Plain module (no 'use server' / 'server-only') so both
// the server action layer (actions.ts) and the client page can import it -- a
// 'use server' file may only export async functions, so the gate-state type
// cannot live there.

export type ApplyMembershipState = {
  // gateActive = membership switch ON and required_for_apply. When false the
  // /apply flow is unchanged (dark-launch / non-gating).
  gateActive: boolean
  isActiveCreator: boolean
  founding: {
    claimed: number
    cap: number
    remaining: number
    open: boolean
  }
}

// Has THIS user already registered (or already submitted) for this season --
// HQ 2026-08-12. 'submitted' means free_entry_url is set (the row is already
// filled in, whether via a fresh mint-and-submit or a later fill-in of a
// registered row).
export type MyRegistrationStatus =
  | { status: 'none' }
  | { status: 'registered'; entryStatus: 'pending' | 'waitlist' }
  | { status: 'submitted' }
