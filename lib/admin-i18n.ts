'use client'

// Admin console i18n (한국어/English) — admin pages only, public site unaffected.
//
// Pattern: useSyncExternalStore + module-local listener set.
//   - Hydration-safe: getServerSnapshot returns SERVER_DEFAULT ('en').
//   - First client render matches server, then re-renders with detected lang
//     (localStorage > navigator.language > 'en').
//   - Toggle (setAdminLang) writes localStorage AND notifies in-tab listeners.
//   - The 'storage' event keeps other tabs in sync.
//
// Usage:
//   const t = useT()
//   <button>{t.common.save}</button>
//
//   const lang = useAdminLang()      // 'ko' | 'en'
//   setAdminLang('ko')               // toggle from any client component

import { useSyncExternalStore } from 'react'

export type Lang = 'ko' | 'en'

const STORAGE_KEY = 'oxxovo_admin_lang'
const SERVER_DEFAULT: Lang = 'en'

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback)
  }
  return () => {
    listeners.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', callback)
    }
  }
}

function getSnapshot(): Lang {
  if (typeof window === 'undefined') return SERVER_DEFAULT
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'ko' || saved === 'en') return saved
  const nav = window.navigator.language?.toLowerCase() ?? ''
  return nav.startsWith('ko') ? 'ko' : 'en'
}

function getServerSnapshot(): Lang {
  return SERVER_DEFAULT
}

export function useAdminLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function setAdminLang(lang: Lang) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, lang)
  listeners.forEach((l) => l())
}

export function useT(): Messages {
  const lang = useAdminLang()
  return MESSAGES[lang]
}

// ─────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────

export type Messages = {
  layout: {
    admin_console: string
    admin_mode_banner: string
    view_public_site: string
    sign_out: string
    signing_out: string
    soon: string
    nav: {
      dashboard: string
      seasons: string
      applications: string
      pre_registrations: string
      contacts: string
      winners: string
      partners: string
      emails: string
      credits: string
      promo: string
      actors: string
      music: string
      messages: string
    }
  }
  dashboard: {
    title: string
    welcome: (name: string) => string
    stat_total_seasons: string
    stat_current_season: string
    stat_total_applicants: string
    recent_seasons: string
    view_all: string
    col_name: string
    col_number: string
    col_status: string
    col_prize_pool: string
    col_capacity: string
    edit: string
    season_label: (n: number, status: string) => string
    empty_prefix: string
    empty_link: string
    empty_suffix: string
    quick_actions: string
    new_season: string
    manage_seasons: string
  }
  status: {
    active: string
    draft: string
    upcoming: string
    closed: string
    completed: string
  }
  seasons_list: {
    title: string
    subtitle: string
    new_season: string
    deleted_banner: string
    load_failed: (msg: string) => string
    col_name: string
    col_number: string
    col_status: string
    col_prize_pool: string
    col_capacity: string
    col_top_n: string
    col_apps_open: string
    edit: string
    empty_prefix: string
    empty_link: string
    empty_suffix: string
  }
  season_new: {
    back: string
    title: string
    description: string
  }
  season_edit: {
    back: string
    title_prefix: string
    season_label: (n: number) => string
    last_updated: (date: string) => string
    saved_banner: string
    danger_zone: string
  }
  season_form: {
    validation_failed: string
    saved: string
    group_info: string
    group_capacity: string
    group_video: string
    group_timing: string
    group_pool: string
    group_split: string
    group_scoring: string
    group_ai_weights: string
    group_ai_panel: string
    group_integrity: string
    group_schedule: string
    field_name: string
    field_season_number: string
    field_status: string
    field_max_applicants: string
    field_top_n: string
    group_advancement: string
    field_min_participants: string
    field_defer_days: string
    field_max_defer: string
    field_advance_pct: string
    field_advance_min: string
    field_advance_max: string
    hint_main_round_semifinal: string
    hint_advance_pct: string
    hint_defer: string
    field_video_app_min: string
    field_video_app_max: string
    field_video_main: string
    field_theme_reveal: string
    field_submission_hours: string
    field_total_pool: string
    field_entry_fee: string
    field_1st_place: string
    field_2nd_place: string
    field_3rd_place: string
    field_community_vote: string
    field_ai_score: string
    field_intent: string
    field_execution: string
    field_originality: string
    field_integrity: string
    field_flag_integrity: string
    field_flag_spread: string
    field_app_open: string
    field_app_close: string
    field_scoring_complete: string
    field_main_start: string
    field_main_end: string
    field_awards: string
    hint_07: string
    hint_03: string
    hint_0_100: string
    split_total_label: string
    split_total_bad: string
    saving: string
    save_changes: string
    create_season: string
    save_caption: string
    ai_model_name_ph: string
    ai_provider_ph: string
    integrity_check: string
    add_ai_model: string
    remove_model_aria: string
    group_studio: string
    field_studio_round: string
    field_studio_max_gen: string
    studio_round_application: string
    studio_round_main: string
    studio_round_both: string
    hint_studio_round: string
    group_lobby: string
    field_poster_url: string
    field_lobby_featured: string
    hint_poster_url: string
  }
  delete: {
    button: string
    confirm_title: string
    confirm_body_lead: (name: string) => string
    confirm_body_type: string
    confirm_body_tail: string
    confirm_input_ph: (name: string) => string
    delete_forever: string
    deleting: string
    cancel: string
    delete_failed: string
  }
  login: {
    brand_tag: string
    title: string
    subtitle: string
    email: string
    password: string
    sign_in: string
    signing_in: string
    err_not_admin: string
    err_recovery_expired: string
    err_callback_failed: (reason?: string | null) => string
    err_missing_code: string
  }
  reset_password: {
    brand_tag: string
    title: string
    signed_in_as_prefix: string
    new_password: string
    confirm_password: string
    submit: string
    submitting: string
    success: string
    min_length: (n: number) => string
    mismatch: string
  }
  applications: {
    title: string
    subtitle: string
    season_select_label: string
    segment_all: string
    segment_pending: string
    segment_flagged: string
    segment_top50: string
    segment_waitlist: string
    segment_awarded: string
    segment_rejected: string
    // Judging axis -- orthogonal to the competition-status segments above.
    judging_axis_label: string
    judging_all: string
    judging_unjudged: string
    judging_in_progress: string
    judging_failed: string
    judging_completed: string
    segment_count: (n: number) => string
    search_placeholder: string
    sort_label: string
    sort_submitted_desc: string
    sort_submitted_asc: string
    sort_score_desc: string
    sort_name_asc: string
    csv_export: string
    csv_exported: (n: number) => string
    col_name: string
    col_email: string
    col_country: string
    col_status: string
    col_ai_service: string
    col_submitted: string
    col_score: string
    col_grade: string
    col_integrity: string
    empty: string
    score_pending: string
    // Recommendations panel (작업 5)
    recommendations_title: (n: number) => string
    recommendations_subtitle: string
    recommendations_empty: string
    recommendations_recommended_at: (date: string) => string
    recommendations_col_rank: string
    recommendations_col_score: string
    recommendations_apply_btn: string
    recommendations_apply_confirm_message: (n: number) => string
    recommendations_apply_confirm_btn: string
    recommendations_apply_cancel_btn: string
    recommendations_applied_at: (date: string, admin: string) => string
    recommendations_applied_status: string
    recommendations_flagged_section_title: string
    recommendations_flagged_section_note: string
    recommendations_total_label: (n: number) => string
    // applyRecommendation server action errors (작업 6)
    apply_rec_err_unauthorized: string
    apply_rec_err_season_not_found: string
    apply_rec_err_no_recommendations: string
    apply_rec_err_race_or_already_applied: string
    apply_rec_err_update_failed: string
  }
  application_detail: {
    back: string
    section_applicant: string
    section_statement: string
    section_video: string
    section_actions: string
    section_scoring: string
    section_integrity_review: string
    label_name: string
    label_email: string
    label_country: string
    label_channel: string
    label_ai_service: string
    label_submitted: string
    label_status: string
    label_award_rank: string
    no_country: string
    no_channel: string
    notes_label: string
    notes_placeholder: string
    notes_save: string
    notes_saving: string
    notes_saved: string
    status_change_label: string
    award_rank_label: string
    award_rank_none: string
    award_rank_1st: string
    award_rank_2nd: string
    award_rank_3rd: string
    save_status: string
    save_award: string
    scoring_placeholder: string
    scoring_no_data: string
    scoring_in_progress: string
    scoring_failed: string
    scoring_verified_score: string
    scoring_grade: string
    scoring_subscores: string
    scoring_intent: string
    scoring_execution: string
    scoring_originality: string
    scoring_integrity_weight: string
    scoring_judged_at: (date: string) => string
    scoring_cost: (usd: string) => string
    integrity_confidence_label: string
    integrity_score_label: string
    integrity_explanation_label: string
    integrity_recommendation_label: string
    integrity_high_warning: string
    ai_outputs_toggle: string
    ai_outputs_hide: string
  }
  video: {
    embed_failed: string
    open_external: string
    raw_url_label: string
    no_url: string
  }
  contacts: {
    title: string
    subtitle: string
    season_select_label: string
    search_placeholder: string
    csv_export: string
    col_season: string
    col_name: string
    col_email: string
    col_award: string
    col_phone: string
    col_address: string
    col_messenger: string
    col_filled_at: string
    pending_badge: string
    empty: string
    not_filled: string
  }
  pre_reg: {
    title: string
    subtitle: string
    season_select_label: string
    search_placeholder: string
    count_label: (n: number) => string
    csv_export: string
    col_email: string
    col_season: string
    col_utm_source: string
    col_utm_medium: string
    col_utm_campaign: string
    col_referrer: string
    col_status: string
    col_created_at: string
    empty: string
  }
  emails: {
    title: string
    subtitle: string
    season_select_label: string
    template_label: string
    status_label: string
    language_label: string
    search_placeholder: string
    template_all: string
    status_all: string
    language_all: string
    template_pre_registered: string
    template_application_received: string
    template_waitlisted: string
    template_selected_top50: string
    template_not_selected: string
    template_main_round_start: string
    template_submission_deadline: string
    template_results_announced: string
    template_awarded_contact_request: string
    status_sent: string
    status_failed: string
    status_skipped: string
    status_queued: string
    stat_total: string
    stat_sent: string
    stat_failed: string
    stat_skipped: string
    col_sent_at: string
    col_template: string
    col_recipient: string
    col_lang: string
    col_status: string
    col_subject: string
    col_error: string
    col_meta: string
    empty: string
    pager_prev: string
    pager_next: string
    pager_label: (start: number, end: number, total: number) => string
    retry_note: string
  }
  profile: {
    page_title: string
    header_brand: string
    log_out: string
    loading: string
    auth_required: string
    auth_required_action: string
    loading_failed: string
    section_my_application: string
    section_video: string
    section_status: string
    section_scoring: string
    section_winner_form: string
    section_history: string
    // P4d membership dashboard
    mem_section: string
    mem_tier_creator: string
    mem_tier_general: string
    mem_status_active: string
    mem_status_past_due: string
    mem_status_canceled: string
    mem_founding_badge: (n: number) => string
    mem_renews_on: (date: string) => string
    mem_cancels_on: (date: string) => string
    mem_free_until: (date: string) => string
    mem_past_due_note: string
    mem_cancel_btn: string
    mem_resume_btn: string
    mem_cancel_confirm: string
    mem_canceling: string
    mem_resuming: string
    mem_action_err: string
    no_application_title: string
    no_application_body: string
    no_application_cta: string
    label_creator_name: string
    label_country: string
    label_channel: string
    label_ai_service: string
    label_submitted: string
    label_statement: string
    label_season: string
    status_pending_msg: string
    status_waitlist_msg: string
    status_verifying_msg: string
    status_eligible_msg: string
    status_selected_msg: string
    status_awarded_msg: string
    status_rejected_msg: string
    scoring_placeholder: string
    winner_form_intro: string
    winner_form_phone: string
    winner_form_phone_ph: string
    winner_form_address: string
    winner_form_address_ph: string
    winner_form_messenger: string
    winner_form_messenger_hint: string
    winner_form_messenger_ph: string
    winner_form_save: string
    winner_form_saving: string
    winner_form_already_saved: string
    winner_form_updated_at: (date: string) => string
    winner_form_err_phone: string
    winner_form_err_address: string
    winner_form_err_invalid_token: string
    winner_form_err_not_owner: string
    winner_form_err_not_awarded: string
    winner_form_err_not_found: string
    winner_form_err_save_failed: (msg?: string) => string
    history_empty: string
    history_season_card: (n: number, name: string) => string
    celebration_title_1st: string
    celebration_title_2nd: string
    celebration_title_3rd: string
    celebration_subtitle_1st: string
    celebration_subtitle_2nd: string
    celebration_subtitle_3rd: string
    celebration_prize_label: string
    celebration_founding_creator: string
    celebration_season_label: (n: number, name: string) => string
    // Main round submission (2026-05-29) — single-submission model
    main_round_section_title: string
    main_round_theme_label: string
    // Link to the full brief on /rules. The card shows the short label
    // (seasons.main_round_theme_label); the full main_round_theme is a brief
    // too long for this slot. (TK 2026-07-15)
    main_round_theme_full_link: string
    main_round_allowed_platforms_label: string
    // Shown instead of the URL field when the season's allowed sources contain
    // no linkable platform. Takes the sources so the wording follows the column.
    main_round_external_url_closed: (allowed: string) => string
    main_round_video_url_label: string
    main_round_video_url_placeholder: string
    main_round_submitted_video_label: string
    main_round_submitted_at_label: string
    main_round_close_countdown_label: string
    main_round_theme_reveal_countdown_label: string
    countdown_unit_day: string
    countdown_unit_hour: string
    countdown_unit_minute: string
    countdown_unit_second: string
    main_round_video_url_err_empty: string
    main_round_video_url_err_unknown: string
    main_round_video_url_err_not_allowed: string
    main_round_submit_btn: string
    main_round_submitting: string
    main_round_modal_confirm: string
    main_round_modal_cancel: string
    status_main_round_submitted_msg: string
    status_flagged_msg: string
    // /apply submission errors — keyed off ApplyErrorCode from /api/apply.
    apply_err_missing_field: string
    apply_err_agreements_required: string
    apply_err_statement_length: string
    apply_err_duration_range: (min: number, max: number) => string
    // Takes the season's allowed sources so the wording cannot name a platform
    // the column does not ([[feedback-no-hardcode]]).
    apply_err_video_platform_not_allowed: (allowed: string) => string
    apply_err_season_not_found: string
    apply_err_season_not_open: string
    apply_err_season_closed: string
    apply_err_duplicate_email: string
    apply_err_membership_required: string
    apply_err_server_error: string
    // saveMainRoundSubmission server action errors (단계 7)
    main_round_err_invalid_token: string
    main_round_err_not_found: string
    main_round_err_not_owner: string
    main_round_err_season_not_found: string
    main_round_err_not_selected: string
    main_round_err_season_dates_not_set: string
    main_round_err_before_start: string
    main_round_err_after_close: string
    main_round_err_video_url_required: string
    main_round_err_video_url_invalid: string
    main_round_err_video_url_not_allowed: string
    main_round_err_race_or_already_submitted: string
    main_round_err_save_failed: string
  }
  main_results: {
    back_to_season: string
    page_title: string
    subtitle: string
    weights_label: (ai: number, community: number) => string
    soak_note: string
    theme_label: string
    empty: string
    approve_btn: string
    approve_hint: string
    approve_confirm_message: string
    approve_confirm_btn: string
    approve_cancel_btn: string
    approve_err_season_not_found: string
    approve_err_no_scored: string
    approve_err_update_failed: string
    // Three-gate block reasons (lib/awards-gate.ts). Each one says what is
    // holding AND what to do, because "blocked" with no next step reads as a bug.
    approve_err_schedule_not_reached: string
    approve_err_already_awarded: string
    approve_err_nothing_submitted: string
    approve_err_scoring_incomplete: string
    approve_err_vote_window_open: string
    col_rank: string
    col_creator: string
    col_final: string
    col_grade: string
    col_award: string
    col_actions: string
    col_video: string
    no_video: string
    final_pending: string
    award_badge: (rank: number) => string
    override_btn: string
    override_note: string
    override_prev: (reason: string) => string
    override_rank_label: string
    override_rank_ph: string
    override_reason_ph: string
    override_save_btn: string
    override_cancel_btn: string
    override_err_required: string
    override_err_rank: string
  }
  membership: {
    brand_tag: string
    hero_title: string
    hero_subtitle: string
    founding_badge: (remaining: number, cap: number) => string
    founding_full: string
    compare_title: string
    col_anonymous: string
    col_general: string
    col_creator: string
    col_partner: string
    price_free: string
    price_creator: (price: string, interval: string) => string
    partner_track_caption: string
    interval_unit: (interval: string) => string
    row_browse: string
    row_vote: string
    row_compete: string
    row_studio: string
    row_host: string
    vote_note: string
    founding_section_title: string
    founding_section_body: (cap: number, months: number) => string
    founding_renew_note: string
    cta_coming_soon: string
    cta_signup: string
    cta_become_creator: string
    cta_youre_creator: string
    cta_creator_note: string
    back_home: string
  }
  // ★2026-08-11 (지수2C). Landing page (app/_landing/LandingView.tsx). Source:
  // reports/lane_c_i18n_translation_list_2026-08-10.md (English keys, read
  // directly off the component) + the approved translation
  // (제니2 번역 → 제니3 검수 → 고문 확인 → 대표님 승인,
  // "watch 메인 페이지/i18n_ko_landing_watch_2026-08-10.md"). Integrity-related
  // strings (faq_a8, faq_a4_outro, step3_body) use the 2026-08-11 TK ruling
  // text instead of that document's draft -- the ruling landed after the
  // document did and supersedes it (numbers/model/threshold never shown).
  landing: {
    nav_tournament: string
    nav_studio: string
    nav_watch: string
    nav_how: string
    nav_about: string
    nav_membership: string
    nav_faq: string
    greeting: (username: string) => string
    logout: string
    login: string
    cta_default: string
    // ★2026-08-11 (TK found on prod): resolveSeasonCta()'s actual runtime
    // labels were never translated -- only the season===null code fallback
    // (cta_default, above) was. These mirror its 3 states exactly (lib/
    // seasons.ts SeasonCtaState); resolveSeasonCta's own `label` stays
    // English for callers not wired for i18n (e.g. /tournament).
    cta_open: (seasonName: string) => string
    cta_before_open: string
    cta_waitlist: string
    eyebrow: string
    h1_line1: string
    h1_line2: string
    sub1: string
    sub2: string
    hero_tournament_btn: string
    hero_submit_prefix: string
    // ★2026-08-11 (TK found on prod): the season-loaded branch used to name
    // the judging companies (formatAiProviderList) -- same leak 제니3 already
    // closed for the model-NAME list (step2_body/faq_a5), just missed here.
    // No company/model names, ever.
    hero_submit_scoring: (panelLabel: string) => string
    hero_submit_fallback: string
    countdown_label: string
    countdown_days: string
    countdown_hrs: string
    countdown_min: string
    countdown_sec: string
    watch_link: string
    feat1_title: string
    feat1_desc: string
    feat2_title: string
    feat2_desc: string
    feat3_title: string
    feat3_desc: string
    feat4_title: string
    feat4_desc: string
    feat5_title: string
    feat5_desc: string
    how_eyebrow: string
    how_h2: string
    step1_title: string
    step1_body: (min: number, max: number) => string
    step2_title: (panelLabel: string) => string
    step2_body: (modelCount: number) => string
    step3_title: string
    step3_body: (intentPct: string, execPct: string, origPct: string) => string
    step4_title: string
    step4_body: (advanceLabel: string, seasonName: string, total: string, first: string, second: string, third: string) => string
    about_eyebrow: string
    about_h2_line1: string
    about_h2_line2: string
    about_body: (panelLabel: string) => string
    stat1_label: string
    stat2_value: string
    stat2_label: string
    stat3_value: string
    stat3_label: string
    faq_eyebrow: string
    faq_h2: string
    faq_q1: (seasonName: string) => string
    faq_a1: (min: number, max: number) => string
    faq_q2: string
    faq_q3: string
    faq_a3: string
    faq_q4: string
    faq_a4_intro: (modelCount: number) => string
    faq_a4_outro: (intentPct: string, execPct: string, origPct: string) => string
    faq_q5: (n: number) => string
    faq_a5: (n: number, panelLabel: string) => string
    faq_q6: (maxApplicants: number) => string
    faq_a6: (seasonName: string, maxApplicants: number) => string
    faq_q7: string
    faq_a7: (seasonName: string, total: string, first: string, second: string, third: string, advanceLabel: string) => string
    faq_q8: string
    faq_a8: string
    faq_q9: string
    faq_a9: string
    footer_tagline: string
    footer_tournament: string
    footer_membership: string
    footer_terms: string
    footer_privacy: string
    footer_rules: string
    loading: string
  }
  // ★2026-08-11 (지수2C). Watch grid (/watch, Arena*.tsx) + detail
  // (/watch/[id], Watch*.tsx + social-action components). Same sourcing as
  // `landing` above. A subset of these keys (marked below) have NO entry in
  // that document -- they were Korean text hardcoded UNCONDITIONALLY in the
  // current code (shown to every visitor regardless of language) that the
  // 08-10 extraction missed because it only captured English strings. Per
  // 제니2 2026-08-11 ("네 판단대로 가라. 영어를 네가 써라"): English for
  // these is 지수2C-authored, matched to vocabulary already live elsewhere in
  // the same files (Main Round / Preliminary / Judging / Voting / Finalist),
  // never "결선". Logged for a batch 제니3 review in reports/
  // lane_c_watch_selfauthored_en_2026-08-11.md -- do not read the presence of
  // an English string here as "approved," only as "shipped and tracked."
  watch: {
    banner_tagline1: string
    banner_tagline2: string
    banner_learnmore: string
    hero_current: (seasonNumber: number) => string
    hero_ctx_results: string
    hero_ctx_voting: string
    hero_ctx_judged: (dateStr: string | null) => string
    hero_ctx_default: (roundName: string) => string
    hero_cta_results: string
    hero_cta_default: string
    finalists_kicker: string
    finalists_title: string
    finalist_badge: string
    featured_kicker: string
    featured_title: string
    leaderboard_kicker: string
    leaderboard_title: string
    roundbadge_main: string
    roundbadge_prelim: string
    badge_verified: string
    center_mainround: string
    empty_entries: string
    // n is a PRE-FORMATTED string (fmtCount()'s "1.2K" etc.), not a raw
    // number -- matches how Arena.tsx's cardStatusText already composes this.
    votecount: (n: string) => string
    // ★self-authored (see file-header note)
    finalist_pending_note: string
    results_kicker: string
    finalist_prelim_kicker: string
    main_round_results_title: string
    main_round_live_title: string
    finalist_prelim_title: string
    finalist_prelim_tag: string
    card_judging: string
    card_voting: string
    card_awaiting_judgment: string
    featured_stats: (viewsStr: string, votesStr: string) => string
    score_suffix: (score: string) => string
    live_judging: (complete: boolean) => string
    live_close_label: (isMain: boolean) => string
    live_reveal_label: string
    live_vote_label: string
    live_theme_main: string
    live_theme_next: string
    live_countries_suffix: string
    champions_note: (seasonName: string | null, dateStr: string | null) => string
    // sidebar / top bar (doc-covered)
    search_placeholder: string
    signin: string
    badge_watch: string
    badge_subtitle: string
    nav_home: string
    nav_home_sub: string
    nav_tournament: string
    nav_tournament_sub: string
    nav_how: string
    nav_how_sub: string
    nav_membership: string
    nav_membership_sub: string
    nav_faq: string
    nav_faq_sub: string
    nav_about: string
    nav_about_sub: string
    library_label: string
    lib_myvideos: string
    lib_mylikes: string
    lib_watchlater: string
    lib_history: string
    footer_tip_title: string
    footer_tip_body: string
    filter_current: string
    filter_all_competitions: string
    filter_newest: string
    filter_champions: string
    filter_all_champions: string
    filter_viewall: string
    host_suffix: (seasonName: string) => string
    sort_trending: string
    sort_latest: string
    sort_award: string
    round_prelim: string
    round_main: string
    winner_1st: string
    winner_2nd: string
    winner_3rd: string
    sidebar_home: string
    sidebar_tournament: string
    sidebar_sort_label: string
    sidebar_seasons_label: string
    sidebar_all: string
    sidebar_allrounds: string
    sidebar_round_label: string
    sidebar_winners_label: string
    sidebar_more_label: string
    sidebar_membership: string
    sidebar_about: string
    sidebar_how: string
    sidebar_qa: string
    sidebar_subs_label: string
    // detail page (doc-covered + 1 self-authored)
    detail_roundlabel_main: string
    detail_roundlabel_prelim: string
    detail_staffpick: string
    detail_winner: string
    detail_rank1: string
    detail_rank2: string
    detail_rank3: string
    detail_winner_generic: string
    detail_views: (n: number) => string
    detail_comments_count: (n: number) => string
    detail_madewith: (ai: string) => string
    detail_related_title: string
    detail_related_empty: string
    detail_related_views_likes: (views: number, likes: number) => string
    detail_main_round_pending: string
    // social actions (doc-covered)
    comments_count: (n: number) => string
    comments_guidelines: string
    comment_placeholder: string
    comment_submit: string
    comment_signin_prompt: string
    comments_empty: string
    comment_edited: string
    comment_save: string
    comment_cancel: string
    comment_edit: string
    comment_delete: string
    comment_delete_confirm: string
    comment_report: string
    comment_reported: string
    follow_following: (creatorName: string) => string
    follow_follow: (creatorName: string) => string
    follow_btn_following: string
    follow_btn_follow: string
    save_saved: string
    save_save: string
    report_reported: string
    report_report: string
    share_copied: string
    share_share: string
    staffpick_on: string
    staffpick_off: string
    vote_error_limit: (n: number) => string
    vote_error_closed: string
    vote_notopen: string
    vote_title: string
    vote_count: (n: number) => string
    vote_remaining: (remaining: number, cap: number) => string
    vote_closed_suffix: string
    vote_btn_voted: string
    vote_btn_vote: string
    vote_btn_closed: string
    vote_cap_used: (n: number) => string
    // score panel
    score_title: string
    score_intent: string
    score_execution: string
    score_originality: string
    score_integrity_verified: string
  }
}

