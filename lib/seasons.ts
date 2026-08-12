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

  // ── 3-stage tournament structure (preliminary -> semifinal -> final) ──
  // The tournament runs in two judged stages:
  //   application_* = PRELIMINARY (예선, 자유작, up to max_applicants; min_participants floor)
  //   main_round_*  = MAIN ROUND (본선, the final stage). "main_round" is the
  //                   historical column name. Entrants = top_n_advance, computed
  //                   from the advance_* policy below; the top 1/2/3 are awarded.
  //
  // Preliminary shortfall (< min_participants) triggers DEFERRAL -- extend the
  // application deadline, never a rollover: a free Season 0 cannot carry
  // applicants into a paid season. The cron extends application_close_at by
  // defer_extension_days, up to max_defer_count times (application_defer_count
  // tracks how many extensions have fired).
  min_participants: number
  application_defer_count: number
  defer_extension_days: number
  max_defer_count: number
  // The floor that governs what happens once max_defer_count is exhausted.
  // Nullable on purpose (HQ 2026-08-12): a season with no floor set is not
  // "no floor enforced" -- defer_season_schedule treats NULL as "always hold
  // for manual review" (fail-closed), same posture as the pre-existing
  // "cap reached -> admin decides" policy this floor formalizes with a number.
  absolute_min_participants: number | null
  // Preliminary -> main round advancement policy. top_n_advance stores the
  // computed RESULT; computeAdvanceCount() is the single source of the math
  // (clamp(round(N * advance_pct), advance_min, advance_max)).
  advance_pct: number
  advance_min: number
  advance_max: number

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

  // Prelim fairness hold ([[project-prelim-load-structure]]). _hold_enabled makes
  // a prelim submission land held (invisible) so it cannot be copied by a later
  // entrant; _auto_publish lets season-tick release the whole cohort at
  // application_close_at instead of an admin clicking. Both default false and
  // are base-table only (never on seasons_public).
  studio_prelim_hold_enabled: boolean
  studio_prelim_auto_publish: boolean

  application_open_at: string | null
  application_close_at: string | null
  // ★Declared 2026-08-08. The COLUMN has existed since season0_3stage (it is in
  // the seasons_public select list too) -- what was missing was this line, so
  // nothing downstream could read it and the submission receipt was reported as
  // blocked on a column that already existed. Absence from a type is not
  // absence from the database.
  scoring_start_at: string | null
  scoring_complete_at: string | null
  main_round_start_at: string | null
  main_round_end_at: string | null
  awards_announcement_at: string | null
  // ★When the preliminary result mail goes out. A SCHEDULE, not a marker --
  // prelim_released_at (already on the base table) is the marker that says the
  // hold was actually lifted. Keeping the two apart is the scoring_complete_at
  // lesson: one column that meant both "planned" and "done" let the planned
  // value silently disable the done check, and season_0 would never have
  // produced a Top N.
  // ★ON seasons_public since 2026-08-09 (the view went 66 -> 68 columns). It was
  // base-table-only for one day, and that mattered: getCurrentSeason and
  // getSeasonById read the view with select('*'), which does NOT fail on a
  // missing column -- it returns a row that silently lacks it. The immediate
  // submission receipt renders its bullets from this row, so the one date head
  // office had just engraved would have been omitted rather than shown, and the
  // email-tick sweep (which reads the base table) could not have repaired it:
  // executeSend's dedup treats the receipt as already sent.
  prelim_results_announcement_at: string | null
  // Community vote window. On the seasons_public view since
  // main_round_theme_public_2026-07 (a schedule, not a secret). Drives the
  // Watch "voting" banner stage + the 🔥 vote badge window.
  community_vote_start_at: string | null
  community_vote_end_at: string | null

  // Public theme (#6 hybrid model), shown openly. The secret main_round_twist
  // and its legacy main_round_theme fallback live only on the base table and
  // never travel through getSeasonById, which reads the secret-free
  // seasons_public view. See getThemeDisplay / lib/seasons-theme.
  season_theme: string | null
  // PUBLIC main-round theme/brief (e.g. "OXXOVO Beauty CF"). Shown to the
  // audience from the "Judging Complete" stage as a come-back teaser, and to
  // finalists in their submission card. Now ON the seasons_public view
  // (main_round_theme_public_2026-07 migration), so it IS populated at runtime.
  // The SECRET surprise element, if any, lives in main_round_twist (still off
  // the view, still reveal-gated) -- not here. (TK 2026-07-12: A = public/early.)
  main_round_theme: string | null
  // Short display label for main_round_theme (e.g. "Cosmetic Commercial Film").
  // main_round_theme is a full brief -- 901 chars / 10 lines for season 0 -- and
  // every surface that shows it is a one-line slot. So the UI shows THIS and
  // links to /rules for the full text; the scorer keeps using main_round_theme
  // verbatim (batch.ts), which is the whole point of splitting them.
  // Deliberately NOT season_theme: that stays NULL for season 0 because the
  // preliminary is free-form, and it renders on season-wide surfaces (lobby,
  // /tournament, studio) that prelim entrants see. (TK 2026-07-15)
  main_round_theme_label: string | null
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

  // ★Is this row test data? ONE fact, and not the same claim as "hide it".
  // Visibility is derived from it (see lib/lobby.ts isFixtureSeason). DEFAULT
  // true in the DB, so a season is a fixture until a human writes false --
  // forgetting hides a season instead of leaking a rehearsal onto the lobby.
  // ★Optional, and the reason narrowed on 2026-08-09: seasons_public carries it
  // now (66 -> 68 columns), so the view is no longer why it can be missing. What
  // is left is a select list that does not name it. `undefined` therefore still
  // means "this read could not see the column", which is a different thing from
  // `false` -- so it stays optional rather than becoming a required boolean.
  is_fixture?: boolean | null

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
// always shown; twist (main_round_twist) is shown ONLY once revealed. Pure and
// side-effect free, so it is safe to call on the client — but it can only ever
// reveal a twist that the caller already holds, and the client never holds one.
// (The deprecated main_round_theme is the PUBLIC main-round brief now, NOT a
// twist fallback — it drives the Watch banner + season_theme, so it must not
// leak into the twist slot; TK 2026-07-13.)
export function getThemeDisplay(s: ThemeSource, now: Date = new Date()): ThemeDisplay {
  const revealed = isTwistRevealed(s, now)
  const twistRaw = s.main_round_twist ?? null
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
  // Reads the seasons_public VIEW, not the base table. The view excludes
  // main_round_twist, so nothing fetched through this (browser-reachable) path
  // can ever carry the twist before reveal. Server code that genuinely needs the
  // secret reads the base table via the service role — see
  // lib/seasons-theme.getRevealedTheme.
  //
  // main_round_theme is NOT secret and IS on the view: TK ruled it a public
  // come-back teaser on 2026-07-12, reversing the theme-hybrid posture for that
  // one column (reports/main_round_theme_public_2026-07.sql). This comment said
  // otherwise until 2026-08-06, when a column-list probe against the live view
  // showed 66 columns with main_round_theme present and main_round_twist absent.
  //
  // ★The view is granted to anon/authenticated only. A service_role read of
  // seasons_public gets 42501 permission denied — measured, not assumed. Server
  // code holding the admin client must read the base seasons table instead.
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
//
// ★STANDING RISK, measured 2026-08-10, not fixed here — a scheduling fact, not
// a code bug: season_0.application_open_at is 2026-09-09 (still future), so
// today this function resolves season_0 only through the "soonest upcoming"
// fallback below, not the "opened" branch. That fallback has no is_fixture
// filter. Until 2026-09-09 00:00 PT, ANY row (including a rehearsal fixture
// like season_test) that gets a past application_open_at instantly wins the
// "opened" branch and hijacks the pick — exactly what happened on 2026-08-08
// when season_test's leftover open date (2026-07-06) took over after
// season_0's own open moved to 9/9. EXIT CONDITION: this risk disappears on
// its own once season_0's application_open_at passes (2026-09-09 00:00 PT) --
// its own row then wins the "opened" branch and nothing else can outrank it
// on recency without also being in the future.
export async function getCurrentSeason(): Promise<Season | null> {
  const nowIso = new Date().toISOString()

  // Primary: the most recently opened season (application_open_at <= now).
  // `.lte` excludes NULL application_open_at automatically. During a normal
  // application week this resolves to that week's season; in the brief gap
  // before the next Monday it stays on the latest opened season.
  //
  // Reads seasons_public (NOT the base table): this runs through the fixed-anon
  // browser client, and anon's SELECT on public.seasons was revoked by the
  // theme-hybrid migration. The view is granted to anon/authenticated and
  // exposes application_open_at/close_at; the secret twist/theme columns stay
  // out of it. (getSeasonById already reads the view -- keep them consistent.)
  const { data: opened, error: openedErr } = await supabase
    .from('seasons_public')
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
    .from('seasons_public')
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

// `now` is injectable for the same reason getThemeDisplay's is: this decides what
// the landing hero shows, and the case that was wrong (the instant applications
// close) cannot be asserted against the wall clock. Callers pass nothing.
// ★The boundary is `>=`, not `>`. It used to be `>`, which left the deadline
// instant itself OPEN while every other rule in the codebase had already closed
// it: resolveSeasonCta below (`now < closeAt` = open), getBannerStage's judging
// branch (`t >= close`), and lobby's mode machine (`t >= close` -> live). At
// exactly application_close_at the landing therefore ran a countdown under a "Join
// the waitlist" CTA, and a submission was still accepted after its own deadline.
// One instant wide, and found by sweeping the timeline rather than by picking
// dates. Callers affected: the two apply gates and the two studio submit gates.
export function isApplicationClosed(
  season: Pick<Season, 'application_close_at'>,
  now: Date = new Date(),
): boolean {
  if (!season.application_close_at) return false
  return now.getTime() >= Date.parse(season.application_close_at)
}

// Public CTA for a season by where we are in its application window -- shared by
// the home hero and /tournament/[id] so they stay consistent. Fully date-driven
// (application_open_at/close_at), no hardcode ([[feedback-no-hardcode]]):
//   before open  -> pre-register ("get notified")
//   open..close  -> apply
//   after close  -> waitlist (next season)
export function resolveSeasonCta(
  season: Pick<Season, 'name' | 'application_open_at' | 'application_close_at'>,
  at: Date = new Date(),
): { href: string; label: string } {
  const now = at.getTime()
  const openAt = season.application_open_at ? new Date(season.application_open_at).getTime() : null
  const closeAt = season.application_close_at ? new Date(season.application_close_at).getTime() : null
  const isOpen = openAt != null && now >= openAt && (closeAt == null || now < closeAt)
  if (isOpen) return { href: '/apply', label: `Apply to ${season.name}` }
  if (openAt != null && now < openAt) {
    return { href: '/pre-register', label: 'Get notified when applications open' }
  }
  return { href: '/pre-register', label: 'Join the waitlist' }
}

// True before the application window opens. The CTA on /tournament already hides
// /apply until open, but a direct visit to /apply must not be able to submit
// early -- the open date is enforced server-side here too. No open date set ->
// treat as open (do not block) so seasons without a scheduled open still work.
export function isBeforeApplicationOpen(season: Season): boolean {
  if (!season.application_open_at) return false
  return new Date() < new Date(season.application_open_at)
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

// ─── Preliminary → semifinal advancement count ──────────────────────────
// Single source of truth for how many preliminary (예선) entrants advance to
// the semifinal (main_round). Pure and side-effect free:
//   clamp(round(eligibleCount × advance_pct), advance_min, advance_max)
// further capped at eligibleCount (never advance more than exist). `eligibleCount`
// is the number of scored/eligible preliminary entrants. The result is what gets
// written to seasons.top_n_advance when the preliminary closes — there is no
// per-season hardcoded N ([[feedback-no-hardcode]]). Date-independent.
export function computeAdvanceCount(
  eligibleCount: number,
  policy: Pick<Season, 'advance_pct' | 'advance_min' | 'advance_max'>,
): number {
  if (eligibleCount <= 0) return 0
  const raw = Math.round(eligibleCount * policy.advance_pct)
  const clamped = Math.max(policy.advance_min, Math.min(policy.advance_max, raw))
  return Math.min(clamped, eligibleCount)
}

// Whether seasons.top_n_advance holds the FINAL advancement count or a stale
// default. The cron (advance_season_finalists) computes the real N only at
// scoring_complete_at — before then top_n_advance is whatever default the row
// was seeded with (e.g. 50), which would mislead applicants on public pages.
// `now` is injectable so SSR/tests stay deterministic.
export function isAdvanceCountDecided(
  season: Pick<Season, 'scoring_complete_at'>,
  now: number = Date.now(),
): boolean {
  if (!season.scoring_complete_at) return false
  return now >= new Date(season.scoring_complete_at).getTime()
}

// Human label for how many preliminary entrants advance to the main round as
// Finalists, designed to read after "The "/"the ". Before the count is decided
// it states the POLICY ("top 10% (10–50)"); after, the computed number
// ("Top 50"). Single source so page/faq/rules stay in sync ([[feedback-no-hardcode]]).
// NB: "Finalist" = main-round advancer (tournament). Distinct from "Founding
// Creator" = the first N membership signups (see formatAccessCopy).
export function advanceCountLabel(
  season: Pick<
    Season,
    'scoring_complete_at' | 'top_n_advance' | 'advance_pct' | 'advance_min' | 'advance_max'
  >,
  now: number = Date.now(),
): string {
  if (isAdvanceCountDecided(season, now)) return `Top ${season.top_n_advance}`
  const pct = Math.round(season.advance_pct * 100)
  return `top ${pct}% (${season.advance_min}–${season.advance_max})`
}

// Format a season deadline (UTC timestamptz) in OXXOVO's canonical competition
// timezone (US Pacific) so the shown date is stable regardless of the visitor's
// locale. Returns null for a missing/invalid value -> caller hides the line.
export function formatDeadlinePT(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} · ${time} PT`
}

// Canonical "what does it cost to compete" copy. Two separate things, both
// config-driven (no hardcoded amounts — [[feedback-no-hardcode]]):
//   1) tournament entry fee (season.entry_fee, 0 for Season 0)
//   2) creator-membership access: the first `foundingCap` signups join free as
//      Founding Creators for `foundingMonths`, then `price`/`interval`.
// Falls back to fee-only copy when membership is off/unconfigured (dark launch).
export function formatAccessCopy(opts: {
  seasonName: string
  entryFee: number
  membershipEnabled: boolean
  price: number | null
  interval: string
  foundingMonths: number | null
  foundingCap: number
  concise?: boolean
}): string {
  const { seasonName, entryFee, membershipEnabled, price, interval, foundingMonths, foundingCap, concise } = opts
  const hasMembership = membershipEnabled && !!price && !!foundingMonths && foundingCap > 0
  const term = foundingMonths === 12 ? 'one year' : `${foundingMonths} months`
  const priceText = price != null ? `$${price.toFixed(2)}/${interval}` : ''

  if (concise) {
    if (!hasMembership) return entryFee === 0 ? 'No entry fee.' : `$${entryFee.toLocaleString()} entry fee.`
    const fee = entryFee === 0 ? 'No entry fee' : `$${entryFee.toLocaleString()} entry fee`
    return `${fee}. Competing requires a creator membership — the first ${foundingCap} join free for ${term}, then ${priceText}.`
  }

  const feePart = entryFee === 0
    ? `There is no entry fee for ${seasonName}.`
    : `${seasonName} has a $${entryFee.toLocaleString()} entry fee.`
  if (!hasMembership) {
    return `${feePart} We believe creators should compete on merit, not budget.`
  }
  return `${feePart} Competing on OXXOVO requires a creator membership: the first ${foundingCap} creators join free as Founding Creators for ${term}, then it's ${priceText}. We believe creators should compete on merit, not budget.`
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
