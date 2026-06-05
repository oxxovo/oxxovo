// System messages — DB 단일 진실원천 (system_messages 테이블).
// 운영 중 자주 검토/조정 가능한 메시지만 여기로 (현재 8개: reason 4 + 안내 4).
// 마케팅 카피, 라벨, 버튼은 lib/admin-i18n.ts 유지.
//
// fetch 패턴: client에서 직접 anon SELECT (RLS public_read 정책).
// 페이지 라이프사이클 1회 fetch — admin 편집은 다음 방문 시 반영.
// missing key → key 이름 fallback (운영자 catch + 사용자 정보 제공).

import { supabase } from './supabase'
import type { Lang } from './admin-i18n'

// 새 키 추가 시: (1) DB INSERT, (2) 이 union에 한 줄 추가, (3) 사용처 작성.
// system_messages_migration_2026-05.sql 시드와 1:1 매핑.
export type SystemMessageKey =
  | 'main_round_block_not_selected'
  | 'main_round_block_before_start'
  | 'main_round_block_after_close'
  | 'main_round_block_season_dates_not_set'
  | 'main_round_theme_reveal_waiting'
  | 'main_round_submission_warning'
  | 'main_round_submitted_confirmation'
  | 'main_round_submit_confirm_modal'

export type SystemMessages = Record<string, { ko: string; en: string }>

export async function loadSystemMessages(): Promise<SystemMessages> {
  const { data, error } = await supabase
    .from('system_messages')
    .select('key, ko, en')

  if (error) {
    // RLS 차단 / network 실패 등 — 빈 객체 반환. getMessage가 key 이름으로
    // fallback해서 운영자 catch 가능. 사용자에게도 깨진 화면 대신 정보 제공.
    console.error('[system-messages] fetch failed:', error.message)
    return {}
  }

  const map: SystemMessages = {}
  for (const row of data ?? []) {
    map[row.key] = { ko: row.ko, en: row.en }
  }
  return map
}

// messages === null (fetch 진행 중), 키 누락, DB 0 row 모두 같은 fail-safe.
// 본선 UI는 messages 로드 전에는 카드 자체를 loading state로 분기 권장.
export function getMessage(
  messages: SystemMessages | null,
  key: SystemMessageKey,
  lang: Lang,
): string {
  return messages?.[key]?.[lang] ?? key
}
