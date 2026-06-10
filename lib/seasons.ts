import { supabase } from './supabase'

export type AIModel = {
  name: string
  provider?: string
  is_integrity?: boolean
}

// Non-cash perks awarded per rank. Cash stays in prize_first/second/third
// columns. Every field is optional — e.g. only 1st place receives the
// physical trophy in Season 0, while every rank receives a badge and a
// grand-final ticket. Korean/English text is stored directly so future
// seasons can rename perks without a code change.
export type RankAward = {
  trophy_ko?: string
  trophy_en?: string
  badge_ko?: string
  badge_en?: string
  grand_final_ko?: string
  grand_final_en?: string
}

export type AwardPrizes = Record<string, RankAward | undefined>

export type Season = {
  id: string
  name: string
  // Human-facing label ("OXXOVO Genesis Season 0"). `name` stays as the
  // codename ("GENESIS"); everything user-facing should read display_name.
  display_name: string
  season_number: number
  status: string

  max_applicants: number
  top_n_advance: number
  application_video_min_seconds: number
  application_video_max_seconds: number

  // prize_first/second/third are GENERATED ALWAYS AS STORED in Postgres
  // (computed from total_prize_pool * prize_*_pct / 100). Read-only at the
  // application layer — only the percentages and pool are writable.
  prize_first: number
  prize_second: number
  prize_third: number
  prize_first_pct: number
  prize_second_pct: number
  prize_third_pct: number
  total_prize_pool: number
  entry_fee: number
  award_prizes: AwardPrizes

  // Single-value column retained for backwards compatibility; new code reads
  // the min/max range below. Drop in a follow-up migration once nothing
  // references it.
  main_round_video_seconds: number
  main_round_video_min_seconds: number
  main_round_video_max_seconds: number
  theme_announcement_minutes_before: number
  submission_hours: number
  // Cron fires the deadline-reminder email once per entry in this array,
  // e.g. [24, 6] → reminder at 24h-remaining and again at 6h-remaining.
  deadline_reminder_hours: number[]
  community_vote_weight: number
  ai_score_weight: number

  scoring_intent_clarity_weight: number
  scoring_execution_weight: number
  scoring_originality_weight: number
  scoring_integrity_weight: number

  ai_models: AIModel[]

  flag_integrity_threshold: number
  flag_spread_threshold: number

  // Studio (Session 6). Only read from the base table (service role) via
  // lib/studio; the public seasons_public view does not need these.
  studio_round: 'application' | 'main' | 'both'
  studio_max_generations_per_round: number

  application_open_at: string | null
  application_close_at: string | null
  scoring_complete_at: string | null
  main_round_start_at: string | null
  main_round_end_at: string | null
  awards_announcement_at: string | null

  // Public theme (#6 hybrid model), shown openly. The secret main_round_twist
  // and its legacy main_round_theme fallback live only on the base table and
  // never travel through getSeasonById, which reads the secret-free
  // seasons_public view. See getThemeDisplay / lib/seasons-theme.
  season_theme: string | null
  // Deprecated (kept for legacy #1 main-round UI refs only). NOT on the
  // seasons_public view, so it is always undefined at runtime through
  // getSeasonById -- no twist can leak. TODO 지수2: migrate MainRoundCard /
  // main-results off season.main_round_theme to getThemeDisplay, then drop.
  main_round_theme: string | null
  allowed_video_platforms: string[]
  // Member Hosted Tournament (partner) fields.
  host_type: 'official' | 'partner'
  host_user_id: string | null
  prize_pool_escrow_status: 'not_required' | 'pending' | 'paid' | 'refunded'
  prize_pool_escrow_paid_at: string | null
  commission_rate_override: number | null
  prize_funding_mode: PrizeFundingMode

  // Lobby (home TOURNAMENTS section). poster_url null -> gradient fallback;
  // lobby_featured pins the card first.
  poster_url: string | null
  lobby_featured: boolean

  created_at: string
  updated_at: string
}

// Source shape for the theme-display helper. main_round_twist / main_round_theme
// are optional because the public Season object (from the view) never carries
// them — only a server-side read of the base table provides them.
export type ThemeSource = {
  season_theme?: string | null
  main_round_twist?: string | null
  main_round_theme?: string | null
  main_round_start_at: string | null
  theme_announcement_minutes_before: number
}

export type ThemeDisplay = {
  theme: string | null
  // null until the twist is revealed (or when no secret was provided, e.g. on
  // the client). Never expose a non-null twist before isTwistRevealed() is true.
  twist: string | null
  revealed: boolean
}

// The twist becomes public at main_round_start_at minus
// theme_announcement_minutes_before. Reuses the existing announcement lead
// time — no separate reveal column.
export function isTwistRevealed(
  s: Pick<ThemeSource, 'main_round_start_at' | 'theme_announcement_minutes_before'>,
  now: Date = new Date(),
): boolean {
  if (!s.main_round_start_at) return false
  const startMs = new Date(s.main_round_start_at).getTime()
  const revealMs = startMs - s.theme_announcement_minutes_before * 60_000
  return now.getTime() >= revealMs
}

