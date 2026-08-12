'use server'

// Curation writes. Admin only.
//
// ★The gate is here AND the scope is in the statement (lib/music-curation.ts
// restricts the update to source='library'). Two layers, because this is the one
// write that changes what every participant can choose from.

import { revalidatePath } from 'next/cache'
import { getAdminOrNull } from '@/lib/admin-auth'
import { setMusicActive, type SetActiveResult } from '@/lib/music-curation'

export async function setMusicActiveAction(ids: string[], active: boolean): Promise<SetActiveResult> {
  const adminUser = await getAdminOrNull()
  if (!adminUser) return { ok: false, error: 'forbidden' }

  const res = await setMusicActive(ids, active)
  // Revalidate even on a partial result: some rows did change, and leaving the
  // screen showing the old state would hide that.
  revalidatePath('/admin/music')
  return res
}
