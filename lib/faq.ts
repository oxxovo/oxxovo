// Public FAQ read -- landing page only. Mirrors getCurrentSeason()'s shape
// exactly (lib/seasons.ts): runs through the fixed-anon browser client
// against a PUBLIC VIEW, never the base table. `faq_items` itself has no
// anon/authenticated grant (service_role/admin only, same as
// admin_broadcasts) -- `faq_items_public` is the one thing anon can read,
// pre-filtered to is_active=true and stripped to display columns only
// (no created_by, no timestamps). Same reasoning as seasons_public: base
// table locked down after the 2026-08-14 seasons GRANT leak, public reads
// only ever go through a view built for exactly that purpose.

import { supabase } from './supabase'

export interface FaqItem {
  id: string
  surface: string
  questionEn: string
  questionKo: string
  answerEn: string
  answerKo: string
  sortOrder: number
}

/** Active FAQ items for one surface, sort_order ascending. Empty array on any
 *  read failure or when nothing is active -- caller falls back to the
 *  hardcoded copy (admin-i18n.ts faq_q1~q9/faq_a1~a9), never to a blank
 *  section. */
export async function getFaqItems(surface: string): Promise<FaqItem[]> {
  const { data, error } = await supabase
    .from('faq_items_public')
    .select('id, surface, question_en, question_ko, answer_en, answer_ko, sort_order')
    .eq('surface', surface)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[faq] getFaqItems failed:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    surface: r.surface as string,
    questionEn: r.question_en as string,
    questionKo: r.question_ko as string,
    answerEn: r.answer_en as string,
    answerKo: r.answer_ko as string,
    sortOrder: r.sort_order as number,
  }))
}
