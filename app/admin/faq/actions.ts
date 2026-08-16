'use server'

// admin FAQ 편집기 서버액션. 전부 requireAdmin 게이트 + service_role.
// 설계: reports/admin_faq_editor_design_2026-08-12.md

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getThemeRevealTime } from '@/lib/seasons'
import { loadFaqBannedWordLists, findBannedWords } from '@/lib/faq-banned-words'

const SURFACE = 'landing_home' // 1차 범위 (§6). faq_items.surface 컬럼은 2차('faq_page') 대비.

export type FaqItemInput = {
  id?: string
  questionEn: string
  questionKo: string
  answerEn: string
  answerKo: string
  sortOrder: number
}

export type SaveFaqItemState =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | { ok: false; warning: true; words: string[] } // ③ 확인 필요, 저장 안 됨 -- confirm=true로 재호출

function validate(input: FaqItemInput): string | null {
  if (!input.questionEn.trim()) return 'question (EN) is required'
  if (!input.questionKo.trim()) return 'question (KO) is required'
  if (!input.answerEn.trim()) return 'answer (EN) is required'
  if (!input.answerKo.trim()) return 'answer (KO) is required'
  return null
}

// 생성/수정 공용. id 없으면 insert, 있으면 update. is_active는 이 함수가
// 건드리지 않는다 -- 활성화는 setFaqItemActiveAction 하나만의 책임(④ 기간
// 가드가 그 경로에만 걸리게, 초안 저장까지 막으면 안 되므로).
export async function saveFaqItemAction(
  input: FaqItemInput,
  opts?: { confirm?: boolean },
): Promise<SaveFaqItemState> {
  const admin_profile = await requireAdmin()
  const err = validate(input)
  if (err) return { ok: false, error: err }

  // ③ 금지어 경고 -- 차단 아님, confirm=true면 통과.
  const lists = await loadFaqBannedWordLists()
  const combined = `${input.questionEn}\n${input.questionKo}\n${input.answerEn}\n${input.answerKo}`
  const hits = findBannedWords(combined, lists.warning)
  if (hits.length > 0 && !opts?.confirm) {
    return { ok: false, warning: true, words: hits }
  }

  const admin = createSupabaseAdmin()
  const row = {
    surface: SURFACE,
    question_en: input.questionEn.trim(),
    question_ko: input.questionKo.trim(),
    answer_en: input.answerEn.trim(),
    answer_ko: input.answerKo.trim(),
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await admin.from('faq_items').update(row).eq('id', input.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/faq')
    return { ok: true, id: input.id }
  }

  const { data, error } = await admin
    .from('faq_items')
    .insert({ ...row, created_by: admin_profile.id })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' }
  revalidatePath('/admin/faq')
  return { ok: true, id: data.id as string }
}

export type SetActiveState = { ok: true } | { ok: false; error: string } | { ok: false; blocked: true; words: string[] }

// ④ 기간 가드. is_active=true로 켤 때만 검사 -- 끄는 것은 항상 통과(막을
// 이유가 없다, 도로 숨기는 방향은 안전한 방향).
export async function setFaqItemActiveAction(id: string, active: boolean): Promise<SetActiveState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  if (active) {
    const { data: item, error: itemErr } = await admin
      .from('faq_items')
      .select('question_en, question_ko, answer_en, answer_ko')
      .eq('id', id)
      .single()
    if (itemErr || !item) return { ok: false, error: itemErr?.message ?? 'not found' }

    const { data: season, error: seasonErr } = await admin
      .from('seasons')
      .select('main_round_start_at, theme_announcement_minutes_before')
      .eq('id', 'season_0')
      .single()
    // 시즌을 못 읽으면 게이트를 세울 기준이 없다 -- 판단 불가를 통과로 두지
    // 않는다(read error != "reveal time already passed").
    if (seasonErr || !season) return { ok: false, error: seasonErr?.message ?? 'season_0 not found' }

    const revealTime = getThemeRevealTime(season)
    const stillHidden = revealTime !== null && Date.now() < revealTime.getTime()
    if (stillHidden) {
      const lists = await loadFaqBannedWordLists()
      const combined = `${item.question_en}\n${item.question_ko}\n${item.answer_en}\n${item.answer_ko}`
      const hits = findBannedWords(combined, lists.periodBlock)
      if (hits.length > 0) return { ok: false, blocked: true, words: hits }
    }
  }

  const { error } = await admin.from('faq_items').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/faq')
  return { ok: true }
}

export type DeleteFaqItemState = { ok: true } | { ok: false; error: string }

export async function deleteFaqItemAction(id: string): Promise<DeleteFaqItemState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('faq_items').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/faq')
  return { ok: true }
}

export type ReorderState = { ok: true } | { ok: false; error: string }

// 목록 화면 드래그 정렬 -- {id, sortOrder}[] 를 한 번에 반영. 순서만 바꾸는
// 것이라 ③/④ 게이트 대상 아님(문구가 안 바뀜).
export async function reorderFaqItemsAction(order: Array<{ id: string; sortOrder: number }>): Promise<ReorderState> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  for (const { id, sortOrder } of order) {
    const { error } = await admin
      .from('faq_items')
      .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/admin/faq')
  return { ok: true }
}
