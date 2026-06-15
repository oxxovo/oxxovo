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
