// Browser Supabase client (httpOnly cookie 기반 Auth) — admin + 일반 사용자
// 공통. 매직링크 로그인(signInWithOtp)/로그아웃(signOut)에 사용.
// 단일 인증 시스템으로 통합됨 ([[feedback-auth-pattern]]).

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
