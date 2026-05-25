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

  application_open_at: string | null
  application_close_at: string | null
  scoring_complete_at: string | null
  main_round_start_at: string | null
  main_round_end_at: string | null
  awards_announcement_at: string | null

  created_at: string
  updated_at: string
}

const CURRENT_SEASON_ID =
  process.env.NEXT_PUBLIC_OXXOVO_CURRENT_SEASON || 'season_0'

export function getCurrentSeasonId(): string {
  return CURRENT_SEASON_ID
}

export async function getSeasonById(id: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[seasons] failed to fetch season:', id, error.message)
    return null
  }
  return data as Season
}

export async function getCurrentSeason(): Promise<Season | null> {
  return getSeasonById(CURRENT_SEASON_ID)
}

export async function getActiveApplicationCount(
  seasonId: string = CURRENT_SEASON_ID
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
