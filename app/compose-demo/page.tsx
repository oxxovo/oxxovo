'use client'

// Demo route for the compose editor -- UNGATED (outside /studio), no DB, no auth.
// Lets TK eyeball the editor UX on a Vercel preview regardless of the session6
// switch. Mock clips (public sample videos) + a simulated render flow. The real
// editor lives at /studio/compose.

import { useRef } from 'react'
import { useAdminLang, setAdminLang } from '@/lib/admin-i18n'
import ComposeEditor, { type SourceClip, type EditorRenderStatus } from '../studio/compose/ComposeEditor'

const S = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/'
const CLIPS: SourceClip[] = [
  { id: 'demo1', url: S + 'ForBiggerBlazes.mp4', durationSeconds: 15, prompt: 'Sample clip A', createdAt: '' },
  { id: 'demo2', url: S + 'ForBiggerEscapes.mp4', durationSeconds: 15, prompt: 'Sample clip B', createdAt: '' },
  { id: 'demo3', url: S + 'ForBiggerJoyrides.mp4', durationSeconds: 15, prompt: 'Sample clip C', createdAt: '' },
  { id: 'demo4', url: S + 'ForBiggerMeltdowns.mp4', durationSeconds: 15, prompt: 'Sample clip D', createdAt: '' },
]
const FINAL_DEMO = S + 'ForBiggerFun.mp4'

export default function ComposeDemoPage() {
  const lang = useAdminLang()
  const pollN = useRef(0)
  const total = useRef(0)

  const onRender = async (edl: { jobId: string; startMs: number; endMs: number }[]) => {
    pollN.current = 0
    total.current = edl.reduce((a, s) => a + (s.endMs - s.startMs), 0) / 1000
    return { ok: true as const, renderId: 'demo' }
  }
  const pollRender = async (): Promise<EditorRenderStatus> => {
    pollN.current += 1
    if (pollN.current < 2) return { status: 'queued', videoUrl: null, totalSeconds: total.current }
    if (pollN.current < 4) return { status: 'rendering', videoUrl: null, totalSeconds: total.current }
    return { status: 'ready', videoUrl: FINAL_DEMO, totalSeconds: total.current }
  }
  // Stubbed submit -- showcases the full submission UI (application round with no
  // existing row, so the applicant-info form appears). No real DB write.
  const onSubmit = async () => ({ ok: true as const })

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <span className="text-[20px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        <div className="flex gap-1">
          {(['ko', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setAdminLang(l)} className={`px-2 py-1 text-[11px] transition ${lang === l ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'}`}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ComposeEditor
          lang={lang}
          clips={CLIPS}
          maxSeconds={30}
          maxClips={10}
          demo
          onRender={onRender}
          pollRender={pollRender}
          submitCtx={{
            round: 'application',
            hasApplication: false,
            alreadySubmitted: false,
            needsApplicantInfo: true,
            statementMin: 150,
            statementMax: 250,
          }}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  )
}
