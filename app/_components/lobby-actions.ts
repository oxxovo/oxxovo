'use server'

// Server action wrapper so the (client) home page gets server-derived lobby
// cards -- the status mode is computed on the server (getLobbyTournaments uses
// the server clock), never in the browser.

import { getLobbyTournaments, type LobbyCard } from '@/lib/lobby'

export async function loadLobbyTournaments(): Promise<LobbyCard[]> {
  return getLobbyTournaments()
}
