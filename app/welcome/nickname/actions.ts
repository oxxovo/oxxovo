'use server'

// Mandatory onboarding step (TK 2026-08-19): every account must pick its own
// nickname here -- no more auto-generated "CreatorXXXX". This is the ONLY
// place display_identity/real_name are first set; later edits go through
// /profile (until locked at first submission, lib/nickname.ts).

import { getUserOrNull } from '@/lib/user-auth'
import { validateNickname, setDisplayName, isDisplayNameTaken } from '@/lib/nickname'
import { nicknameContainsBannedWord } from '@/lib/nickname-banned-words'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type OnboardingResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'too_short'
        | 'too_long'
        | 'invalid_chars'
        | 'banned_word'
        | 'taken'
        | 'real_name_required'
        | 'failed'
    }

export async function completeOnboarding(input: {
  nickname: string
  displayIdentity: 'nickname' | 'real_name'
  realName?: string
}): Promise<OnboardingResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const v = validateNickname(input.nickname)
  if (!v.ok) return { ok: false, error: v.error }
  if (await nicknameContainsBannedWord(v.value)) return { ok: false, error: 'banned_word' }
  if (await isDisplayNameTaken(v.value, user.id)) return { ok: false, error: 'taken' }

  const realName = (input.realName ?? '').trim()
  if (input.displayIdentity === 'real_name' && !realName) return { ok: false, error: 'real_name_required' }

  try {
    await setDisplayName(user.id, user.email, v.value)
  } catch (e) {
    console.error('[onboarding] nickname save failed', { userId: user.id, error: String(e) })
    return { ok: false, error: 'failed' }
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('profiles')
    .update({
      display_identity: input.displayIdentity,
      real_name: input.displayIdentity === 'real_name' ? realName : null,
    })
    .eq('id', user.id)
  if (error) {
    console.error('[onboarding] identity write failed', { userId: user.id, error: error.message })
    return { ok: false, error: 'failed' }
  }
  return { ok: true }
}
