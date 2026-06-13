'use client'

// Real compose editor route. Behind the /studio layout gate (session6). Loads
// the participant's ready clips + compose caps, wires the editor to the real
// createRender / pollRender server actions. Demo lives at /compose-demo.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminLang, setAdminLang } from '@/lib/admin-i18n'
import { useLocalToken } from '@/lib/use-local-user'
import ComposeEditor, { type ComposeApplicant, type ComposeSubmitCtx } from './ComposeEditor'
import {
  loadComposeState,
  createRenderAction,
  pollRenderAction,
  submitRenderAction,
  type ComposeClip,
} from '../actions'
import type { EdlSegment } from '@/lib/studio'

const T = {
  ko: { auth: 'Studio를 사용하려면 로그인이 필요합니다.', login: '로그인하기', loading: '불러오는 중…', back: '← Studio', disabled: '현재 Studio가 비활성화되어 있습니다.' },
  en: { auth: 'Log in to use Studio.', login: 'Log in', loading: 'Loading…', back: '← Studio', disabled: 'Studio is currently disabled.' },
}

export default function ComposePage() {
  const token = useLocalToken()
  const lang = useAdminLang()
  const t = T[lang]
  const [data, setData] = useState<{
    clips: ComposeClip[]
    maxSeconds: number
    maxClips: number
    submit: ComposeSubmitCtx
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    loadComposeState(token).then((r) => {
      if (!alive) return
      if (r.ok) setData(r.data)
      else setErr(r.error)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [token])

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-[20px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
          <Link href="/studio" className="text-[11px] text-white/40 transition hover:text-white/70">{t.back}</Link>
        </div>
        <div className="flex gap-1">
          {(['ko', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setAdminLang(l)} className={`px-2 py-1 text-[11px] transition ${lang === l ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {loading ? (
          <p className="px-6 py-24 text-center text-white/40">{t.loading}</p>
        ) : !token ? (
          <div className="px-6 py-24 text-center">
            <p className="text-white/55">{t.auth}</p>
            <Link href="/login" className="mt-4 inline-block rounded-lg border border-[#8b22ff]/60 px-5 py-2.5 text-sm font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10">{t.login}</Link>
          </div>
        ) : err === 'disabled' ? (
          <p className="px-6 py-24 text-center text-white/40">{t.disabled}</p>
        ) : err || !data ? (
          <p className="px-6 py-24 text-center text-[#ff8888]">{err ?? 'load failed'}</p>
        ) : (
          <ComposeEditor
            lang={lang}
            clips={data.clips}
            maxSeconds={data.maxSeconds}
            maxClips={data.maxClips}
            submitCtx={data.submit}
            onRender={(edl: EdlSegment[]) => createRenderAction(token, edl)}
            pollRender={(renderId: string) => pollRenderAction(token, renderId)}
            onSubmit={(renderId: string, applicant?: ComposeApplicant) =>
              submitRenderAction(token, renderId, applicant)
            }
          />
        )}
      </div>
    </main>
  )
}
