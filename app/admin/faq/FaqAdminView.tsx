'use client'

import { useMemo, useState, useTransition } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import type { Season } from '@/lib/seasons'
import type { MembershipLandingData } from '@/app/membership/types'
import { resolveFaqText, FAQ_TOKENS } from '@/lib/faq-tokens'
import { AdminPageHeader } from '../AdminPageHeader'
import { saveFaqItemAction, setFaqItemActiveAction, deleteFaqItemAction, type FaqItemInput } from './actions'

export type FaqRow = {
  id: string
  questionEn: string
  questionKo: string
  answerEn: string
  answerKo: string
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

const DICT = {
  ko: {
    title: 'FAQ 편집',
    subtitle: '홈(/) FAQ 섹션 9문항의 원천입니다. 활성 문항이 1개 이상이면 그 순간부터 이 목록이 정본이 되고, 기존 코드 문항(admin-i18n.ts)은 완전히 대체됩니다 -- 섞이지 않습니다.',
    add_btn: '+ 새 문항',
    empty: '등록된 문항이 없습니다. 아직 홈에는 기존 9문항이 그대로 보입니다.',
    col_active: '노출',
    col_order: '순서',
    edit_btn: '수정',
    delete_btn: '삭제',
    confirm_delete: '이 문항을 삭제할까요? 되돌릴 수 없습니다.',
    active_on: '노출 중',
    active_off: '숨김',
    form_new_title: '새 문항',
    form_edit_title: '문항 수정',
    f_question_en: '질문 (EN)',
    f_question_ko: '질문 (KR)',
    f_answer_en: '답변 (EN)',
    f_answer_ko: '답변 (KR)',
    f_order: '순서 (작을수록 위)',
    tokens_hint: `사용 가능한 토큰: ${FAQ_TOKENS.map((t) => `{{${t}}}`).join(' · ')}`,
    save_btn: '저장',
    saving: '저장 중…',
    cancel_btn: '취소',
    save_err: (msg: string) => `저장 실패: ${msg}`,
    warning_confirm: (words: string[]) =>
      `주의 단어가 포함돼 있습니다: ${words.join(', ')}\n그래도 저장할까요?`,
    activate_blocked: (words: string[]) =>
      `아직 공개할 수 없습니다 -- 주제 공개 시각 전이고, 다음 단어가 포함돼 있습니다: ${words.join(', ')}`,
    preview_title: '미리보기',
    preview_missing: (tok: string[]) => `토큰을 채울 수 없어 이 문항은 화면에 표시되지 않습니다: ${tok.join(', ')}`,
    no_season: '시즌 데이터를 읽지 못해 미리보기를 표시할 수 없습니다.',
  },
  en: {
    title: 'FAQ editor',
    subtitle: 'Source of the home (/) FAQ section\'s 9 items. The moment one item is active, this list becomes the source of truth and the hardcoded copy (admin-i18n.ts) is fully replaced -- never merged.',
    add_btn: '+ New item',
    empty: 'No items yet. The home page still shows the existing 9 hardcoded items.',
    col_active: 'Live',
    col_order: 'Order',
    edit_btn: 'Edit',
    delete_btn: 'Delete',
    confirm_delete: 'Delete this item? This cannot be undone.',
    active_on: 'Live',
    active_off: 'Hidden',
    form_new_title: 'New item',
    form_edit_title: 'Edit item',
    f_question_en: 'Question (EN)',
    f_question_ko: 'Question (KR)',
    f_answer_en: 'Answer (EN)',
    f_answer_ko: 'Answer (KR)',
    f_order: 'Order (lower = higher up)',
    tokens_hint: `Available tokens: ${FAQ_TOKENS.map((t) => `{{${t}}}`).join(' · ')}`,
    save_btn: 'Save',
    saving: 'Saving…',
    cancel_btn: 'Cancel',
    save_err: (msg: string) => `Save failed: ${msg}`,
    warning_confirm: (words: string[]) => `Flagged word(s) found: ${words.join(', ')}\nSave anyway?`,
    activate_blocked: (words: string[]) =>
      `Cannot go live yet -- before the theme reveal time, and this contains: ${words.join(', ')}`,
    preview_title: 'Preview',
    preview_missing: (tok: string[]) => `This item will NOT show on the site -- token(s) unresolved: ${tok.join(', ')}`,
    no_season: 'Could not load season data -- preview unavailable.',
  },
}

const EMPTY_FORM: FaqItemInput = { questionEn: '', questionKo: '', answerEn: '', answerKo: '', sortOrder: 0 }

export function FaqAdminView({
  rows,
  season,
  membership,
}: {
  rows: FaqRow[]
  season: Season | null
  membership: MembershipLandingData | null
}) {
  const lang = useAdminLang()
  const d = DICT[lang]
  const [list, setList] = useState(rows)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FaqItemInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const preview = useMemo(() => {
    if (!season) return null
    const en = resolveFaqText(form.answerEn, { season, membership, lang: 'en' })
    const ko = resolveFaqText(form.answerKo, { season, membership, lang: 'ko' })
    return { en, ko }
  }, [form.answerEn, form.answerKo, season, membership])

  function openNew() {
    setForm({ ...EMPTY_FORM, sortOrder: list.length })
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(row: FaqRow) {
    setForm({
      id: row.id,
      questionEn: row.questionEn,
      questionKo: row.questionKo,
      answerEn: row.answerEn,
      answerKo: row.answerKo,
      sortOrder: row.sortOrder,
    })
    setEditingId(row.id)
    setShowForm(true)
    setError(null)
  }

  function save(confirm?: boolean) {
    setError(null)
    startTransition(async () => {
      const r = await saveFaqItemAction(form, { confirm })
      if (r.ok) {
        setShowForm(false)
        location.reload() // simplest correct refresh -- list + preview both server-sourced
        return
      }
      if ('warning' in r) {
        if (window.confirm(d.warning_confirm(r.words))) save(true)
        return
      }
      setError(d.save_err(r.error))
    })
  }

  function remove(id: string) {
    if (!window.confirm(d.confirm_delete)) return
    startTransition(async () => {
      const r = await deleteFaqItemAction(id)
      if (r.ok) setList((prev) => prev.filter((x) => x.id !== id))
      else setError(d.save_err(r.error))
    })
  }

  function toggleActive(row: FaqRow) {
    startTransition(async () => {
      const r = await setFaqItemActiveAction(row.id, !row.isActive)
      if (r.ok) {
        setList((prev) => prev.map((x) => (x.id === row.id ? { ...x, isActive: !row.isActive } : x)))
      } else if ('blocked' in r) {
        window.alert(d.activate_blocked(r.words))
      } else {
        setError(d.save_err(r.error))
      }
    })
  }

  return (
    <div>
      <AdminPageHeader
        title={d.title}
        subtitle={<span className="text-white/50 text-sm">{d.subtitle}</span>}
        right={
          <button
            onClick={openNew}
            className="rounded bg-[#8b22ff] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#a044ff] transition"
          >
            {d.add_btn}
          </button>
        }
      />

      {error && (
        <div className="mb-6 border border-[#ff8844]/30 bg-[#ff8844]/[.06] rounded px-4 py-3 text-[12px] text-[#ffb488]">
          {error}
        </div>
      )}

      {list.length === 0 ? (
        <div className="border border-white/10 rounded px-4 py-8 text-center text-white/40 text-xs">{d.empty}</div>
      ) : (
        <div className="border border-white/10 rounded bg-white/[.02] overflow-hidden divide-y divide-white/5">
          {list.map((row) => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3">
              <span className="text-white/30 text-xs w-8 shrink-0">{row.sortOrder}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{row.questionEn}</div>
                <div className="text-xs text-white/50 truncate">{row.questionKo}</div>
              </div>
              <button
                onClick={() => toggleActive(row)}
                disabled={pending}
                className={
                  'shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold transition disabled:opacity-40 ' +
                  (row.isActive
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10')
                }
              >
                {row.isActive ? d.active_on : d.active_off}
              </button>
              <button
                onClick={() => openEdit(row)}
                className="shrink-0 text-xs text-white/60 hover:text-white transition px-2"
              >
                {d.edit_btn}
              </button>
              <button
                onClick={() => remove(row.id)}
                disabled={pending}
                className="shrink-0 text-xs text-[#ff8888]/70 hover:text-[#ff4444] transition disabled:opacity-40"
              >
                {d.delete_btn}
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <section className="mt-8 border border-white/10 rounded p-5 bg-white/[.02] max-w-3xl">
          <h2 className="text-sm font-bold mb-4">{editingId ? d.form_edit_title : d.form_new_title}</h2>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <Field label={d.f_question_en}>
              <input
                value={form.questionEn}
                onChange={(e) => setForm({ ...form, questionEn: e.target.value })}
                className="w-full px-3 py-2 rounded bg-black/30 border border-white/15 text-sm text-white focus:border-[#8b22ff] focus:outline-none"
              />
            </Field>
            <Field label={d.f_question_ko}>
              <input
                value={form.questionKo}
                onChange={(e) => setForm({ ...form, questionKo: e.target.value })}
                className="w-full px-3 py-2 rounded bg-black/30 border border-white/15 text-sm text-white focus:border-[#8b22ff] focus:outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <Field label={d.f_answer_en}>
              <textarea
                value={form.answerEn}
                onChange={(e) => setForm({ ...form, answerEn: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 rounded bg-black/30 border border-white/15 text-sm text-white focus:border-[#8b22ff] focus:outline-none"
              />
            </Field>
            <Field label={d.f_answer_ko}>
              <textarea
                value={form.answerKo}
                onChange={(e) => setForm({ ...form, answerKo: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 rounded bg-black/30 border border-white/15 text-sm text-white focus:border-[#8b22ff] focus:outline-none"
              />
            </Field>
          </div>

          <p className="text-[11px] text-white/40 mb-4">{d.tokens_hint}</p>

          <Field label={d.f_order}>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              className="w-32 px-3 py-2 rounded bg-black/30 border border-white/15 text-sm text-white focus:border-[#8b22ff] focus:outline-none"
            />
          </Field>

          {preview && (
            <div className="mt-4 border border-white/10 rounded p-3 bg-black/20">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">{d.preview_title}</div>
              <PreviewLine result={preview.en} missingMsg={d.preview_missing} />
              <PreviewLine result={preview.ko} missingMsg={d.preview_missing} />
            </div>
          )}
          {!season && <p className="mt-3 text-[11px] text-[#ffb488]">{d.no_season}</p>}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => save()}
              disabled={pending}
              className="rounded bg-[#8b22ff] px-4 py-2 text-xs font-bold text-white hover:bg-[#a044ff] transition disabled:opacity-40"
            >
              {pending ? d.saving : d.save_btn}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/35 transition"
            >
              {d.cancel_btn}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1">{label}</span>
      {children}
    </label>
  )
}

function PreviewLine({
  result,
  missingMsg,
}: {
  result: { ok: true; text: string } | { ok: false; missingTokens: string[] }
  missingMsg: (tok: string[]) => string
}) {
  if (!result.ok) {
    return <p className="text-xs text-[#ffb488] mb-1">{missingMsg(result.missingTokens)}</p>
  }
  return <p className="text-xs text-white/70 mb-1 whitespace-pre-wrap">{result.text}</p>
}
