// Admin 전용 browser Supabase client (httpOnly cookie 기반 Auth).
// 일반 사용자 페이지는 lib/supabase.ts (oxxovo_token localStorage 패턴) 사용.
// 두 시스템 병존 — 섞지 말 것 (feedback_auth_pattern memory 참조).

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
