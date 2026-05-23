import { supabase } from './supabase'

export type AIModel = {
  name: string
  provider?: string
  is_integrity?: boolean
}

export type Season = {
  id: string
  name: string
  season_number: number
  status: string

  max_applicants: number
  top_n_advance: number
  application_video_min_seconds: number
  application_video_max_seconds: number

  prize_first: number
  prize_second: number
  prize_third: number
  total_prize_pool: number
  entry_fee: number

  main_round_video_seconds: number
  theme_announcement_minutes_before: number
  submission_hours: number
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
