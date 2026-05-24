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
      winners: string
      emails: string
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
      winners: 'Winners',
      emails: 'Emails',
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
    field_top_n: 'Top N advance',
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
      winners: '수상자 관리',
      emails: '이메일',
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
    field_top_n: '본선 진출자 수',
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
}

const MESSAGES = {
  ko: MESSAGES_KO,
  en: MESSAGES_EN,
}
