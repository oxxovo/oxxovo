// 9/9 홍보 중지 확대: 나머지 47편(1주차 14편 제외 전부)도 승인 해제.
// TK/본부 판정 2026-09-08~09 -- AI 심사 미확정 + promo_publish_weekdays가 채워지면
// 검수 없이 나갈 수 있다는 위험 확인됨(승인 토글만으로는 안전장치가 아니었음).
//   node --env-file=.env.local scripts/promo-unapprove-remaining-2026-09-09.mjs
import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await db.from('promo_videos')
  .update({ approved: false, approved_by: null, approved_at: null })
  .eq('approved', true)
  .is('deleted_at', null)
  .select('id')
if (error) { console.error('FAILED:', error.message); process.exit(1) }
console.log(`승인 해제: ${data.length}건`)

const { count: approvedCount } = await db.from('promo_videos').select('id', { count: 'exact', head: true }).eq('approved', true).is('deleted_at', null)
const { count: totalCount } = await db.from('promo_videos').select('id', { count: 'exact', head: true }).is('deleted_at', null)
console.log(`전체 승인 현황: ${approvedCount}/${totalCount}`)
process.exit(0)
