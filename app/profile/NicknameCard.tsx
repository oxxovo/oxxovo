'use client'

import { useEffect, useState } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'
import { loadDisplayName, saveDisplayName } from './actions'

// Creator nickname editor. This is the name shown publicly on Watch (videos,
// comments, likes) -- never the email. Auto-assigned at sign-up; changeable here.
const COPY = {
  ko: {
    title: '크리에이터 닉네임',
    desc: 'Watch에서 영상·댓글에 공개로 표시되는 이름입니다. 이메일은 절대 표시되지 않습니다.',
    edit: '변경',
    save: '저장',
    cancel: '취소',
    saving: '저장 중…',
    saved: '저장됨',
    errShort: '2자 이상 입력하세요.',
    errLong: '30자 이하로 입력하세요.',
    errChars: '문자, 숫자, 공백, . _ - 만 사용할 수 있습니다.',
    errBanned: '사용할 수 없는 단어가 포함되어 있습니다.',
    errFail: '저장에 실패했습니다. 다시 시도해 주세요.',
  },
  en: {
    title: 'Creator nickname',
    desc: 'Your public name on Watch (videos, comments, likes). Your email is never shown.',
    edit: 'Change',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving…',
    saved: 'Saved',
    errShort: 'Use at least 2 characters.',
    errLong: 'Use 30 characters or fewer.',
    errChars: 'Only letters, numbers, spaces, and . _ - are allowed.',
    errBanned: 'That nickname contains a word that is not allowed.',
    errFail: 'Save failed. Please try again.',
  },
}

export function NicknameCard() {
  const lang = useAdminLang()
  const c = COPY[lang === 'ko' ? 'ko' : 'en']

  const [name, setName] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadDisplayName().then((n) => {
      if (cancelled) return
      setName(n)
      setDraft(n ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setErr(null)
    setPending(true)
    const res = await saveDisplayName(draft)
    setPending(false)
    if (res.ok) {
      setName(res.value)
      setDraft(res.value)
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } else {
      const map: Record<string, string> = {
        too_short: c.errShort,
        too_long: c.errLong,
        invalid_chars: c.errChars,
        banned_word: c.errBanned,
        failed: c.errFail,
        unauthenticated: c.errFail,
      }
      setErr(map[res.error] ?? c.errFail)
    }
  }

  return (
    <section className="mt-6 border border-white/10 bg-white/[.02] rounded-lg p-6">
      <h2 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 text-[#b66cff]">{c.title}</h2>
      <p className="text-xs text-white/50 mb-4 leading-relaxed">{c.desc}</p>

      {editing ? (
        <div>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#8b22ff] focus:outline-none transition"
          />
          {err && <p className="mt-2 text-xs text-[#ff8888]">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending || !draft.trim()}
              className="px-4 py-2 rounded bg-[#8b22ff] text-sm font-bold text-white hover:bg-[#7a1de0] transition disabled:opacity-50"
            >
              {pending ? c.saving : c.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(name ?? '')
                setErr(null)
              }}
              className="px-4 py-2 rounded border border-white/20 text-sm font-bold text-white/70 hover:text-white transition"
            >
              {c.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-white">{name ?? '…'}</span>
          <div className="flex items-center gap-3">
            {savedFlash && <span className="text-xs text-emerald-400">{c.saved}</span>}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-bold text-[#b66cff] hover:underline"
            >
              {c.edit}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
