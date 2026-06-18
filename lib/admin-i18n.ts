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

type Messages = {
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
    field_final_n: string
    field_final_start: string
    field_final_end: string
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
    main_round_allowed_platforms_label: string
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
    apply_err_season_not_found: string
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
    group_advancement: 'Advancement & deferral (3-stage)',
    field_min_participants: 'Min participants (preliminary)',
    field_defer_days: 'Defer extension (days)',
    field_max_defer: 'Max defer count',
    field_advance_pct: 'Advance % (prelim → semifinal)',
    field_advance_min: 'Advance min (clamp)',
    field_advance_max: 'Advance max (clamp)',
    field_final_n: 'Finalists (semifinal → final)',
    field_final_start: 'Final round start',
    field_final_end: 'Final round end',
    hint_main_round_semifinal: 'main_round = semifinal (준결승)',
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
    segment_rejected: 'Rejected',
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
    template_not_selected: 'Not selected',
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
    main_round_allowed_platforms_label: 'Allowed Platforms',
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
    apply_err_season_not_found: 'Season configuration not found. Please try again later.',
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
      `${cap} founding creators, ${months === 12 ? '1 year' : `${months} months`} free membership`,
    founding_renew_note:
      'Renews automatically afterward unless cancelled — we’ll remind you before it does.',
    cta_coming_soon: 'Coming soon',
    cta_signup: 'Sign up to get started',
    cta_become_creator: 'Become a Creator',
    cta_youre_creator: 'You’re a Creator ✓ — go to profile',
    cta_creator_note: 'Membership unlocks tournament entry and Studio.',
    back_home: '← Back to Home',
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
    field_top_n: '준결승 진출자 수 (자동 산출 결과)',
    group_advancement: '진출 및 연기 정책 (3단계)',
    field_min_participants: '최소 참가자 (예선)',
    field_defer_days: '연기 연장 (일)',
    field_max_defer: '최대 연기 횟수',
    field_advance_pct: '진출 비율 (예선 → 준결승)',
    field_advance_min: '진출 최소 (클램프)',
    field_advance_max: '진출 최대 (클램프)',
    field_final_n: '결승 진출자 수 (준결승 → 결승)',
    field_final_start: '결승 시작',
    field_final_end: '결승 종료',
    hint_main_round_semifinal: 'main_round = 준결승',
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
    segment_rejected: '탈락',
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
    template_not_selected: '탈락 통보',
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
    status_rejected_msg: '이번 시즌은 아쉽게 탈락하셨습니다. 다음 시즌에서 다시 만나뵙길 바랍니다.',
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
    main_round_allowed_platforms_label: '허용 플랫폼',
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
    apply_err_season_not_found: '시즌 설정을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.',
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
      `선착순 ${cap}명 크리에이터, ${months === 12 ? '1년' : `${months}개월`} 무료 멤버십`,
    founding_renew_note: '이후 취소하지 않으면 자동 갱신됩니다 — 갱신 전에 미리 알려드립니다.',
    cta_coming_soon: '준비 중',
    cta_signup: '가입하고 시작하기',
    cta_become_creator: '크리에이터 되기',
    cta_youre_creator: '크리에이터입니다 ✓ — 프로필로',
    cta_creator_note: '멤버십으로 시합 참가와 Studio가 열립니다.',
    back_home: '← 홈으로',
  },
}

const MESSAGES = {
  ko: MESSAGES_KO,
  en: MESSAGES_EN,
}
