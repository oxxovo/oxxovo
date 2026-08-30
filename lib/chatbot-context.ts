// Builds the ChatbotTokenContext (lib/chatbot-tokens.ts) shared by every
// caller of lib/chatbot-kb.ts's buildChatbotSystemPrompt: the chat widget
// (app/api/chat/route.ts), Triple-AI Review (lib/ai/review.ts), and the
// inbound-email auto-reply (lib/email/inbound-reply.ts). One place to fetch
// season/membership/config so the three surfaces can never drift into
// reading them three different ways.
//
// ★Reads membership facts directly (getFoundingStatus/getPlatformConfigMap),
// NOT app/membership/actions.ts's getMembershipLandingData -- that function
// also calls getUserOrNull() for per-visitor personalization (signedIn,
// isActiveCreator) via next/headers cookies(), which this context has no use
// for (the chatbot's facts don't vary by visitor) and which the two non-HTTP
// callers here (Triple-AI Review, the inbound-email worker) may not even have
// a cookie context for.

import 'server-only'
import { getCurrentSeason } from './seasons'
import { getFoundingStatus } from './membership'
import { getPlatformConfigMap } from './partners'
import { getRevealedTheme } from './seasons-theme'
import { createSupabaseAdmin } from './supabase-admin'
import type { ChatbotTokenContext } from './chatbot-tokens'

export async function loadChatbotContext(): Promise<ChatbotTokenContext> {
  const admin = createSupabaseAdmin()
  const season = await getCurrentSeason()
  if (!season) throw new Error('no current season -- chatbot cannot build its knowledge base without one')
  const [founding, cfg, revealCfg, revealedTheme] = await Promise.all([
    getFoundingStatus(),
    getPlatformConfigMap(),
    admin.from('platform_config').select('value').eq('key', 'championship_points_reveal_at').maybeSingle(),
    getRevealedTheme(season.id),
  ])

  const priceRaw = Number(cfg.get('membership_creator_price_usd') ?? 0)
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null
  const interval = String(cfg.get('membership_billing_interval') ?? 'month')

  return {
    season,
    membership: { price, interval, founding: { cap: founding.cap } },
    championshipRevealAt: (revealCfg.data?.value as string | undefined) ?? null,
    revealedTheme,
    now: new Date(),
  }
}