const MESSAGES_EN: Messages = {
  layout: {
    admin_console: 'Admin Console',
    admin_mode_banner: '⚠ Admin mode — changes affect the live site',
    view_public_site: '← View public site',
    sign_out: 'Sign out',
    signing_out: 'Signing out…',
    soon: 'soon',
    nav: {
      dashboard: 'Dashboard',
      seasons: 'Seasons',
      applications: 'Applications',
      pre_registrations: 'Pre-registrations',
      contacts: 'Winner contacts',
      winners: 'Winners',
      partners: 'Partners',
      emails: 'Emails',
      credits: 'Credits',
      promo: 'Promo videos',
      actors: 'Actors',
      music: 'Music library',
      messages: 'Messages',
    },
  },
  dashboard: {
    title: 'Dashboard',
    welcome: (name) => `Welcome back, ${name}.`,
    stat_total_seasons: 'Total Seasons',
    stat_current_season: 'Current Season',
    stat_total_applicants: 'Total Applicants',
    recent_seasons: 'Recent seasons',
    view_all: 'View all →',
    col_name: 'Name',
    col_number: '#',
    col_status: 'Status',
    col_prize_pool: 'Prize pool',
    col_capacity: 'Capacity',
    edit: 'Edit',
    season_label: (n, status) => `Season ${n} · ${status}`,
    empty_prefix: 'No seasons yet. ',
    empty_link: 'Create one',
    empty_suffix: '.',
    quick_actions: 'Quick actions',
    new_season: '+ New season',
    manage_seasons: 'Manage seasons',
  },
  status: {
    active: 'active',
    draft: 'draft',
    upcoming: 'upcoming',
    closed: 'closed',
    completed: 'completed',
  },
  seasons_list: {
    title: 'Seasons',
    subtitle: 'All operating parameters for every season.',
    new_season: '+ New season',
    deleted_banner: 'Season deleted.',
    load_failed: (msg) => `Failed to load seasons: ${msg}`,
    col_name: 'Name',
    col_number: '#',
    col_status: 'Status',
    col_prize_pool: 'Prize pool',
    col_capacity: 'Capacity',
    col_top_n: 'Top N',
    col_apps_open: 'Apps open',
    edit: 'Edit →',
    empty_prefix: 'No seasons yet. ',
    empty_link: 'Create the first one',
    empty_suffix: '.',
  },
  season_new: {
    back: '← Seasons',
    title: 'New season',
    description:
      'Defaults filled with the standard tournament profile. Save creates the season in draft status — it won’t appear on the public site until you switch the status to active.',
  },
  season_edit: {
    back: '← Seasons',
    title_prefix: 'Edit',
    season_label: (n) => `Season ${n}`,
    last_updated: (date) => `Last updated ${date}`,
    saved_banner: 'Season saved. Public site cache refreshed.',
    danger_zone: 'Danger zone',
  },
  season_form: {
    validation_failed: 'Validation failed',
    saved: 'Saved.',
    group_info: 'Season info',
    group_capacity: 'Capacity & selection',
    group_video: 'Video length (seconds)',
    group_timing: 'Timing',
    group_pool: 'Pool & fees (USD)',
    group_split: 'Prize split (must sum to 100%)',
    group_scoring: 'Scoring split (must sum to 1.0)',
    group_ai_weights: 'AI judging weights (must sum to 1.0)',
    group_ai_panel: 'AI panel',
    group_integrity: 'Integrity thresholds',
    group_schedule: 'Schedule',
    field_name: 'Name',
    field_season_number: 'Season #',
    field_status: 'Status',
    field_max_applicants: 'Max applicants',
    field_top_n: 'Top N advance (computed result)',
    group_advancement: 'Advancement & deferral (2-stage)',
    field_min_participants: 'Min participants (preliminary)',
    field_defer_days: 'Defer extension (days)',
    field_max_defer: 'Max defer count',
    field_advance_pct: 'Advance % (prelim → main round)',
    field_advance_min: 'Advance min (clamp)',
    field_advance_max: 'Advance max (clamp)',
    hint_main_round_semifinal: 'main_round = main round (본선)',
    hint_advance_pct: 'e.g. 0.10 = top 10%, then clamped to [min, max]',
    hint_defer: 'If under min participants, extend deadline N days, up to max times',
    field_video_app_min: 'Application min',
    field_video_app_max: 'Application max',
    field_video_main: 'Main round',
    field_theme_reveal: 'Theme reveal (minutes before)',
    field_submission_hours: 'Submission window (hours)',
    field_total_pool: 'Total prize pool',
    field_entry_fee: 'Entry fee',
    field_1st_place: '1st place',
    field_2nd_place: '2nd place',
    field_3rd_place: '3rd place',
    field_community_vote: 'Community vote weight',
    field_ai_score: 'AI score weight',
    field_intent: 'Intent',
    field_execution: 'Execution',
    field_originality: 'Originality',
    field_integrity: 'Integrity',
    field_flag_integrity: 'Integrity flag threshold',
    field_flag_spread: 'Spread flag threshold',
    field_app_open: 'Application open',
    field_app_close: 'Application close',
    field_scoring_complete: 'Scoring complete',
    field_main_start: 'Main round start',
    field_main_end: 'Main round end',
    field_awards: 'Awards announcement',
    hint_07: 'e.g. 0.7',
    hint_03: 'e.g. 0.3',
    hint_0_100: '0-100',
    split_total_label: 'Total',
    split_total_bad: '✕ must equal 100%',
    saving: 'Saving…',
    save_changes: 'Save changes',
    create_season: 'Create season',
    save_caption: 'Changes are visible on the public site immediately after save.',
    ai_model_name_ph: 'model name (e.g. claude-opus-4-5)',
    ai_provider_ph: 'provider (e.g. Anthropic)',
    integrity_check: 'Integrity',
    add_ai_model: '+ Add AI model',
    remove_model_aria: 'Remove model',
    group_studio: 'Studio (in-platform generation)',
    field_studio_round: 'Studio round',
    field_studio_max_gen: 'Max generations / participant / round',
    studio_round_application: 'Application only',
    studio_round_main: 'Main round only',
    studio_round_both: 'Both (server resolves by schedule)',
    hint_studio_round: 'For "Both", the round is decided by main round start time.',
    group_lobby: 'Lobby (home tournaments card)',
    field_poster_url: 'Poster URL',
    field_lobby_featured: 'Feature in lobby (pin first)',
    hint_poster_url: 'Optional. Empty = purple gradient + theme fallback.',
  },
  delete: {
    button: 'Delete season',
    confirm_title: 'Delete this season?',
    confirm_body_lead: (name) =>
      `This permanently removes ${name} and all references on the public site. Applications tied to this season are not deleted but will become orphaned. Type `,
    confirm_body_type: 'delete <name>',
    confirm_body_tail: ' to confirm.',
    confirm_input_ph: (name) => `delete ${name}`,
    delete_forever: 'Delete forever',
    deleting: 'Deleting…',
    cancel: 'Cancel',
    delete_failed: 'Delete failed',
  },
  login: {
    brand_tag: 'OXXOVO',
    title: 'Admin Console',
    subtitle: 'Authorized personnel only.',
    email: 'Email',
    password: 'Password',
    sign_in: 'Sign in',
    signing_in: 'Signing in…',
    err_not_admin: 'Your account does not have admin access.',
    err_recovery_expired:
      'The password recovery link has expired. Request a new one.',
    err_callback_failed: (reason) =>
      `Sign-in callback failed${reason ? `: ${reason}` : '.'}`,
    err_missing_code: 'The sign-in link was missing required parameters.',
  },
  reset_password: {
    brand_tag: 'OXXOVO',
    title: 'Set a new password',
    signed_in_as_prefix: 'Signed in as ',
    new_password: 'New password',
    confirm_password: 'Confirm password',
    submit: 'Set new password',
    submitting: 'Updating…',
    success: 'Password updated. Redirecting…',
    min_length: (n) => `Password must be at least ${n} characters.`,
    mismatch: 'Passwords do not match.',
  },
  applications: {
    title: 'Applications',
    subtitle: 'Browse, filter, and manage every applicant.',
    season_select_label: 'Season',
    segment_all: 'All',
    segment_pending: 'Pending',
    segment_flagged: 'Flagged',
    segment_top50: 'Top 50',
    segment_waitlist: 'Waitlist',
    segment_awarded: 'Awarded',
    segment_rejected: 'Not advanced',
    judging_axis_label: 'Judging',
    judging_all: 'Any',
    judging_unjudged: '★Never enqueued',
    judging_in_progress: 'In progress',
    judging_failed: 'Failed',
    judging_completed: 'Judged',
    segment_count: (n) => `(${n})`,
    search_placeholder: 'Search name, email, channel…',
    sort_label: 'Sort',
    sort_submitted_desc: 'Newest first',
    sort_submitted_asc: 'Oldest first',
    sort_score_desc: 'Highest score',
    sort_name_asc: 'Name (A→Z)',
    csv_export: 'Export CSV',
    csv_exported: (n) => `Exported ${n} row${n === 1 ? '' : 's'}.`,
    col_name: 'Name',
    col_email: 'Email',
    col_country: 'Country',
    col_status: 'Status',
    col_ai_service: 'AI service',
    col_submitted: 'Submitted',
    col_score: 'Score',
    col_grade: 'Grade',
    col_integrity: 'Integrity',
    empty: 'No applications match the current filter.',
    score_pending: '—',
    recommendations_title: (n) => `Top ${n} Recommendation`,
    recommendations_subtitle: 'Auto-recommended by verified_score. Review and apply.',
    recommendations_empty: 'Scoring not yet completed. Recommendations will appear once scoring finishes.',
    recommendations_recommended_at: (date) => `Recommended at: ${date}`,
    recommendations_col_rank: 'Rank',
    recommendations_col_score: 'Score',
    recommendations_apply_btn: 'Apply Recommendation',
    recommendations_apply_confirm_message: (n) =>
      `This will mark Top ${n} as 'selected', the rest as 'rejected', and send automatic notification emails. Proceed?`,
    recommendations_apply_confirm_btn: 'Apply',
    recommendations_apply_cancel_btn: 'Cancel',
    recommendations_applied_at: (date, admin) => `Applied at: ${date} (${admin})`,
    recommendations_applied_status: 'Applied',
    recommendations_flagged_section_title: 'Flagged Applications (excluded from recommendation)',
    recommendations_flagged_section_note:
      'These applications were excluded due to integrity concerns. Admin review and status update required.',
    recommendations_total_label: (n) => `${n} recommended in total`,
    apply_rec_err_unauthorized: 'Admin authentication required.',
    apply_rec_err_season_not_found: 'Season not found.',
    apply_rec_err_no_recommendations: 'No recommendations to apply.',
    apply_rec_err_race_or_already_applied:
      'Already applied or another admin is applying concurrently.',
    apply_rec_err_update_failed: 'Failed to apply. Please try again later.',
  },
  application_detail: {
    back: '← Applications',
    section_applicant: 'Applicant',
    section_statement: 'Statement',
    section_video: 'Video',
    section_actions: 'Admin actions',
    section_scoring: 'Scoring',
    section_integrity_review: 'Integrity Review',
    label_name: 'Name',
    label_email: 'Email',
    label_country: 'Country',
    label_channel: 'Channel',
    label_ai_service: 'AI service',
    label_submitted: 'Submitted',
    label_status: 'Status',
    label_award_rank: 'Award',
    no_country: '—',
    no_channel: '—',
    notes_label: 'Admin notes (private)',
    notes_placeholder: 'Internal observations, integrity flags, follow-ups…',
    notes_save: 'Save notes',
    notes_saving: 'Saving…',
    notes_saved: 'Saved.',
    status_change_label: 'Change status',
    award_rank_label: 'Set award rank',
    award_rank_none: 'No award',
    award_rank_1st: '1st place',
    award_rank_2nd: '2nd place',
    award_rank_3rd: '3rd place',
    save_status: 'Save status',
    save_award: 'Save award',
    scoring_placeholder: 'Triple-AI scoring results will appear here after Phase 3 integration.',
    scoring_no_data: 'Not yet scored. The oxxovo-scoring system will pick this up automatically.',
    scoring_in_progress: 'Triple-AI scoring in progress…',
    scoring_failed: 'Scoring failed — see error below.',
    scoring_verified_score: 'OXXOVO Verified Score',
    scoring_grade: 'Grade',
    scoring_subscores: 'Subscores (Consensus)',
    scoring_intent: 'Intent (25%)',
    scoring_execution: 'Execution (45%)',
    scoring_originality: 'Originality (20%)',
    scoring_integrity_weight: 'Integrity (10%)',
    scoring_judged_at: (date) => `Judged ${date}`,
    scoring_cost: (usd) => `Cost: ${usd}`,
    integrity_confidence_label: 'Confidence',
    integrity_score_label: 'Claude Integrity Score',
    integrity_explanation_label: 'AI Explanation',
    integrity_recommendation_label: 'AI Recommendation',
    integrity_high_warning: 'High-confidence integrity suspicion — admin review required before this entry can proceed.',
    ai_outputs_toggle: 'Show AI raw outputs',
    ai_outputs_hide: 'Hide AI raw outputs',
  },
  video: {
    embed_failed: 'Unable to embed this video.',
    open_external: 'Open in new tab ↗',
    raw_url_label: 'Source URL',
    no_url: 'No video URL provided.',
  },
  contacts: {
    title: 'Winner contacts',
    subtitle: 'Information winners enter themselves on their profile.',
    season_select_label: 'Season',
    search_placeholder: 'Search name, email…',
    csv_export: 'Export CSV',
    col_season: 'Season',
    col_name: 'Name',
    col_email: 'Email',
    col_award: 'Award',
    col_phone: 'Phone',
    col_address: 'Address',
    col_messenger: 'Messenger',
    col_filled_at: 'Filled at',
    pending_badge: 'Pending',
    empty: 'No winners yet.',
    not_filled: '—',
  },
  pre_reg: {
    title: 'Pre-registrations',
    subtitle: 'Emails captured on /pre-register, with UTM attribution.',
    season_select_label: 'Season',
    search_placeholder: 'Search email, UTM…',
    count_label: (n) => `${n} result${n === 1 ? '' : 's'}`,
    csv_export: 'Export CSV',
    col_email: 'Email',
    col_season: 'Season',
    col_utm_source: 'Source',
    col_utm_medium: 'Medium',
    col_utm_campaign: 'Campaign',
    col_referrer: 'Referrer',
    col_status: 'Status',
    col_created_at: 'Registered at',
    empty: 'No pre-registrations match the current filter.',
  },
  emails: {
    title: 'Emails',
    subtitle:
      'Every email this site has sent, why, and whether it landed. Sends are automatic — failed rows retry on their own via cron.',
    season_select_label: 'Season',
    template_label: 'Template',
    status_label: 'Status',
    language_label: 'Language',
    search_placeholder: 'Search recipient, subject…',
    template_all: 'All templates',
    status_all: 'All statuses',
    language_all: 'All languages',
    template_pre_registered: 'Pre-registered',
    template_application_received: 'Application received',
    template_waitlisted: 'Waitlisted',
    template_selected_top50: 'Selected (Top 50)',
    template_not_selected: 'Season result — not advanced',
    template_main_round_start: 'Main round start',
    template_submission_deadline: 'Submission deadline',
    template_results_announced: 'Results announced',
    template_awarded_contact_request: 'Awarded — contact request',
    status_sent: 'Sent',
    status_failed: 'Failed',
    status_skipped: 'Skipped',
    status_queued: 'Queued',
    stat_total: 'Total',
    stat_sent: 'Sent',
    stat_failed: 'Failed',
    stat_skipped: 'Skipped',
    col_sent_at: 'Sent at',
    col_template: 'Template',
    col_recipient: 'Recipient',
    col_lang: 'Lang',
    col_status: 'Status',
    col_subject: 'Subject',
    col_error: 'Error',
    col_meta: 'Meta',
    empty: 'No emails match the current filter.',
    pager_prev: '← Previous',
    pager_next: 'Next →',
    pager_label: (start, end, total) => `${start}–${end} of ${total}`,
    retry_note:
      'Cron retries failed rows automatically with 15 / 30 / 60 / 120-minute backoff (max 4 attempts).',
  },
  profile: {
    page_title: 'Creator profile',
    header_brand: 'OXXOVO',
    log_out: 'Log out',
    loading: 'Loading…',
    auth_required: 'You need to sign in to view your profile.',
    auth_required_action: 'Go to login',
    loading_failed: 'Could not load your profile data. Please try again.',
    section_my_application: 'My application',
    section_video: 'My video',
    section_status: 'Status',
    section_scoring: 'Triple-AI scoring',
    section_winner_form: 'Winner contact info',
    section_history: 'Season history',
    mem_section: 'Membership',
    mem_tier_creator: 'Creator membership',
    mem_tier_general: 'Member',
    mem_status_active: 'Active',
    mem_status_past_due: 'Payment failed',
    mem_status_canceled: 'Canceled',
    mem_founding_badge: (n: number) => `Founding Creator #${n}`,
    mem_renews_on: (date: string) => `Renews on ${date}`,
    mem_cancels_on: (date: string) => `Cancels on ${date} — access until then`,
    mem_free_until: (date: string) => `Free until ${date}`,
    mem_past_due_note:
      'Your last payment failed. Please update your card — we will retry automatically.',
    mem_cancel_btn: 'Cancel membership',
    mem_resume_btn: 'Resume membership',
    mem_cancel_confirm:
      'Cancel your membership? You keep creator access until the end of the current period, then your account returns to a free member.',
    mem_canceling: 'Canceling…',
    mem_resuming: 'Resuming…',
    mem_action_err: 'Could not update your membership. Please try again.',
    no_application_title: 'No application on file',
    no_application_body:
      'You haven’t applied to any season with this email yet.',
    no_application_cta: 'Apply now',
    label_creator_name: 'Creator name',
    label_country: 'Country',
    label_channel: 'Channel',
    label_ai_service: 'AI service',
    label_submitted: 'Submitted',
    label_statement: 'Statement',
    label_season: 'Season',
    status_pending_msg: 'Submission received. Scoring will run after the season closes.',
    status_waitlist_msg: 'You are on the waitlist. We’ll notify you if a Top 50 slot opens.',
    status_verifying_msg: 'Triple-AI verification in progress.',
    status_eligible_msg: 'Verification passed. Your entry is eligible for the main round.',
    status_selected_msg: 'Congratulations — you’ve been selected for Top 50.',
    status_awarded_msg:
      'Congratulations! You’ve been chosen as a winner. Please complete the contact form below so we can ship your prize.',
    status_rejected_msg: 'This season didn’t work out. We hope to see you in the next one.',
    scoring_placeholder:
      'Triple-AI scores will appear here after Phase 3 integration with the scoring system.',
    winner_form_intro:
      'We need your phone and shipping address to deliver the prize. Messenger ID is optional and only used if we need to reach you quickly.',
    winner_form_phone: 'Phone',
    winner_form_phone_ph: '+1 555 123 4567',
    winner_form_address: 'Shipping address',
    winner_form_address_ph: 'Street, city, state/province, postal code, country',
    winner_form_messenger: 'Messenger ID (optional)',
    winner_form_messenger_hint:
      'Free-form. Example: "KakaoTalk: oxxovo" or "WhatsApp: +1…" or "Telegram: @user".',
    winner_form_messenger_ph: 'Platform: ID',
    winner_form_save: 'Save contact info',
    winner_form_saving: 'Saving…',
    winner_form_already_saved: 'Saved. You can update it anytime.',
    winner_form_updated_at: (date) => `Last updated ${date}`,
    winner_form_err_phone: 'Phone is required.',
    winner_form_err_address: 'Shipping address is required.',
    winner_form_err_invalid_token: 'Your session has expired. Please sign in again.',
    winner_form_err_not_owner: 'You can only edit your own application.',
    winner_form_err_not_awarded: 'This application is not in the awarded state.',
    winner_form_err_not_found: 'Application not found.',
    winner_form_err_save_failed: (msg) => `Save failed${msg ? `: ${msg}` : '.'}`,
    history_empty: 'No tournament history yet.',
    history_season_card: (n, name) => `Season ${n} · ${name}`,
    celebration_title_1st: 'Champion',
    celebration_title_2nd: 'Runner-up',
    celebration_title_3rd: 'Third Place',
    celebration_subtitle_1st: 'The top of OXXOVO Genesis.',
    celebration_subtitle_2nd: 'Among the very best of this season.',
    celebration_subtitle_3rd: 'A podium finish — outstanding work.',
    celebration_prize_label: 'Prize',
    celebration_founding_creator: 'Founding Creator',
    celebration_season_label: (n, name) => `Season ${n} — ${name}`,
    main_round_section_title: 'Main Round Submission',
    main_round_theme_label: 'Main Round Theme',
    main_round_theme_full_link: 'Read the full brief →',
    main_round_allowed_platforms_label: 'Allowed Platforms',
    main_round_external_url_closed: (allowed) =>
      `${allowed} is the only entry source for this season's main round, so there is no link to submit here.`,
    main_round_video_url_label: 'Video URL',
    main_round_video_url_placeholder: 'YouTube, Vimeo, or other video link',
    main_round_submitted_video_label: 'Submitted Video',
    main_round_submitted_at_label: 'Submitted at',
    main_round_close_countdown_label: 'Time until close',
    main_round_theme_reveal_countdown_label: 'Time until theme reveal',
    countdown_unit_day: 'd',
    countdown_unit_hour: 'h',
    countdown_unit_minute: 'm',
    countdown_unit_second: 's',
    main_round_video_url_err_empty: 'Please enter a video URL.',
    main_round_video_url_err_unknown: 'Unsupported platform.',
    main_round_video_url_err_not_allowed: 'This platform is not allowed for this season.',
    main_round_submit_btn: 'Submit',
    main_round_submitting: 'Submitting…',
    main_round_modal_confirm: 'Submit',
    main_round_modal_cancel: 'Cancel',
    status_main_round_submitted_msg: 'Your main-round video has been submitted. Awaiting results.',
    status_flagged_msg: 'Your application is under review by the operations team.',
    apply_err_missing_field: 'A required field is missing.',
    apply_err_agreements_required: 'All three agreements are required.',
    apply_err_statement_length: 'Creator statement must be 150–250 characters.',
    apply_err_duration_range: (min, max) =>
      `Video duration must be between ${min} and ${max} seconds.`,
    apply_err_video_platform_not_allowed: (allowed) =>
      `This season accepts entries from ${allowed} only.`,
    apply_err_season_not_found: 'Season configuration not found. Please try again later.',
    apply_err_season_not_open: 'Applications for this season have not opened yet.',
    apply_err_season_closed: 'Applications for this season are closed.',
    apply_err_duplicate_email: 'This email has already submitted an application.',
    apply_err_membership_required: 'A creator membership is required to apply. Please activate your membership and try again.',
    apply_err_server_error: 'Submission failed. Please try again later.',
    main_round_err_invalid_token: 'Your session has expired. Please sign in again.',
    main_round_err_not_found: 'Application not found.',
    main_round_err_not_owner: 'You can only submit on your own application.',
    main_round_err_season_not_found: 'Season configuration not found. Please try again later.',
    main_round_err_not_selected: 'Only selected creators can submit a main-round video.',
    main_round_err_season_dates_not_set: 'The season schedule isn’t set yet.',
    main_round_err_before_start: 'The main round hasn’t started yet.',
    main_round_err_after_close: 'The main round has closed.',
    main_round_err_video_url_required: 'Please enter a video URL.',
    main_round_err_video_url_invalid: 'Unsupported platform.',
    main_round_err_video_url_not_allowed: 'This platform is not allowed for this season.',
    main_round_err_race_or_already_submitted: 'Your main-round video has already been submitted.',
    main_round_err_save_failed: 'Submission failed. Please try again later.',
  },
  main_results: {
    back_to_season: 'Back to season',
    page_title: 'Main Round Results',
    subtitle:
      'Finalists are ranked automatically by AI final score. Review and approve the Top 3 awards, or override on integrity or system-error grounds.',
    weights_label: (ai, community) => `AI ${ai}% / Community ${community}%`,
    soak_note: 'Soak mode - final score = AI score (community weight 0)',
    theme_label: 'Common theme',
    empty:
      'No main-round submissions yet. Results appear here once oxxovo-scoring scores them.',
    approve_btn: 'Approve Top 3 Awards',
    approve_hint:
      'Sets award rank 1/2/3 for the top three by final score and fires the prize-payout request emails.',
    approve_confirm_message:
      'Approve the Top 3 by final score as award winners 1/2/3? This sets their award rank and sends the prize-payout request emails.',
    approve_confirm_btn: 'Approve',
    approve_cancel_btn: 'Cancel',
    approve_err_season_not_found: 'Season not found.',
    approve_err_no_scored: 'No scored main-round submissions yet.',
    approve_err_update_failed: 'Failed to set award ranks. Please try again.',
    approve_err_schedule_not_reached:
      'Too early. Approval opens once the main round and community voting are both over.',
    approve_err_already_awarded:
      'Winners are already recorded. Use the per-entry override (with a reason) to change a rank.',
    approve_err_nothing_submitted: 'No main-round submissions to rank yet.',
    approve_err_scoring_incomplete:
      'Main-round scoring is not finished. Approving now would build the podium from a partial set — unscored entries are dropped, not flagged.',
    approve_err_vote_window_open:
      'Community voting has not closed. Votes count toward the final score this season, so the tally would be partial.',
    col_rank: 'Rank',
    col_creator: 'Creator',
    col_final: 'Final',
    col_grade: 'Grade',
    col_award: 'Award',
    col_actions: 'Actions',
    col_video: 'Video',
    no_video: 'No video',
    final_pending: 'Pending',
    award_badge: (rank) => `#${rank} Award`,
    override_btn: 'Override',
    override_note:
      'Manually adjust the award rank on integrity, plagiarism, or system-error grounds. The reason is recorded for audit.',
    override_prev: (reason) => `Previous reason: ${reason}`,
    override_rank_label: 'Award rank',
    override_rank_ph: 'e.g. 1',
    override_reason_ph:
      'Reason for override (required) - e.g. plagiarism confirmed, scoring system error',
    override_save_btn: 'Save override',
    override_cancel_btn: 'Cancel',
    override_err_required: 'An override reason is required.',
    override_err_rank: 'Award rank must be 1-99, or leave blank to clear.',
  },
  membership: {
    brand_tag: 'OXXOVO MEMBERSHIP',
    hero_title: 'Creator Membership',
    hero_subtitle:
      'Join the OXXOVO arena. Choose the membership that fits you and start creating, competing, and voting.',
    founding_badge: (remaining, cap) => `${remaining} of ${cap} Founding Creator spots left`,
    founding_full: 'All Founding Creator spots have been claimed.',
    compare_title: 'What each tier can do',
    col_anonymous: 'Visitor',
    col_general: 'Member',
    col_creator: 'Creator',
    col_partner: 'Partner',
    price_free: 'Free',
    price_creator: (price, interval) => `$${price} / ${interval}`,
    partner_track_caption: 'Separate track — hosting right',
    interval_unit: (interval) =>
      (({ day: 'day', week: 'week', month: 'month', year: 'year' } as Record<string, string>)[
        interval
      ] ?? interval),
    row_browse: 'Browse tournaments',
    row_vote: 'Vote on entries',
    row_compete: 'Enter tournaments',
    row_studio: 'Create in Studio',
    row_host: 'Host tournaments',
    vote_note: 'Community voting opens in a later season.',
    founding_section_title: 'Founding Creator',
    founding_section_body: (cap, months) =>
      `First ${cap} only — ${months === 12 ? '1-year' : `${months}-month`} free membership · Founding digital badge`,
    founding_renew_note:
      'Renews automatically afterward unless cancelled — we’ll remind you before it does.',
    cta_coming_soon: 'Coming soon',
    cta_signup: 'Sign up to get started',
    cta_become_creator: 'Become a Creator',
    cta_youre_creator: 'You’re a Creator ✓ — go to profile',
    cta_creator_note: 'Membership unlocks tournament entry and Studio.',
    back_home: '← Back to Home',
  },
  landing: {
    nav_tournament: 'Tournament Info',
    nav_studio: 'Studio',
    nav_watch: 'Watch',
    nav_how: 'How It Works',
    nav_about: 'About',
    nav_membership: 'Membership',
    nav_faq: 'FAQ',
    greeting: (username) => `Hi, ${username}`,
    logout: 'Log out',
    login: 'Log in',
    cta_default: 'Apply now',
    cta_open: (seasonName) => `Apply to ${seasonName}`,
    cta_before_open: 'Get notified when applications open',
    cta_waitlist: 'Join the waitlist',
    eyebrow: 'AI Competitive Creation Platform',
    h1_line1: 'The Global Arena',
    h1_line2: 'for AI Creators.',
    sub1: 'AI is easy. Winning is hard.',
    sub2: 'Same tools. Same clock. Skill decides.',
    hero_tournament_btn: 'Tournament Info',
    hero_submit_prefix: 'Submit your AI video.',
    hero_submit_scoring: (panelLabel) => `${panelLabel} scoring by multiple independent AI models.`,
    hero_submit_fallback: 'AI verified scoring.',
    countdown_label: 'Application Closes In',
    countdown_days: 'Days',
    countdown_hrs: 'Hrs',
    countdown_min: 'Min',
    countdown_sec: 'Sec',
    watch_link: 'Watch the competition →',
    feat1_title: 'Real-time',
    feat1_desc: 'Live tournaments. Feel the pressure.',
    feat2_title: 'Verified',
    feat2_desc: 'Same prompt. Same conditions.',
    feat3_title: 'Ranked',
    feat3_desc: 'Global leaderboard. Earn your reputation.',
    feat4_title: 'Global',
    feat4_desc: 'Creators from around the world.',
    feat5_title: 'Built for Creators',
    feat5_desc: 'Made by creators. For creators.',
    how_eyebrow: 'How It Works',
    how_h2: 'Submit. Get Verified. Win.',
    step1_title: 'Share Your Video',
    step1_body: (min, max) =>
      `Make your video in OXXOVO Studio (${min}–${max} seconds) and submit it there. Everyone works with the same toolset — what separates entries is your direction, not your budget.`,
    step2_title: (panelLabel) => `${panelLabel} Judges`,
    step2_body: (modelCount) =>
      `${modelCount === 3 ? 'Three' : modelCount} independent AI models from ${modelCount === 3 ? 'three' : modelCount} different companies score your work in parallel. Eliminates single-AI bias.`,
    step3_title: 'Get Your Score',
    step3_body: (intentPct, execPct, origPct) =>
      `You get an OXXOVO score across three published components — Intent Clarity (${intentPct}), Execution (${execPct}), Originality (${origPct}). Every entry also passes an automated integrity check.`,
    step4_title: 'Earn Your Title',
    step4_body: (advanceLabel, seasonName, total, first, second, third) =>
      `The ${advanceLabel} advance as Finalists, competing for the ${seasonName} prize pool of $${total} ($${first} / $${second} / $${third}).`,
    about_eyebrow: 'About',
    about_h2_line1: 'The First Verified Arena',
    about_h2_line2: 'for AI Video Creators.',
    about_body: (panelLabel) =>
      `OXXOVO is the global arena for AI video creators. Independent ${panelLabel} scoring verifies every entry and keeps each round fair. OXXOVO Labs Inc., based in Las Vegas, operates the AI Creator League — a season-based competition where creators compete, get verified, and get discovered.`,
    stat1_label: 'Independent AI Judges',
    stat2_value: 'Global',
    stat2_label: 'Open to All Creators',
    stat3_value: 'Verified',
    stat3_label: 'Same Rules. Skill Decides.',
    faq_eyebrow: 'FAQ',
    faq_h2: 'Common Questions',
    faq_q1: (seasonName) => `Who can participate in ${seasonName}?`,
    faq_a1: (min, max) =>
      `Anyone, anywhere. There are no nationality, age, or experience requirements. You just need an AI-generated video (${min}–${max} seconds) and a free OXXOVO account.`,
    faq_q2: 'What does it cost to compete?',
    faq_q3: 'How do I create my video?',
    faq_a3:
      'Everyone creates in OXXOVO Studio — the same models, the same limits, for everyone. You don’t bring outside tools, and you don’t need a subscription anywhere else. That’s what makes the result comparable.',
    faq_q4: 'How exactly are submissions scored?',
    faq_a4_intro: (modelCount) => `Each video is judged by ${modelCount} AI models in parallel:`,
    faq_a4_outro: (intentPct, execPct, origPct) =>
      `Your final OXXOVO score is a weighted average. Three components are shown — Intent Clarity (${intentPct}), Execution (${execPct}), and Originality (${origPct}) — and integrity is verified automatically. Outlier scores are discarded.`,
    faq_q5: (n) => `Why ${n} AIs instead of one?`,
    faq_a5: (n, panelLabel) =>
      `Every AI has bias. By using ${n} independent models from ${n} different companies, individual biases cancel out. When the panel agrees, the result is far more trustworthy than any single AI’s verdict. This is what makes OXXOVO scoring ${panelLabel} Verified.`,
    faq_q6: (maxApplicants) => `What if ${maxApplicants} people apply before me?`,
    faq_a6: (seasonName, maxApplicants) =>
      `${seasonName} accepts up to ${maxApplicants} applicants. If the limit is reached before you apply, you’ll be automatically added to the ${seasonName} Waitlist with priority access to the next season. We never turn anyone away.`,
    faq_q7: 'What are the prizes?',
    faq_a7: (seasonName, total, first, second, third, advanceLabel) =>
      `${seasonName} features a $${total} prize pool ($${first} for 1st, $${second} for 2nd, $${third} for 3rd). The ${advanceLabel} earn the Finalist title.`,
    faq_q8: 'How does OXXOVO prevent cheating?',
    faq_a8:
      "An automated integrity check flags misrepresentation. Anything it flags gets a human review. Misstating your tools or sources is grounds for disqualification. We don't publish the thresholds or weighting.",
    faq_q9: 'When do I get my results?',
    faq_a9:
      'Scoring runs in a batch after the application period closes. Your individual score and the panel’s reasoning arrive with your preliminary-round results notification, and you can also check them in your profile.',
    footer_tagline: 'The New Standard for AI Creativity',
    footer_tournament: 'Tournament Info',
    footer_membership: 'Membership',
    footer_terms: 'Terms',
    footer_privacy: 'Privacy',
    footer_rules: 'Rules',
    loading: 'Loading…',
  },
  watch: {
    banner_tagline1: 'OXXOVO is the global arena for AI creators.',
    banner_tagline2: 'Built under the same conditions. Judged on skill alone.',
    banner_learnmore: 'Learn More on Landing Page ↗',
    hero_current: (seasonNumber) => `Current Competition — Season ${seasonNumber}`,
    hero_ctx_results: 'The winners have been announced. See who took the top spots this season.',
    hero_ctx_voting: 'Community voting is open. Watch the main-round films and vote for your favorite creator.',
    hero_ctx_judged: (dateStr) => `Judging is complete. Finalists will be revealed ${dateStr ? `on ${dateStr}` : 'soon'}.`,
    hero_ctx_default: (roundName) =>
      `${roundName} is in progress. Videos are shown in the order they were entered. Join OXXOVO for free to vote in the Main Round and support your favorite creators.`,
    hero_cta_results: 'See who won →',
    hero_cta_default: 'Join free to vote →',
    finalists_kicker: 'Main Round',
    finalists_title: '🏆 Finalists',
    finalist_badge: 'Finalist',
    featured_kicker: 'Spotlight',
    featured_title: 'Featured Competitors',
    leaderboard_kicker: 'Standings',
    leaderboard_title: 'Leaderboard',
    roundbadge_main: 'Main Round',
    roundbadge_prelim: 'Preliminary',
    badge_verified: '✓ Verified',
    center_mainround: 'MAIN ROUND',
    empty_entries: 'No entries yet. They appear here as creators submit.',
    votecount: (n) => `${n} votes`, // n pre-formatted (fmtCount)
    finalist_pending_note: 'Main round video coming soon',
    results_kicker: 'Results',
    finalist_prelim_kicker: 'Finalists',
    main_round_results_title: '🏆 Main Round Results',
    main_round_live_title: '🏆 Main Round · Live Now',
    finalist_prelim_title: 'Finalist Entries · Preliminary Round',
    finalist_prelim_tag: 'Finalist Entry',
    card_judging: '⚡ Judging',
    card_voting: '🔥 Voting',
    card_awaiting_judgment: 'Awaiting judgment',
    featured_stats: (viewsStr, votesStr) => `${viewsStr} views · ${votesStr} votes`,
    score_suffix: (score) => `Triple-AI ${score}`,
    live_judging: (complete) => `Triple-AI ${complete ? 'Judging Complete' : 'Judging'}`,
    live_close_label: (isMain) => `${isMain ? 'Main Round' : 'Preliminary'} closes in`,
    live_reveal_label: 'Finalists revealed in',
    live_vote_label: 'Voting closes in',
    live_theme_main: 'Main Round Theme',
    live_theme_next: 'Next Round Theme',
    live_countries_suffix: 'countries',
    champions_note: (seasonName, dateStr) =>
      dateStr
        ? `${seasonName ?? 'Season'} Champions revealed ${dateStr}`
        : 'Champions revealed after judging completes',
    search_placeholder: 'Search videos & creators',
    signin: 'Sign in',
    badge_watch: 'WATCH',
    badge_subtitle: 'AI Creator League',
    nav_home: 'Home',
    nav_home_sub: 'Go to Landing Page',
    nav_tournament: 'Tournament Info',
    nav_tournament_sub: 'Rules, Schedule, Prizes',
    nav_how: 'How It Works',
    nav_how_sub: 'Learn the process',
    nav_membership: 'Membership',
    nav_membership_sub: 'Join & Benefits',
    nav_faq: 'FAQ',
    nav_faq_sub: 'Frequently Asked Questions',
    nav_about: 'About',
    nav_about_sub: 'About OXXOVO',
    library_label: 'Library',
    lib_myvideos: 'My Videos',
    lib_mylikes: 'My Likes',
    lib_watchlater: 'Watch Later',
    lib_history: 'History',
    footer_tip_title: 'All Information in One Place',
    footer_tip_body: 'You are in WATCH. Click menu items to open in a new tab.',
    filter_current: 'Current Competition',
    filter_all_competitions: 'All Competitions',
    filter_newest: 'Newest First',
    filter_champions: '🏆 Champions',
    filter_all_champions: 'All Champions',
    filter_viewall: 'View All →',
    host_suffix: (seasonName) => `${seasonName} · Host`,
    sort_trending: 'Trending',
    sort_latest: 'Latest',
    sort_award: 'Award Winners',
    round_prelim: 'Preliminary',
    round_main: 'Main Round',
    winner_1st: '🥇 1st Place',
    winner_2nd: '🥈 2nd Place',
    winner_3rd: '🥉 3rd Place',
    sidebar_home: 'Home',
    sidebar_tournament: 'Tournament',
    sidebar_sort_label: 'Sort',
    sidebar_seasons_label: 'Seasons',
    sidebar_all: 'All',
    sidebar_allrounds: 'All rounds',
    sidebar_round_label: 'Round',
    sidebar_winners_label: 'Winners',
    sidebar_more_label: 'More',
    sidebar_membership: 'Membership',
    sidebar_about: 'About',
    sidebar_how: 'How It Works',
    sidebar_qa: 'Q&A',
    sidebar_subs_label: 'Subscriptions',
    detail_roundlabel_main: 'Main Round',
    detail_roundlabel_prelim: 'Preliminary',
    detail_staffpick: 'Staff Pick',
    detail_winner: '🏆 Winner',
    detail_rank1: '🥇 1st Place',
    detail_rank2: '🥈 2nd Place',
    detail_rank3: '🥉 3rd Place',
    detail_winner_generic: '🏆 Winner',
    detail_views: (n) => `${n.toLocaleString()} views`,
    detail_comments_count: (n) => `${n.toLocaleString()} comments`,
    detail_madewith: (ai) => `Made with ${ai}`,
    detail_related_title: 'More from this season',
    detail_related_empty: 'Nothing else here yet.',
    detail_related_views_likes: (views, likes) => `${views.toLocaleString()} views · ${likes.toLocaleString()} likes`,
    detail_main_round_pending: '🏆 Finalist entry · Main round video coming soon.',
    comments_count: (n) => `${n} comments`,
    comments_guidelines: 'Community Guidelines',
    comment_placeholder: 'Add a comment…',
    comment_submit: 'Comment',
    comment_signin_prompt: 'Sign in to comment…',
    comments_empty: 'No comments yet. Be the first.',
    comment_edited: '(edited)',
    comment_save: 'Save',
    comment_cancel: 'Cancel',
    comment_edit: 'Edit',
    comment_delete: 'Delete',
    comment_delete_confirm: 'Delete this comment?',
    comment_report: 'Report',
    comment_reported: 'Reported',
    follow_following: (creatorName) => `Following ${creatorName}`,
    follow_follow: (creatorName) => `Follow ${creatorName}`,
    follow_btn_following: 'Following',
    follow_btn_follow: 'Follow',
    save_saved: 'Saved',
    save_save: 'Save',
    report_reported: 'Reported',
    report_report: 'Report',
    share_copied: 'Copied',
    share_share: 'Share',
    staffpick_on: 'Staff Pick',
    staffpick_off: 'Mark Staff Pick',
    vote_error_limit: (n) => `You've used all ${n} votes. Un-vote another to switch.`,
    vote_error_closed: 'Voting is closed.',
    vote_notopen: 'Community voting is not open.',
    vote_title: 'Community vote',
    vote_count: (n) => `${n.toLocaleString()} votes`,
    vote_remaining: (remaining, cap) => `${remaining} of ${cap} left`,
    vote_closed_suffix: 'voting closed',
    vote_btn_voted: '✓ Voted',
    vote_btn_vote: 'Vote',
    vote_btn_closed: 'Closed',
    vote_cap_used: (n) => `All ${n} votes used — un-vote one to switch.`,
    score_title: 'Triple-AI score',
    score_intent: 'Intent / clarity',
    score_execution: 'Execution',
    score_originality: 'Originality',
    score_integrity_verified: 'Integrity Verified',
  },
}

