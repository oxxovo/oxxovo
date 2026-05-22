'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const AI_SERVICES = ['Sora', 'Veo', 'Runway', 'Kling', 'Pika', 'Other']
const ABSTRACT_WORDS = [
  'explor', 'surreal', 'experimental', 'abstract', 'ethereal',
  'transcendent', 'liminal', 'ineffable', 'journey', 'evocative',
]

function detectVideoPlatform(url: string): 'youtube' | 'vimeo' | null {
  if (/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i.test(url)) return 'youtube'
  if (/^https?:\/\/(www\.)?vimeo\.com\/\d+/i.test(url)) return 'vimeo'
  return null
}

export default function ApplyPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [checking, setChecking] = useState(true)

  const [videoUrl, setVideoUrl] = useState('')
  const [videoDuration, setVideoDuration] = useState<number | ''>('')
  const [aiService, setAiService] = useState('')
  const [statement, setStatement] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [agreeRules, setAgreeRules] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeIntegrity, setAgreeIntegrity] = useState(false)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('oxxovo_token')
    const email = localStorage.getItem('oxxovo_email')
    if (!token || !email) {
      router.push('/login?redirect=/apply')
      return
    }
    setUser({ email })
    setChecking(false)
  }, [router])

  const platform = useMemo(() => detectVideoPlatform(videoUrl), [videoUrl])
  const statementLen = statement.length
  const statementValid = statementLen >= 150 && statementLen <= 250
  const abstractHit = useMemo(() => {
    const lower = statement.toLowerCase()
    return ABSTRACT_WORDS.find((w) => new RegExp(`\\b${w}\\w*\\b`, 'i').test(lower))
  }, [statement])
  const durationValid = typeof videoDuration === 'number' && videoDuration >= 15 && videoDuration <= 30
  const allAgreed = agreeRules && agreePrivacy && agreeIntegrity

  const canSubmit =
    !!user &&
    !!platform &&
    durationValid &&
    !!aiService &&
    statementValid &&
    name.trim().length > 0 &&
    allAgreed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !user) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          creator_name: name.trim(),
          country: country.trim() || null,
          channel_url: channelUrl.trim() || null,
          free_entry_url: videoUrl.trim(),
          video_duration_seconds: videoDuration,
          ai_service: aiService,
          creator_statement: statement.trim(),
          agreed_to_rules: agreeRules,
          agreed_to_privacy: agreePrivacy,
          agreed_to_integrity_notice: agreeIntegrity,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError(typeof data.error === 'string' ? data.error : 'Submission failed. Please try again.')
      }
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/60">Checking access…</p>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)]">✦</div>
          <h1 className="text-3xl font-black mb-3">Application Received</h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            Thank you for applying to GENESIS. We will review your entry and notify you by email.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <a
              href="/profile"
              className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-6 py-3 font-bold text-white hover:brightness-110"
            >
              Go to Profile
            </a>
            <a href="/" className="text-white/40 text-sm hover:text-white/70">← Back to Home</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex h-20 items-center justify-between px-6 md:px-12 border-b border-white/10">
        <a href="/" className="flex items-center gap-3">
          <img
            src="/oxxovo_logo.png"
            alt="OXXOVO"
            className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]"
          />
          <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </a>
        <span className="text-sm text-white/60 max-md:hidden">
          Signed in as <span className="text-white/80">{user?.email}</span>
        </span>
      </header>

      <section className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            GENESIS Tournament · Season 0
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3">Apply to GENESIS</h1>
          <p className="text-white/50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
            Submit your AI-generated video. Triple-AI scoring by
            <span className="text-white/70"> Claude Opus 4.5</span>,
            <span className="text-white/70"> GPT-4o</span>, and
            <span className="text-white/70"> Gemini 2.5 Flash</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ① Video Details
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Video URL (YouTube / Vimeo)</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                {videoUrl && !platform && (
                  <p className="text-amber-400 text-xs mt-1.5">
                    Only YouTube or Vimeo URLs are accepted.
                  </p>
                )}
                {platform && (
                  <p className="text-[#b66cff] text-xs mt-1.5">✓ {platform === 'youtube' ? 'YouTube' : 'Vimeo'} URL detected</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Video Duration (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={videoDuration}
                  onChange={(e) => {
                    const v = e.target.value
                    setVideoDuration(v === '' ? '' : Number(v))
                  }}
                  placeholder="e.g. 22"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                <p className="text-white/40 text-xs mt-1.5">
                  Required: <span className="text-white/70">15–30 seconds</span>. Entries outside this range will be rejected during review.
                </p>
                {videoDuration !== '' && !durationValid && (
                  <p className="text-amber-400 text-xs mt-1">
                    Duration must be between 15 and 30 seconds.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">AI Service</label>
                <select
                  value={aiService}
                  onChange={(e) => setAiService(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-[#8b22ff] transition"
                >
                  <option value="" className="bg-[#0a0812]">Select the AI service used…</option>
                  {AI_SERVICES.map((s) => (
                    <option key={s} value={s} className="bg-[#0a0812]">{s}</option>
                  ))}
                </select>
                <p className="text-white/40 text-xs mt-1.5">
                  Watermarks from Sora, Veo, and Runway are recognized as AI authenticity signals.
                </p>
              </div>

              <div>
                <label className="flex justify-between items-baseline text-sm text-white/60 mb-1.5">
                  <span>Creator Statement</span>
                  <span
                    className={
                      statementValid
                        ? 'text-[#b66cff] text-xs'
                        : statementLen > 250
                        ? 'text-red-400 text-xs'
                        : 'text-white/40 text-xs'
                    }
                  >
                    {statementLen} / 150–250
                  </span>
                </label>
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  required
                  rows={5}
                  placeholder="A timelapse video of mansion restoration in cinematic style."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition resize-none"
                />
                <div className="text-xs text-white/40 mt-2 space-y-1">
                  <p>
                    <span className="text-[#b66cff]">✓</span> &ldquo;A timelapse video of mansion restoration in cinematic style&rdquo;
                  </p>
                  <p>
                    <span className="text-red-400/80">✕</span> &ldquo;An experimental exploration of decay and time&rdquo;
                  </p>
                </div>
                {abstractHit && (
                  <p className="text-amber-400 text-xs mt-3 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2">
                    Heads up — &ldquo;{abstractHit}&rdquo; tends to score low on <span className="font-bold">Intent</span>.
                    Describe what is actually on screen (subject, action, style).
                  </p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ② Applicant Info
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Name <span className="text-white/30">(Korean or English)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Country <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. South Korea, USA, Japan"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Channel URL <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="YouTube / Instagram / TikTok channel link"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff] transition"
                />
                <p className="text-white/40 text-xs mt-1.5">
                  Your creator channel (used for verification if you advance to the finalist round).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold">
              ③ Agreements
            </h2>
            <div className="space-y-4 text-sm text-white/70">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={(e) => setAgreeRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <a href="/rules" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                    Tournament Rules
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener" className="text-[#8b22ff] hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeIntegrity}
                  onChange={(e) => setAgreeIntegrity(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8b22ff] flex-shrink-0"
                  required
                />
                <span>
                  I understand that my entry undergoes <span className="text-white/90">AI integrity verification</span> by
                  Claude Opus 4.5. Manipulating watermarks or misrepresenting the AI service used may result in
                  disqualification.
                </span>
              </label>
            </div>
          </section>

          {error && (
            <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition"
            >
              {loading ? 'Submitting…' : 'Submit Application'}
            </button>
            {!canSubmit && !loading && (
              <p className="text-center text-xs text-white/40 mt-3">
                Complete all required fields and agreements to submit.
              </p>
            )}
          </div>
        </form>

        <p className="text-center text-white/30 text-xs mt-16">
          © 2026 OXXOVO Labs Inc. All Rights Reserved.
        </p>
      </section>
    </main>
  )
}
