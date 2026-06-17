'use server'

// /membership landing data. All operating numbers (price, interval, founding
// cap/term) come from platform_config -- never hardcoded. Mirrors the /apply
// server-action pattern: the client page reads everything through this one call.

import { getUserOrNull } from '@/lib/user-auth'
import { isMembershipEnabled, getFoundingStatus, getMembershipState } from '@/lib/membership'
import { getPlatformConfigMap } from '@/lib/partners'
import type { MembershipLandingData } from './types'

export async function getMembershipLandingData(): Promise<MembershipLandingData> {
  const [enabled, founding, cfg, user] = await Promise.all([
    isMembershipEnabled(),
    getFoundingStatus(),
    getPlatformConfigMap(),
    getUserOrNull(),
  ])

  const priceRaw = Number(cfg.get('membership_creator_price_usd') ?? 0)
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null
  const interval = String(cfg.get('membership_billing_interval') ?? 'month')
  const monthsRaw = Number(cfg.get('membership_founding_free_months') ?? 0)
  const foundingMonths = Number.isInteger(monthsRaw) && monthsRaw > 0 ? monthsRaw : null

  // Active-creator status decides whether the CTA points to /apply or /profile.
  let isActiveCreator = false
  if (user) {
    const state = await getMembershipState(user.id)
    isActiveCreator = state.isActiveCreator
  }

  return {
    enabled,
    price,
    interval,
    foundingMonths,
    founding: { remaining: founding.remaining, cap: founding.cap, open: founding.open },
    signedIn: !!user,
    isActiveCreator,
  }
}