const MESSAGES_KO: Messages = {
  layout: {
    admin_console: '관리자 콘솔',
    admin_mode_banner: '⚠ 관리자 모드 — 모든 변경사항은 운영 사이트에 즉시 반영됩니다',
    view_public_site: '← 공개 사이트 보기',
    sign_out: '로그아웃',
    signing_out: '로그아웃 중…',
    soon: '준비 중',
    nav: {
      dashboard: '대시보드',
      seasons: '시즌 관리',
      applications: '지원자 관리',
      pre_registrations: '사전 등록',
      contacts: '시상자 연락처',
      winners: '수상자 관리',
      partners: '파트너',
      emails: '이메일',
      credits: '크레딧',
      promo: '홍보영상',
      actors: '배우',
      music: '음악 라이브러리',
      messages: '메시지',
    },
  },
  dashboard: {
    title: '대시보드',
    welcome: (name) => `${name}님 환영합니다.`,
    stat_total_seasons: '전체 시즌',
    stat_current_season: '현재 시즌',
    stat_total_applicants: '전체 지원자',
    recent_seasons: '최근 시즌',
    view_all: '전체 보기 →',
    col_name: '이름',
    col_number: '번호',
    col_status: '상태',
    col_prize_pool: '상금 풀',
    col_capacity: '정원',
    edit: '수정',
    season_label: (n, status) => `시즌 ${n} · ${status}`,
    empty_prefix: '아직 시즌이 없습니다. ',
    empty_link: '새 시즌 만들기',
    empty_suffix: '',
    quick_actions: '빠른 작업',
    new_season: '+ 새 시즌',
    manage_seasons: '시즌 관리',
  },
  status: {
    active: '진행 중',
    draft: '임시',
    upcoming: '공개 예정',
    closed: '마감',
    completed: '완료',
  },
  seasons_list: {
    title: '시즌 관리',
    subtitle: '모든 시즌의 운영 파라미터.',
    new_season: '+ 새 시즌',
    deleted_banner: '시즌이 삭제되었습니다.',
    load_failed: (msg) => `시즌을 불러오지 못했습니다: ${msg}`,
    col_name: '이름',
    col_number: '번호',
    col_status: '상태',
    col_prize_pool: '상금 풀',
    col_capacity: '정원',
    col_top_n: '본선 진출',
    col_apps_open: '신청 시작',
    edit: '수정 →',
    empty_prefix: '아직 시즌이 없습니다. ',
    empty_link: '첫 시즌 만들기',
    empty_suffix: '',
  },
  season_new: {
    back: '← 시즌 관리',
    title: '새 시즌',
    description:
      '기본값은 표준 토너먼트 프로필로 채워집니다. 저장하면 시즌이 임시(draft) 상태로 생성됩니다 — 진행 중(active)으로 상태를 변경하기 전까지 공개 사이트에 표시되지 않습니다.',
  },
  season_edit: {
    back: '← 시즌 관리',
    title_prefix: '수정:',
    season_label: (n) => `시즌 ${n}`,
    last_updated: (date) => `최근 수정 ${date}`,
    saved_banner: '시즌이 저장되었습니다. 공개 사이트 캐시가 갱신되었습니다.',
    danger_zone: '위험 영역',
  },
  season_form: {
    validation_failed: '검증 실패',
    saved: '저장되었습니다.',
    group_info: '시즌 정보',
    group_capacity: '정원 및 선발',
    group_video: '영상 길이 (초)',
    group_timing: '시간 설정',
    group_pool: '상금 풀 및 참가비 (USD)',
    group_split: '상금 분배 (합계 100%)',
    group_scoring: '채점 비율 (합계 1.0)',
    group_ai_weights: 'AI 채점 가중치 (합계 1.0)',
    group_ai_panel: 'AI 패널',
    group_integrity: '부정 행위 임계값',
    group_schedule: '일정',
    field_name: '이름',
    field_season_number: '시즌 번호',
    field_status: '상태',
    field_max_applicants: '최대 지원자',
    field_top_n: '본선 진출자 수 (자동 산출 결과)',
    group_advancement: '진출 및 연기 정책 (2단계)',
    field_min_participants: '최소 참가자 (예선)',
    field_defer_days: '연기 연장 (일)',
    field_max_defer: '최대 연기 횟수',
    field_advance_pct: '진출 비율 (예선 → 본선)',
    field_advance_min: '진출 최소 (클램프)',
    field_advance_max: '진출 최대 (클램프)',
    hint_main_round_semifinal: 'main_round = 본선',
    hint_advance_pct: '예: 0.10 = 상위 10%, 이후 [최소, 최대]로 클램프',
    hint_defer: '최소 참가자 미달 시 마감 N일 연장, 최대 횟수까지',
    field_video_app_min: '지원 영상 최소',
    field_video_app_max: '지원 영상 최대',
    field_video_main: '본선 영상',
    field_theme_reveal: '주제 공개 (분 전)',
    field_submission_hours: '제출 기간 (시간)',
    field_total_pool: '총 상금 풀',
    field_entry_fee: '참가비',
    field_1st_place: '1등',
    field_2nd_place: '2등',
    field_3rd_place: '3등',
    field_community_vote: '커뮤니티 투표 가중치',
    field_ai_score: 'AI 점수 가중치',
    field_intent: '의도 (Intent)',
    field_execution: '실행 (Execution)',
    field_originality: '독창성 (Originality)',
    field_integrity: '진정성 (Integrity)',
    field_flag_integrity: '진정성 플래그 임계값',
    field_flag_spread: '편차 플래그 임계값',
    field_app_open: '신청 시작',
    field_app_close: '신청 마감',
    field_scoring_complete: '채점 완료',
    field_main_start: '본선 시작',
    field_main_end: '본선 종료',
    field_awards: '시상 발표',
    hint_07: '예: 0.7',
    hint_03: '예: 0.3',
    hint_0_100: '0~100',
    split_total_label: '합계',
    split_total_bad: '✕ 합계가 100%가 되어야 합니다',
    saving: '저장 중…',
    save_changes: '변경사항 저장',
    create_season: '시즌 생성',
    save_caption: '저장 즉시 공개 사이트에 반영됩니다.',
    ai_model_name_ph: '모델명 (예: claude-opus-4-5)',
    ai_provider_ph: '제공자 (예: Anthropic)',
    integrity_check: '진정성',
    add_ai_model: '+ AI 모델 추가',
    remove_model_aria: '모델 삭제',
    group_studio: 'Studio (인앱 생성)',
    field_studio_round: 'Studio 라운드',
    field_studio_max_gen: '1인당 라운드별 최대 생성 횟수',
    studio_round_application: '예선만',
    studio_round_main: '본선만',
    studio_round_both: '둘 다 (서버가 일정으로 판정)',
    hint_studio_round: '"둘 다"는 본선 시작 시각 기준으로 라운드가 결정됩니다.',
    group_lobby: '로비 (메인 토너먼트 카드)',
    field_poster_url: '포스터 URL',
    field_lobby_featured: '로비 featured (맨 앞 고정)',
    hint_poster_url: '선택. 비우면 퍼플 그라데이션 + 테마 폴백.',
  },
  delete: {
    button: '시즌 삭제',
    confirm_title: '이 시즌을 삭제하시겠습니까?',
    confirm_body_lead: (name) =>
      `${name}이(가) 영구 삭제되며 공개 사이트의 모든 참조에서 제거됩니다. 이 시즌의 지원서는 삭제되지 않지만 고아 상태가 됩니다. 확인하려면 `,
    confirm_body_type: 'delete <이름>',
    confirm_body_tail: '을(를) 입력하세요.',
    confirm_input_ph: (name) => `delete ${name}`,
    delete_forever: '영구 삭제',
    deleting: '삭제 중…',
    cancel: '취소',
    delete_failed: '삭제 실패',
  },
  login: {
    brand_tag: 'OXXOVO',
    title: '관리자 콘솔',
    subtitle: '관리자 전용.',
    email: '이메일',
    password: '비밀번호',
    sign_in: '로그인',
    signing_in: '로그인 중…',
    err_not_admin: '관리자 권한이 없는 계정입니다.',
    err_recovery_expired:
      '비밀번호 복구 링크가 만료되었습니다. 새로 요청해주세요.',
    err_callback_failed: (reason) =>
      `로그인 콜백 실패${reason ? `: ${reason}` : '.'}`,
    err_missing_code: '로그인 링크에 필수 파라미터가 누락되었습니다.',
  },
  reset_password: {
    brand_tag: 'OXXOVO',
    title: '새 비밀번호 설정',
    signed_in_as_prefix: '로그인된 계정: ',
    new_password: '새 비밀번호',
    confirm_password: '비밀번호 확인',
    submit: '새 비밀번호 설정',
    submitting: '업데이트 중…',
    success: '비밀번호가 업데이트되었습니다. 이동 중…',
    min_length: (n) => `비밀번호는 최소 ${n}자 이상이어야 합니다.`,
    mismatch: '비밀번호가 일치하지 않습니다.',
  },
  applications: {
    title: '지원자 관리',
    subtitle: '전체 지원자를 조회/필터/관리합니다.',
    season_select_label: '시즌',
    segment_all: '전체',
    segment_pending: '대기',
    segment_flagged: '검토 필요',
    segment_top50: 'Top 50',
    segment_waitlist: '대기자',
    segment_awarded: '시상자',
    segment_rejected: '미진출',
    judging_axis_label: '심사',
    judging_all: '전체',
    judging_unjudged: '★미채점',
    judging_in_progress: '진행 중',
    judging_failed: '실패',
    judging_completed: '완료',
    segment_count: (n) => `(${n})`,
    search_placeholder: '이름, 이메일, 채널 검색…',
    sort_label: '정렬',
    sort_submitted_desc: '최신 신청 순',
    sort_submitted_asc: '오래된 신청 순',
    sort_score_desc: '점수 높은 순',
    sort_name_asc: '이름 가나다 순',
    csv_export: 'CSV 내보내기',
    csv_exported: (n) => `${n}건 내보냄.`,
    col_name: '이름',
    col_email: '이메일',
    col_country: '국가',
    col_status: '상태',
    col_ai_service: 'AI 서비스',
    col_submitted: '신청 시간',
    col_score: '점수',
    col_grade: '등급',
    col_integrity: '진정성',
    empty: '현재 필터에 해당하는 지원자가 없습니다.',
    score_pending: '—',
    recommendations_title: (n) => `본선 진출 추천 (Top ${n})`,
    recommendations_subtitle: 'verified_score 기준 자동 추천 결과입니다. 검토 후 적용해 주세요.',
    recommendations_empty: '채점이 아직 완료되지 않았습니다. 채점 완료 후 추천 결과가 표시됩니다.',
    recommendations_recommended_at: (date) => `추천 생성 시각: ${date}`,
    recommendations_col_rank: '순위',
    recommendations_col_score: '점수',
    recommendations_apply_btn: '추천 적용',
    recommendations_apply_confirm_message: (n) =>
      `Top ${n}을 'selected'로, 나머지를 'rejected'로 일괄 변경하고 자동 이메일을 발송합니다. 진행하시겠어요?`,
    recommendations_apply_confirm_btn: '적용',
    recommendations_apply_cancel_btn: '취소',
    recommendations_applied_at: (date, admin) => `적용 시각: ${date} (${admin})`,
    recommendations_applied_status: '적용 완료',
    recommendations_flagged_section_title: '검토 대기 신청 (자동 추천 제외)',
    recommendations_flagged_section_note:
      '다음 신청은 무결성 우려로 자동 추천에서 제외되었습니다. 운영진 검토 후 상태 변경이 필요합니다.',
    recommendations_total_label: (n) => `총 ${n}건 추천됨`,
    apply_rec_err_unauthorized: '관리자 인증이 필요합니다.',
    apply_rec_err_season_not_found: '시즌을 찾을 수 없습니다.',
    apply_rec_err_no_recommendations: '적용할 추천 결과가 없습니다.',
    apply_rec_err_race_or_already_applied:
      '이미 적용되었거나 다른 관리자가 동시에 적용 중입니다.',
    apply_rec_err_update_failed: '적용 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  },
  application_detail: {
    back: '← 지원자 관리',
    section_applicant: '지원자 정보',
    section_statement: '자기소개',
    section_video: '영상',
    section_actions: '관리자 작업',
    section_scoring: '채점 결과',
    section_integrity_review: '진정성 검토',
    label_name: '이름',
    label_email: '이메일',
    label_country: '국가',
    label_channel: '채널',
    label_ai_service: 'AI 서비스',
    label_submitted: '신청 시간',
    label_status: '상태',
    label_award_rank: '시상',
    no_country: '—',
    no_channel: '—',
    notes_label: '관리자 메모 (비공개)',
    notes_placeholder: '내부 관찰, 부정 의심 플래그, 후속 조치…',
    notes_save: '메모 저장',
    notes_saving: '저장 중…',
    notes_saved: '저장됨.',
    status_change_label: '상태 변경',
    award_rank_label: '시상 순위 지정',
    award_rank_none: '시상 없음',
    award_rank_1st: '1등',
    award_rank_2nd: '2등',
    award_rank_3rd: '3등',
    save_status: '상태 저장',
    save_award: '시상 저장',
    scoring_placeholder: 'Triple-AI 채점 결과는 3차 통합 후 표시됩니다.',
    scoring_no_data: '아직 채점되지 않았습니다. oxxovo-scoring 시스템이 자동으로 처리합니다.',
    scoring_in_progress: 'Triple-AI 채점 진행 중…',
    scoring_failed: '채점 실패 — 오류는 아래 참조.',
    scoring_verified_score: 'OXXOVO 검증 점수',
    scoring_grade: '등급',
    scoring_subscores: '세부 점수 (Consensus)',
    scoring_intent: '의도 (25%)',
    scoring_execution: '실행 (45%)',
    scoring_originality: '독창성 (20%)',
    scoring_integrity_weight: '진정성 (10%)',
    scoring_judged_at: (date) => `채점 완료: ${date}`,
    scoring_cost: (usd) => `비용: ${usd}`,
    integrity_confidence_label: '신뢰도',
    integrity_score_label: 'Claude Integrity 점수',
    integrity_explanation_label: 'AI 사유',
    integrity_recommendation_label: 'AI 추천',
    integrity_high_warning: '명백한 의심 — 진행 전 관리자 검토가 필요합니다.',
    ai_outputs_toggle: 'AI 원본 출력 보기',
    ai_outputs_hide: 'AI 원본 출력 접기',
  },
  video: {
    embed_failed: '이 영상은 임베드할 수 없습니다.',
    open_external: '새 탭에서 열기 ↗',
    raw_url_label: '원본 URL',
    no_url: '영상 URL이 없습니다.',
  },
  contacts: {
    title: '시상자 연락처',
    subtitle: '시상자가 본인 프로필에서 직접 입력한 정보입니다.',
    season_select_label: '시즌',
    search_placeholder: '이름, 이메일 검색…',
    csv_export: 'CSV 내보내기',
    col_season: '시즌',
    col_name: '이름',
    col_email: '이메일',
    col_award: '시상',
    col_phone: '전화',
    col_address: '주소',
    col_messenger: '메신저',
    col_filled_at: '입력 시간',
    pending_badge: '대기 중',
    empty: '아직 시상자가 없습니다.',
    not_filled: '—',
  },
  pre_reg: {
    title: '사전 등록',
    subtitle: '/pre-register에서 수집된 이메일과 UTM 유입 정보.',
    season_select_label: '시즌',
    search_placeholder: '이메일, UTM 검색…',
    count_label: (n) => `${n}건`,
    csv_export: 'CSV 내보내기',
    col_email: '이메일',
    col_season: '시즌',
    col_utm_source: '소스',
    col_utm_medium: '매체',
    col_utm_campaign: '캠페인',
    col_referrer: '리퍼러',
    col_status: '상태',
    col_created_at: '등록 시간',
    empty: '현재 필터에 해당하는 사전 등록이 없습니다.',
  },
  emails: {
    title: '이메일',
    subtitle:
      '사이트가 발송한 모든 이메일과 발송 사유, 도달 여부 기록. 발송은 모두 자동이며, 실패한 발송은 cron이 자동으로 재시도합니다.',
    season_select_label: '시즌',
    template_label: '템플릿',
    status_label: '상태',
    language_label: '언어',
    search_placeholder: '수신자, 제목 검색…',
    template_all: '모든 템플릿',
    status_all: '모든 상태',
    language_all: '모든 언어',
    template_pre_registered: '사전 등록',
    template_application_received: '신청 접수',
    template_waitlisted: '대기자 등록',
    template_selected_top50: '본선 진출 (Top 50)',
    template_not_selected: '예선 결과 안내 (미진출)',
    template_main_round_start: '본선 시작',
    template_submission_deadline: '제출 마감 임박',
    template_results_announced: '결과 발표',
    template_awarded_contact_request: '시상 — 연락처 요청',
    status_sent: '발송됨',
    status_failed: '실패',
    status_skipped: '스킵',
    status_queued: '대기',
    stat_total: '전체',
    stat_sent: '발송 성공',
    stat_failed: '실패',
    stat_skipped: '스킵',
    col_sent_at: '발송 시간',
    col_template: '템플릿',
    col_recipient: '수신자',
    col_lang: '언어',
    col_status: '상태',
    col_subject: '제목',
    col_error: '오류',
    col_meta: '메타',
    empty: '현재 필터에 해당하는 이메일이 없습니다.',
    pager_prev: '← 이전',
    pager_next: '다음 →',
    pager_label: (start, end, total) => `${total}건 중 ${start}–${end}`,
    retry_note:
      '실패한 발송은 cron이 15분 / 30분 / 60분 / 120분 백오프로 자동 재시도합니다 (최대 4회).',
  },
  profile: {
    page_title: '크리에이터 프로필',
    header_brand: 'OXXOVO',
    log_out: '로그아웃',
    loading: '불러오는 중…',
    auth_required: '프로필을 보려면 로그인이 필요합니다.',
    auth_required_action: '로그인 페이지로',
    loading_failed: '프로필 데이터를 불러오지 못했습니다. 다시 시도해주세요.',
    section_my_application: '내 신청',
    section_video: '내 영상',
    section_status: '상태',
    section_scoring: 'Triple-AI 채점',
    section_winner_form: '시상자 연락처 입력',
    section_history: '시즌 기록',
    mem_section: '멤버십',
    mem_tier_creator: '크리에이터 멤버십',
    mem_tier_general: '멤버',
    mem_status_active: '활성',
    mem_status_past_due: '결제 실패',
    mem_status_canceled: '해지됨',
    mem_founding_badge: (n: number) => `파운딩 크리에이터 #${n}`,
    mem_renews_on: (date: string) => `${date}에 갱신`,
    mem_cancels_on: (date: string) => `${date}에 해지 — 그때까지 이용 가능`,
    mem_free_until: (date: string) => `${date}까지 무료`,
    mem_past_due_note:
      '최근 결제가 실패했습니다. 카드를 업데이트해주세요 — 자동으로 재시도합니다.',
    mem_cancel_btn: '멤버십 해지',
    mem_resume_btn: '멤버십 재개',
    mem_cancel_confirm:
      '멤버십을 해지하시겠어요? 현재 기간이 끝날 때까지 크리에이터 권한이 유지되며, 이후 무료 멤버로 전환됩니다.',
    mem_canceling: '해지 중…',
    mem_resuming: '재개 중…',
    mem_action_err: '멤버십을 변경하지 못했습니다. 다시 시도해주세요.',
    no_application_title: '신청 기록 없음',
    no_application_body: '이 이메일로 신청한 시즌이 없습니다.',
    no_application_cta: '지금 신청하기',
    label_creator_name: '크리에이터 이름',
    label_country: '국가',
    label_channel: '채널',
    label_ai_service: 'AI 서비스',
    label_submitted: '신청 시간',
    label_statement: '자기소개',
    label_season: '시즌',
    status_pending_msg: '신청이 접수되었습니다. 시즌 마감 후 채점이 진행됩니다.',
    status_waitlist_msg: '대기자 명단에 등록되었습니다. Top 50 결원 발생 시 알려드립니다.',
    status_verifying_msg: 'Triple-AI 검증이 진행 중입니다.',
    status_eligible_msg: '검증을 통과했습니다. 본선 진출 자격이 있습니다.',
    status_selected_msg: '축하합니다 — Top 50에 선발되셨습니다.',
    status_awarded_msg:
      '축하합니다! 시상자로 선정되셨습니다. 상금/상패 발송을 위해 아래 연락처를 입력해주세요.',
    status_rejected_msg: '이번 시즌 본선에는 오르지 못했습니다. 다음 시즌에서 다시 만나요.',
    scoring_placeholder: 'Triple-AI 채점 결과는 3차 통합 후 표시됩니다.',
    winner_form_intro:
      '상금/상패 발송을 위해 전화번호와 우편 주소가 필요합니다. 메신저 ID는 선택 사항이며, 긴급한 연락이 필요한 경우에만 사용됩니다.',
    winner_form_phone: '전화번호',
    winner_form_phone_ph: '+82 10 1234 5678',
    winner_form_address: '우편 주소',
    winner_form_address_ph: '도로명/지번, 시/도, 우편번호, 국가',
    winner_form_messenger: '메신저 ID (선택)',
    winner_form_messenger_hint:
      '자유 입력. 예: "KakaoTalk: oxxovo" 또는 "WhatsApp: +82…" 또는 "Telegram: @user".',
    winner_form_messenger_ph: '플랫폼: ID',
    winner_form_save: '연락처 저장',
    winner_form_saving: '저장 중…',
    winner_form_already_saved: '저장되었습니다. 언제든지 수정 가능합니다.',
    winner_form_updated_at: (date) => `최근 수정 ${date}`,
    winner_form_err_phone: '전화번호는 필수입니다.',
    winner_form_err_address: '우편 주소는 필수입니다.',
    winner_form_err_invalid_token: '세션이 만료되었습니다. 다시 로그인해주세요.',
    winner_form_err_not_owner: '본인의 신청만 수정 가능합니다.',
    winner_form_err_not_awarded: '이 신청은 시상자 상태가 아닙니다.',
    winner_form_err_not_found: '신청을 찾을 수 없습니다.',
    winner_form_err_save_failed: (msg) => `저장 실패${msg ? `: ${msg}` : '.'}`,
    history_empty: '아직 토너먼트 기록이 없습니다.',
    history_season_card: (n, name) => `시즌 ${n} · ${name}`,
    celebration_title_1st: '우승자',
    celebration_title_2nd: '준우승',
    celebration_title_3rd: '3위',
    celebration_subtitle_1st: 'OXXOVO Genesis 최고의 자리.',
    celebration_subtitle_2nd: '이번 시즌 최정상급의 작품입니다.',
    celebration_subtitle_3rd: '포디엄에 오르신 것을 축하드립니다.',
    celebration_prize_label: '상금',
    celebration_founding_creator: '파운딩 크리에이터',
    celebration_season_label: (n, name) => `시즌 ${n} — ${name}`,
    main_round_section_title: '본선 영상 제출',
    main_round_theme_label: '본선 테마',
    main_round_theme_full_link: '전체 규정 보기 →',
    main_round_allowed_platforms_label: '허용 플랫폼',
    main_round_external_url_closed: (allowed) =>
      `이번 시즌 본선은 ${allowed}에서만 제출할 수 있어, 여기에 입력할 링크가 없습니다.`,
    main_round_video_url_label: '영상 URL',
    main_round_video_url_placeholder: 'YouTube, Vimeo 등 영상 링크',
    main_round_submitted_video_label: '제출한 본선 영상',
    main_round_submitted_at_label: '제출 시각',
    main_round_close_countdown_label: '본선 마감까지',
    main_round_theme_reveal_countdown_label: '테마 공개까지',
    countdown_unit_day: '일',
    countdown_unit_hour: '시간',
    countdown_unit_minute: '분',
    countdown_unit_second: '초',
    main_round_video_url_err_empty: '영상 URL을 입력해주세요.',
    main_round_video_url_err_unknown: '지원하지 않는 플랫폼입니다.',
    main_round_video_url_err_not_allowed: '이 시즌에 허용된 플랫폼이 아닙니다.',
    main_round_submit_btn: '제출하기',
    main_round_submitting: '제출 중…',
    main_round_modal_confirm: '제출',
    main_round_modal_cancel: '취소',
    status_main_round_submitted_msg: '본선 영상을 제출하셨습니다. 결과 발표를 기다려주세요.',
    status_flagged_msg: '신청에 대한 운영진 검토가 진행 중입니다.',
    apply_err_missing_field: '필수 항목이 누락되었습니다.',
    apply_err_agreements_required: '세 가지 동의 사항에 모두 동의해 주셔야 합니다.',
    apply_err_statement_length: 'Creator Statement는 150~250자 사이여야 합니다.',
    apply_err_duration_range: (min, max) =>
      `영상 길이는 ${min}~${max}초 사이여야 합니다.`,
    apply_err_video_platform_not_allowed: (allowed) =>
      `이번 시즌은 ${allowed} 작품만 접수합니다.`,
    apply_err_season_not_found: '시즌 설정을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.',
    apply_err_season_not_open: '이번 시즌 신청이 아직 시작되지 않았습니다.',
    apply_err_season_closed: '이번 시즌 신청이 마감되었습니다.',
    apply_err_duplicate_email: '이 이메일로 이미 신청서가 제출되었습니다.',
    apply_err_membership_required: '신청하려면 크리에이터 멤버십이 필요합니다. 멤버십을 활성화한 뒤 다시 시도해주세요.',
    apply_err_server_error: '신청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    main_round_err_invalid_token: '세션이 만료되었습니다. 다시 로그인해 주세요.',
    main_round_err_not_found: '신청을 찾을 수 없습니다.',
    main_round_err_not_owner: '본인의 신청만 제출할 수 있습니다.',
    main_round_err_season_not_found: '시즌 설정을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.',
    main_round_err_not_selected: '본선 진출자만 영상을 제출할 수 있습니다.',
    main_round_err_season_dates_not_set: '시즌 일정이 아직 확정되지 않았습니다.',
    main_round_err_before_start: '본선이 아직 시작되지 않았습니다.',
    main_round_err_after_close: '본선 접수가 마감되었습니다.',
    main_round_err_video_url_required: '영상 URL을 입력해 주세요.',
    main_round_err_video_url_invalid: '지원하지 않는 플랫폼입니다.',
    main_round_err_video_url_not_allowed: '이 시즌에 허용된 플랫폼이 아닙니다.',
    main_round_err_race_or_already_submitted: '이미 본선 영상을 제출하셨습니다.',
    main_round_err_save_failed: '제출 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  },
  main_results: {
    back_to_season: '시즌으로 돌아가기',
    page_title: '본선 결과',
    subtitle:
      '본선 진출자는 AI 최종 점수로 자동 랭킹됩니다. 상위 3 수상을 검토 후 승인하거나, 부정·시스템 오류 시 override 하세요.',
    weights_label: (ai, community) => `AI ${ai}% / 커뮤니티 ${community}%`,
    soak_note: 'Soak 모드 - 최종 점수 = AI 점수 (커뮤니티 가중 0)',
    theme_label: '공통 주제',
    empty: '아직 본선 제출이 없습니다. oxxovo-scoring 채점 후 여기에 표시됩니다.',
    approve_btn: '상위 3 수상 승인',
    approve_hint:
      '최종 점수 상위 3명에게 수상 순위 1/2/3을 부여하고 상금 지급 요청 이메일을 발송합니다.',
    approve_confirm_message:
      '최종 점수 상위 3명을 수상자 1/2/3위로 승인할까요? 수상 순위가 설정되고 상금 지급 요청 이메일이 발송됩니다.',
    approve_confirm_btn: '승인',
    approve_cancel_btn: '취소',
    approve_err_schedule_not_reached:
      '아직 이릅니다. 본선과 커뮤니티 투표가 모두 끝나야 승인이 열립니다.',
    approve_err_already_awarded:
      '이미 수상자가 기록되어 있습니다. 순위를 바꾸려면 개별 override(사유 필수)를 쓰세요.',
    approve_err_nothing_submitted: '순위를 매길 본선 제출작이 없습니다.',
    approve_err_scoring_incomplete:
      '본선 채점이 끝나지 않았습니다. 지금 승인하면 채점 안 된 작품이 경고 없이 빠진 채로 상위 3위가 정해집니다.',
    approve_err_vote_window_open:
      '커뮤니티 투표가 아직 안 끝났습니다. 이번 시즌은 투표가 최종점수에 반영되므로 집계가 미완입니다.',
    approve_err_season_not_found: '시즌을 찾을 수 없습니다.',
    approve_err_no_scored: '아직 채점된 본선 제출이 없습니다.',
    approve_err_update_failed: '수상 순위 설정에 실패했습니다. 다시 시도해 주세요.',
    col_rank: '순위',
    col_creator: '크리에이터',
    col_final: '최종',
    col_grade: '등급',
    col_award: '수상',
    col_actions: '관리',
    col_video: '영상',
    no_video: '영상 없음',
    final_pending: '대기',
    award_badge: (rank) => `${rank}위 수상`,
    override_btn: '수동 조정',
    override_note:
      '부정·표절·시스템 오류 시 수상 순위를 수동 조정합니다. 사유는 audit용으로 기록됩니다.',
    override_prev: (reason) => `이전 사유: ${reason}`,
    override_rank_label: '수상 순위',
    override_rank_ph: '예: 1',
    override_reason_ph: 'override 사유 (필수) - 예: 표절 확인, 채점 시스템 오류',
    override_save_btn: '저장',
    override_cancel_btn: '취소',
    override_err_required: 'override 사유는 필수입니다.',
    override_err_rank: '수상 순위는 1-99, 또는 비워서 해제하세요.',
  },
  membership: {
    brand_tag: 'OXXOVO 멤버십',
    hero_title: '크리에이터 멤버십',
    hero_subtitle:
      'OXXOVO 아레나에 합류하세요. 참여 방식에 맞는 멤버십을 선택하고 창작, 경쟁, 투표를 시작하세요.',
    founding_badge: (remaining, cap) => `Founding Creator 잔여 ${remaining} / ${cap}`,
    founding_full: 'Founding Creator 자리가 모두 마감되었습니다.',
    compare_title: '등급별 권한',
    col_anonymous: '비회원',
    col_general: '일반 멤버',
    col_creator: '크리에이터',
    col_partner: '파트너',
    price_free: '무료',
    price_creator: (price, interval) => `$${price} / ${interval}`,
    partner_track_caption: '별도 트랙 — 개설 권한',
    interval_unit: (interval) =>
      (({ day: '일', week: '주', month: '월', year: '년' } as Record<string, string>)[interval] ??
        interval),
    row_browse: '시합 둘러보기',
    row_vote: '작품 투표',
    row_compete: '시합 참가',
    row_studio: 'Studio 창작',
    row_host: '시합 개설',
    vote_note: '커뮤니티 투표는 추후 시즌에 열립니다.',
    founding_section_title: 'Founding Creator',
    founding_section_body: (cap, months) =>
      `선착순 ${cap}명 한정 — ${months === 12 ? '1년' : `${months}개월`} 무료 멤버십 · Founding 디지털 배지`,
    founding_renew_note: '이후 취소하지 않으면 자동 갱신됩니다 — 갱신 전에 미리 알려드립니다.',
    cta_coming_soon: '준비 중',
    cta_signup: '가입하고 시작하기',
    cta_become_creator: '크리에이터 되기',
    cta_youre_creator: '크리에이터입니다 ✓ — 프로필로',
    cta_creator_note: '멤버십으로 시합 참가와 Studio가 열립니다.',
    back_home: '← 홈으로',
  },
  landing: {
    nav_tournament: '대회 안내',
    nav_studio: '스튜디오',
    nav_watch: '감상',
    nav_how: '참가 방법',
    nav_about: '소개',
    nav_membership: '멤버십',
    nav_faq: '자주 묻는 질문',
    greeting: (username) => `${username}님`,
    logout: '로그아웃',
    login: '로그인',
    cta_default: '참가 신청',
    cta_open: (seasonName) => `${seasonName} 참가 신청`,
    cta_before_open: '신청 오픈 알림 받기',
    cta_waitlist: '대기자 명단 등록',
    eyebrow: 'AI 창작 경쟁 플랫폼',
    h1_line1: 'AI 크리에이터를 위한',
    h1_line2: '글로벌 아레나.',
    sub1: 'AI는 쉽습니다. 이기는 건 어렵습니다.',
    sub2: '같은 도구. 같은 시간. 오직 실력으로.',
    hero_tournament_btn: '대회 안내',
    hero_submit_prefix: 'AI 영상을 제출하세요.',
    hero_submit_scoring: (panelLabel) => `${panelLabel} 채점 — 복수의 이종 AI 모델이 참여합니다.`,
    hero_submit_fallback: 'AI 검증 채점.',
    countdown_label: '신청 마감까지',
    countdown_days: '일',
    countdown_hrs: '시',
    countdown_min: '분',
    countdown_sec: '초',
    watch_link: '대회 감상하기 →',
    feat1_title: '실시간',
    feat1_desc: '라이브 대회. 긴장을 느껴보세요.',
    feat2_title: '검증',
    feat2_desc: '같은 주제. 같은 조건.',
    feat3_title: '랭킹',
    feat3_desc: '글로벌 리더보드. 실력으로 증명하세요.',
    feat4_title: '글로벌',
    feat4_desc: '전 세계 크리에이터가 모입니다.',
    feat5_title: '크리에이터를 위해',
    feat5_desc: '크리에이터가 만들었습니다. 크리에이터를 위해.',
    how_eyebrow: '참가 방법',
    how_h2: '제출하고. 검증받고. 우승하세요.',
    step1_title: '영상 공유',
    step1_body: (min, max) =>
      `OXXOVO 스튜디오에서 영상(${min}~${max}초)을 만들고 그대로 제출하세요. 모두가 같은 도구로 작업합니다 — 작품을 가르는 건 예산이 아니라 당신의 연출입니다.`,
    step2_title: (panelLabel) => `${panelLabel} 심사`,
    step2_body: (modelCount) =>
      `서로 다른 ${modelCount}개 회사의 독립 AI 모델 ${modelCount}개가 동시에 작품을 채점합니다. 단일 AI 편향을 제거합니다.`,
    step3_title: '점수 확인',
    step3_body: (intentPct, execPct, origPct) =>
      `공개 항목 세 가지 — 기획 명확성(${intentPct}), 완성도(${execPct}), 독창성(${origPct}) — 로 OXXOVO 점수를 받습니다. 모든 작품은 무결성 자동 검증을 함께 거칩니다.`,
    step4_title: '타이틀 획득',
    step4_body: (advanceLabel, seasonName, total, first, second, third) =>
      `${advanceLabel}가 본선에 진출해 ${seasonName} 총상금 $${total}($${first} / $${second} / $${third})를 두고 겨룹니다.`,
    about_eyebrow: '소개',
    about_h2_line1: 'AI 영상 크리에이터를 위한',
    about_h2_line2: '첫 번째 검증 아레나.',
    about_body: (panelLabel) =>
      `OXXOVO는 AI 영상 크리에이터를 위한 글로벌 아레나입니다. 독립적인 ${panelLabel} 채점으로 모든 출품작을 검증해 매 라운드의 공정성을 지킵니다. 라스베이거스에 설립된 OXXOVO Labs Inc.가 시즌제 대회인 AI Creator League를 운영합니다 — 겨루고, 검증받고, 발견되는 곳입니다.`,
    stat1_label: '독립 AI 심사',
    stat2_value: '글로벌',
    stat2_label: '누구나 참가',
    stat3_value: '검증',
    stat3_label: '같은 규칙. 오직 실력으로.',
    faq_eyebrow: '자주 묻는 질문',
    faq_h2: '이런 점이 궁금하실 겁니다',
    faq_q1: (seasonName) => `${seasonName}에는 누가 참가할 수 있나요?`,
    faq_a1: (min, max) =>
      `누구나, 어디서든 참가할 수 있습니다. 국적·나이·경력 제한이 없습니다. AI로 만든 영상(${min}~${max}초)과 무료 OXXOVO 계정만 있으면 됩니다.`,
    faq_q2: '참가 비용이 얼마인가요?',
    faq_q3: '어떤 도구로 만드나요?',
    faq_a3:
      '모두 OXXOVO 스튜디오에서 만듭니다. 같은 모델, 같은 조건으로 전원 동일합니다. 외부 도구를 가져올 필요도, 다른 곳에 구독할 필요도 없습니다. 그래야 결과를 견줄 수 있습니다.',
    faq_q4: '채점은 정확히 어떻게 이뤄지나요?',
    faq_a4_intro: (modelCount) => `각 영상은 AI 모델 ${modelCount}개가 동시에 심사합니다.`,
    faq_a4_outro: (intentPct, execPct, origPct) =>
      `최종 OXXOVO 점수는 여러 항목의 가중 평균입니다. 공개되는 항목은 기획 명확성(${intentPct}), 완성도(${execPct}), 독창성(${origPct}) 세 가지이며, 무결성은 별도로 자동 검증됩니다. 편차가 큰 점수는 자동으로 제외됩니다.`,
    faq_q5: (n) => `왜 AI 한 개가 아니라 ${n}개인가요?`,
    faq_a5: (n, panelLabel) =>
      `모든 AI에는 편향이 있습니다. 서로 다른 ${n}개 회사의 독립 모델 ${n}개를 쓰면 개별 편향이 서로 상쇄됩니다. 심사단이 같은 판단을 내렸을 때, 그 결과는 어떤 단일 AI의 판정보다 훨씬 믿을 수 있습니다. OXXOVO 채점이 ${panelLabel} 검증이라 불리는 이유입니다.`,
    faq_q6: (maxApplicants) => `저보다 먼저 ${maxApplicants}명이 신청하면 어떻게 되나요?`,
    faq_a6: (seasonName, maxApplicants) =>
      `${seasonName}은 최대 ${maxApplicants}명까지 받습니다. 신청 전에 정원이 차면 자동으로 ${seasonName} 대기자 명단에 오르고, 다음 시즌에 우선 참가하실 수 있습니다. 누구도 돌려보내지 않습니다.`,
    faq_q7: '상금은 어떻게 되나요?',
    faq_a7: (seasonName, total, first, second, third, advanceLabel) =>
      `${seasonName}의 총상금은 $${total}입니다(1등 $${first}, 2등 $${second}, 3등 $${third}). ${advanceLabel}가 본선 진출자 타이틀을 얻습니다.`,
    faq_q8: 'OXXOVO는 부정행위를 어떻게 막나요?',
    faq_a8:
      '무결성 검증이 허위 표기를 자동으로 잡아냅니다. 검증에 걸린 작품은 사람이 다시 확인합니다. 사용한 AI 도구나 콘텐츠 출처를 거짓으로 밝히면 자동 실격됩니다. 검증 기준과 비중은 공개하지 않습니다.',
    faq_q9: '결과는 언제 나오나요?',
    faq_a9:
      '채점은 제출 마감 이후 일괄로 진행됩니다. 개인 점수와 심사 근거는 예선 결과 안내와 함께 받으시고, 프로필에서도 확인하실 수 있습니다.',
    footer_tagline: 'AI 창작의 새로운 기준',
    footer_tournament: '대회 안내',
    footer_membership: '멤버십',
    footer_terms: '이용약관',
    footer_privacy: '개인정보처리방침',
    footer_rules: '대회 규정',
    loading: '불러오는 중…',
  },
  watch: {
    banner_tagline1: 'OXXOVO는 AI 크리에이터를 위한 글로벌 아레나입니다.',
    banner_tagline2: '같은 조건에서 만들고, 실력으로 경쟁합니다.',
    banner_learnmore: '랜딩 페이지에서 자세히 보기 ↗',
    hero_current: (seasonNumber) => `진행 중인 대회 — 시즌 ${seasonNumber}`,
    hero_ctx_results: '우승자가 발표됐습니다. 이번 시즌 상위 입상작을 확인해 보세요.',
    hero_ctx_voting: '관객 투표가 열렸습니다. 본선 작품을 보고 마음에 드는 크리에이터에게 투표하세요.',
    hero_ctx_judged: (dateStr) => `심사가 끝났습니다. 본선 진출자는 ${dateStr ? `${dateStr}에` : '곧'} 공개됩니다.`,
    hero_ctx_default: (roundName) =>
      `${roundName} 진행 중입니다. 영상은 제출된 순서대로 표시됩니다. 무료로 가입하시면 본선에서 투표하고 좋아하는 크리에이터를 응원하실 수 있습니다.`,
    hero_cta_results: '우승작 보기 →',
    hero_cta_default: '무료 가입하고 투표 →',
    finalists_kicker: '본선',
    finalists_title: '🏆 본선 진출자',
    finalist_badge: '본선 진출',
    featured_kicker: '주목',
    featured_title: '주목할 참가자',
    leaderboard_kicker: '순위',
    leaderboard_title: '리더보드',
    roundbadge_main: '본선',
    roundbadge_prelim: '예선',
    badge_verified: '✓ 검증됨',
    center_mainround: '본선',
    empty_entries: '아직 출품작이 없습니다. 참가자가 제출하면 여기에 표시됩니다.',
    votecount: (n) => `${n}표`,
    finalist_pending_note: '본선 영상 준비 중',
    results_kicker: '결과',
    finalist_prelim_kicker: '본선 진출자',
    main_round_results_title: '🏆 본선 결과',
    main_round_live_title: '🏆 본선 · 지금 시합 중',
    finalist_prelim_title: '본선 진출작 · 예선 라운드 작품',
    finalist_prelim_tag: '본선 진출작',
    card_judging: '⚡ AI 심사 중',
    card_voting: '🔥 투표중',
    card_awaiting_judgment: '심사 대기',
    featured_stats: (viewsStr, votesStr) => `조회 ${viewsStr} · 투표 ${votesStr}`,
    score_suffix: (score) => `Triple-AI ${score}점`,
    live_judging: (complete) => `Triple-AI ${complete ? '심사 완료' : '심사 중'}`,
    live_close_label: (isMain) => `${isMain ? '본선' : '예선'} 마감까지`,
    live_reveal_label: '본선 진출작 공개까지',
    live_vote_label: '투표 마감까지',
    live_theme_main: '본선 주제',
    live_theme_next: '다음 라운드 주제',
    live_countries_suffix: '개국 참가',
    champions_note: (seasonName, dateStr) =>
      dateStr ? `${seasonName ?? '시즌'} 우승자, ${dateStr} 발표` : '우승자는 심사가 끝난 뒤 발표됩니다.',
    search_placeholder: '영상·크리에이터 검색',
    signin: '로그인',
    badge_watch: 'WATCH',
    badge_subtitle: 'AI 크리에이터 리그',
    nav_home: '홈',
    nav_home_sub: '랜딩 페이지로 이동',
    nav_tournament: '대회 안내',
    nav_tournament_sub: '규정 · 일정 · 상금',
    nav_how: '참가 방법',
    nav_how_sub: '진행 과정 안내',
    nav_membership: '멤버십',
    nav_membership_sub: '가입 및 혜택',
    nav_faq: '자주 묻는 질문',
    nav_faq_sub: '궁금한 점 모아보기',
    nav_about: '소개',
    nav_about_sub: 'OXXOVO 소개',
    library_label: '보관함',
    lib_myvideos: '내 영상',
    lib_mylikes: '좋아요한 영상',
    lib_watchlater: '나중에 볼 영상',
    lib_history: '시청 기록',
    footer_tip_title: '모든 정보를 한곳에서',
    footer_tip_body: '지금 WATCH에 계십니다. 메뉴를 누르면 새 탭에서 열립니다.',
    filter_current: '진행 중인 대회',
    filter_all_competitions: '전체 대회',
    filter_newest: '최신순',
    filter_champions: '🏆 역대 우승자',
    filter_all_champions: '전체 우승자',
    filter_viewall: '전체 보기 →',
    host_suffix: (seasonName) => `${seasonName} · 주최`,
    sort_trending: '인기순',
    sort_latest: '최신순',
    sort_award: '수상작',
    round_prelim: '예선',
    round_main: '본선',
    winner_1st: '🥇 1위',
    winner_2nd: '🥈 2위',
    winner_3rd: '🥉 3위',
    sidebar_home: '홈',
    sidebar_tournament: '대회',
    sidebar_sort_label: '정렬',
    sidebar_seasons_label: '시즌',
    sidebar_all: '전체',
    sidebar_allrounds: '전체 라운드',
    sidebar_round_label: '라운드',
    sidebar_winners_label: '수상',
    sidebar_more_label: '더보기',
    sidebar_membership: '멤버십',
    sidebar_about: '소개',
    sidebar_how: '참가 방법',
    sidebar_qa: '질문과 답변',
    sidebar_subs_label: '구독',
    detail_roundlabel_main: '본선',
    detail_roundlabel_prelim: '예선',
    detail_staffpick: '운영진 추천',
    detail_winner: '🏆 수상작',
    detail_rank1: '🥇 1위',
    detail_rank2: '🥈 2위',
    detail_rank3: '🥉 3위',
    detail_winner_generic: '🏆 수상작',
    detail_views: (n) => `조회 ${n.toLocaleString()}회`,
    detail_comments_count: (n) => `댓글 ${n.toLocaleString()}개`,
    detail_madewith: (ai) => `${ai}로 제작`,
    detail_related_title: '이 시즌의 다른 작품',
    detail_related_empty: '아직 다른 작품이 없습니다.',
    detail_related_views_likes: (views, likes) => `조회 ${views.toLocaleString()}회 · 좋아요 ${likes.toLocaleString()}개`,
    detail_main_round_pending: '🏆 본선 진출작입니다 · 본선 영상은 준비 중입니다.',
    comments_count: (n) => `댓글 ${n}개`,
    comments_guidelines: '커뮤니티 가이드',
    comment_placeholder: '댓글을 남겨보세요…',
    comment_submit: '등록',
    comment_signin_prompt: '로그인하고 댓글 남기기',
    comments_empty: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.',
    comment_edited: '(수정됨)',
    comment_save: '저장',
    comment_cancel: '취소',
    comment_edit: '수정',
    comment_delete: '삭제',
    comment_delete_confirm: '이 댓글을 삭제할까요?',
    comment_report: '신고',
    comment_reported: '신고됨',
    follow_following: (creatorName) => `${creatorName} 팔로우 중`,
    follow_follow: (creatorName) => `${creatorName} 팔로우`,
    follow_btn_following: '팔로우 중',
    follow_btn_follow: '팔로우',
    save_saved: '저장됨',
    save_save: '저장',
    report_reported: '신고됨',
    report_report: '신고',
    share_copied: '복사됨',
    share_share: '공유',
    staffpick_on: '운영진 추천',
    staffpick_off: '운영진 추천으로 지정',
    vote_error_limit: (n) => `${n}표를 모두 사용하셨습니다. 다른 작품의 투표를 취소하면 바꾸실 수 있습니다.`,
    vote_error_closed: '투표가 마감됐습니다.',
    vote_notopen: '관객 투표가 아직 열리지 않았습니다.',
    vote_title: '관객 투표',
    vote_count: (n) => `${n.toLocaleString()}표`,
    vote_remaining: (remaining, cap) => `${remaining}/${cap}표 남음`,
    vote_closed_suffix: '투표 마감',
    vote_btn_voted: '✓ 투표함',
    vote_btn_vote: '투표',
    vote_btn_closed: '마감',
    vote_cap_used: (n) => `${n}표를 모두 쓰셨습니다 — 하나를 취소하면 바꿀 수 있습니다.`,
    score_title: 'Triple-AI 점수',
    score_intent: '기획 명확성',
    score_execution: '완성도',
    score_originality: '독창성',
    score_integrity_verified: '무결성 검증됨',
  },
}

const MESSAGES = {
  ko: MESSAGES_KO,
  en: MESSAGES_EN,
}