// Single source of truth for how theme + twist render. theme (season_theme) is
// always shown; twist (main_round_twist, falling back to the deprecated
// main_round_theme) is shown ONLY once revealed. Pure and side-effect free, so
// it is safe to call on the client — but it can only ever reveal a twist that
// the caller already holds, and the client never holds one.
export function getThemeDisplay(s: ThemeSource, now: Date = new Date()): ThemeDisplay {
  const revealed = isTwistRevealed(s, now)
  const twistRaw = s.main_round_twist ?? s.main_round_theme ?? null
  return {
    theme: s.season_theme ?? null,
    twist: revealed ? twistRaw : null,
    revealed,
  }
}

// Prize-funding mode (seasons.prize_funding_mode). Single source of truth for
// the allowed values; the DB CHECK mirrors this list. The platform-wide default
// lives in platform_config (partner_default_prize_funding_mode), not here.
//   entry_pool         — funded by entry/platform; partner deposits nothing.
//   partner_guaranteed — partner guarantees the pool and must escrow it.
export const PRIZE_FUNDING_MODES = ['entry_pool', 'partner_guaranteed'] as const
export type PrizeFundingMode = (typeof PRIZE_FUNDING_MODES)[number]

// The escrow status a season starts in given its funding mode. Only a
// guaranteed pool needs escrow; an entry-pool tournament requires none. This is
// the single place the mode -> escrow relationship is encoded.
export function initialEscrowStatusForFundingMode(
  mode: string,
): 'not_required' | 'pending' {
  return mode === 'partner_guaranteed' ? 'pending' : 'not_required'
}

// Public-visibility gate. A season is public once it's off draft AND its escrow
// is in a settled state — 'not_required' (entry-pool / official) or 'paid'
// (a guaranteed pool the admin has confirmed). A 'pending' or 'refunded' escrow
// keeps it hidden. Because the funding mode sets the escrow status at creation,
// this guard requires payment only for guaranteed-prize tournaments, with no
// per-mode branching. Apply anywhere seasons are listed publicly.
export function isSeasonPubliclyVisible(
  season: Pick<Season, 'status' | 'prize_pool_escrow_status'>,
): boolean {
  if (season.status === 'draft') return false
  return (
    season.prize_pool_escrow_status === 'not_required' ||
    season.prize_pool_escrow_status === 'paid'
  )
}

const CURRENT_SEASON_ID =
  process.env.NEXT_PUBLIC_OXXOVO_CURRENT_SEASON || 'season_0'

export function getCurrentSeasonId(): string {
  return CURRENT_SEASON_ID
}

export async function getSeasonById(id: string): Promise<Season | null> {
  // Reads the seasons_public VIEW, not the base table. The view excludes the
  // secret theme columns (main_round_twist, main_round_theme), so nothing
  // fetched through this (browser-reachable) path can ever carry the twist
  // before reveal. Server code that genuinely needs the secret reads the base
  // table via the service role — see lib/seasons-theme.getRevealedTheme.
  const { data, error } = await supabase
    .from('seasons_public')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[seasons] failed to fetch season:', id, error.message)
    return null
  }
  return data as Season
}

// "Current season" used to be pinned by the build-time env var
// NEXT_PUBLIC_OXXOVO_CURRENT_SEASON. That breaks the weekly auto-rotation model
// (see [[project-weekly-season-system]]): a new season opens applications every
// Monday, so the public pointer must advance on its own with no redeploy. We
// now resolve it dynamically from the DB by application window — fully dynamic,
// no env var, so the seasons table is the single source of truth.
//
// Semantics: the "current" season for public-facing pages (home countdown,
// /apply) is the most recently opened season — the one applicants can act on
// right now. Because a season's main round / scoring run in later weeks while
// the next season's application window is already open, several seasons are
// in-flight at once; the newest-opened one is the correct application target.
export async function getCurrentSeason(): Promise<Season | null> {
  const nowIso = new Date().toISOString()

  // Primary: the most recently opened season (application_open_at <= now).
  // `.lte` excludes NULL application_open_at automatically. During a normal
  // application week this resolves to that week's season; in the brief gap
  // before the next Monday it stays on the latest opened season.
  const { data: opened, error: openedErr } = await supabase
    .from('seasons')
    .select('*')
    .lte('application_open_at', nowIso)
    .order('application_open_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openedErr) {
    console.error('[seasons] current-season (opened) query failed:', openedErr.message)
    return null
  }
  if (opened) return opened as Season

  // Fallback (pre-launch): nothing has opened yet — surface the soonest
  // upcoming season so the site can render an "applications open soon" state.
  const { data: upcoming, error: upcomingErr } = await supabase
    .from('seasons')
    .select('*')
    .order('application_open_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (upcomingErr) {
    console.error('[seasons] current-season (upcoming) query failed:', upcomingErr.message)
    return null
  }
  return (upcoming as Season) ?? null
}

