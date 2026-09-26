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
import { getCurrentSeason, type ThemeDisplay } from './seasons'
import { getFoundingStatus } from './membership'
import { getPlatformConfigMap } from './partners'
import { getRevealedTheme } from './seasons-theme'
import { createSupabaseAdmin } from './supabase-admin'
import type { ChatbotTokenContext } from './chatbot-tokens'

// No season currently scheduled -> no theme to reveal. Same shape
// getRevealedTheme() returns pre-reveal, so 'main_theme'/'required_element'
// resolve to null exactly the way they already do for an unrevealed season --
// one null policy, not a second one for "no season at all".
const NO_THEME: ThemeDisplay = { prelimTheme: null, mainTheme: null, twist: null, twistRevealed: false }

export async function loadChatbotContext(): Promise<ChatbotTokenContext> {
  const admin = createSupabaseAdmin()
  const season = await getCurrentSeason()
  // ★HQ 2026-09-27 (Phase 0 chatbot fix): this used to throw when no season was
  // scheduled, which every caller (chat widget, Triple-AI Review, the
  // inbound-email auto-reply) surfaces as a hard failure -- the chat widget
  // specifically turns it into a 502 with no reply at all. A season with
  // nothing scheduled (e.g. season_0 between competitions, 2026-09-26 onward)
  // is a normal state, not an error: the bot should still answer FAQ/rules/
  // general questions and season-specific tokens should read as "not
  // available" (the SAME marker an unrevealed field already renders as -- see
  // lib/chatbot-tokens.ts), not crash the whole reply.
  const [founding, cfg, revealCfg, revealedTheme] = await Promise.all([
    getFoundingStatus(),
    getPlatformConfigMap(),
    admin.from('platform_config').select('value').eq('key', 'championship_points_reveal_at').maybeSingle(),
    season ? getRevealedTheme(season.id) : Promise.resolve(NO_THEME),
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
