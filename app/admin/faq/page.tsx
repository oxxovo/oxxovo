import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getMembershipLandingData } from '@/app/membership/actions'
import { FaqAdminView, type FaqRow } from './FaqAdminView'

export const dynamic = 'force-dynamic'

const SURFACE = 'landing_home'

export default async function FaqAdminPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data } = await admin
    .from('faq_items')
    .select('id, question_en, question_ko, answer_en, answer_ko, sort_order, is_active, updated_at')
    .eq('surface', SURFACE)
    .order('sort_order', { ascending: true })

  const rows: FaqRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    questionEn: r.question_en as string,
    questionKo: r.question_ko as string,
    answerEn: r.answer_en as string,
    answerKo: r.answer_ko as string,
    sortOrder: r.sort_order as number,
    isActive: r.is_active as boolean,
    updatedAt: r.updated_at as string,
  }))

  // Preview context -- same source LandingView.tsx reads, so what an admin
  // sees in preview is what a visitor would actually see, not a guess.
  const { data: season } = await admin.from('seasons').select('*').eq('id', 'season_0').single()
  const membership = await getMembershipLandingData().catch(() => null)

  return <FaqAdminView rows={rows} season={season} membership={membership} />
}