export async function getActiveApplicationCount(
  seasonId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_active_application_count', {
    p_season_id: seasonId,
  })

  if (error) {
    console.error('[seasons] failed to fetch active count:', error.message)
    return 0
  }
  return typeof data === 'number' ? data : Number(data) || 0
}

export function isApplicationClosed(season: Season): boolean {
  if (!season.application_close_at) return false
  return new Date() > new Date(season.application_close_at)
}

export function isCapacityFull(season: Season, count: number): boolean {
  return count >= season.max_applicants
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus-4-5': 'Claude Opus 4.5',
  'gpt-4o': 'GPT-4o',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
}

export function formatModelName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] || modelId
}

export function formatWeightPercent(weight: number | string): string {
  const n = typeof weight === 'number' ? weight : Number(weight)
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(n * 100)}%`
}

export function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1]
}

export function formatAiModelList(models: AIModel[]): string {
  return formatList(models.map((m) => formatModelName(m.name)))
}

export function formatAiProviderList(models: AIModel[]): string {
  const providers = models.map((m) => m.provider).filter((p): p is string => !!p)
  return formatList(providers)
}

export function getIntegrityModel(models: AIModel[]): AIModel | null {
  return models.find((m) => m.is_integrity) || null
}

// ─── Main round submission helpers ──────────────────────────────────────
// Single-submission model ([[project-main-round-single-submission]]):
// one submission per selected creator, no edits after submit. Reason union
// maps 1:1 to system_messages 'submission_block' rows (key=`main_round_block_*`).
export type SubmitBlockReason =
  | 'not_selected'           // status가 'selected'가 아닌 응모 단계 상태
  | 'before_start'           // now < main_round_start_at
  | 'after_close'            // now >= main_round_end_at
  | 'season_dates_not_set'   // start_at or end_at NULL

// reason: null → 별도 UI 분기로 전환해야 하는 상태 (main_round_submitted /
// awarded / rejected / flagged). 호출자가 status를 직접 보고 제출본 / 결과 /
// 검토 대기 카드 렌더. reason이 있는 경우만 message 표시 대상.
export type SubmitCheck =
  | { ok: true }
  | { ok: false; reason: SubmitBlockReason | null }

// Minimal shape — callers can pass any object with status; full
// GenesisApplication row works without a cast.
type ApplicationLike = { status: string }

// When the theme should appear in the UI countdown → reveal transition.
// Returns null when start_at is missing (season schedule not yet set).
export function getThemeRevealTime(season: Season): Date | null {
  if (!season.main_round_start_at) return null
  const startMs = new Date(season.main_round_start_at).getTime()
  const offsetMs = season.theme_announcement_minutes_before * 60 * 1000
  return new Date(startMs - offsetMs)
}

export function isMainRoundThemeRevealed(
  season: Season,
  now: Date = new Date(),
): boolean {
  const revealTime = getThemeRevealTime(season)
  if (!revealTime) return false
  return now >= revealTime
}

export function canSubmitMainRound(
  app: ApplicationLike,
  season: Season,
  now: Date = new Date(),
): SubmitCheck {
  // 별도 UI 화면으로 분기되는 상태 — reason 없이 false. 호출자가 status로
  // 제출본 (main_round_submitted) / 결과 (awarded/rejected) / 검토 대기
  // (flagged) 카드를 자체 렌더.
  if (
    app.status === 'main_round_submitted' ||
    app.status === 'awarded' ||
    app.status === 'rejected' ||
    app.status === 'flagged'
  ) {
    return { ok: false, reason: null }
  }
  // pending / verifying / eligible / waitlist → Top 50 미선정 메시지
  if (app.status !== 'selected') {
    return { ok: false, reason: 'not_selected' }
  }
  if (!season.main_round_start_at || !season.main_round_end_at) {
    return { ok: false, reason: 'season_dates_not_set' }
  }
  const start = new Date(season.main_round_start_at)
  const end = new Date(season.main_round_end_at)
  if (now < start) return { ok: false, reason: 'before_start' }
  if (now >= end) return { ok: false, reason: 'after_close' }
  return { ok: true }
}

// Derive panel label from model count (3 → "Triple-AI", 4 → "Quad-AI", etc.)
export function formatPanelLabel(models: AIModel[]): string {
  const PREFIX_BY_COUNT: Record<number, string> = {
    2: 'Dual',
    3: 'Triple',
    4: 'Quad',
    5: 'Penta',
  }
  const count = models.length
  return `${PREFIX_BY_COUNT[count] ?? `${count}-Model`}-AI`
}
