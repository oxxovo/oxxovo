export default function RulesPage() {
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
        <a
          href="/apply"
          className="rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_0_18px_rgba(139,34,255,.4)] hover:brightness-110 transition"
        >
          Apply to GENESIS
        </a>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            GENESIS Tournament · Season 0
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3">Tournament Rules</h1>
          <p className="text-white/40 text-sm">Last updated: May 2026</p>
        </div>

        <div className="space-y-14 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ① Overview
            </h2>
            <p>
              GENESIS is OXXOVO&rsquo;s first global AI video tournament. Creators around the world submit
              short AI-generated videos. Each entry is scored by a panel of three AI judges, in parallel,
              under the same criteria. Same prompt. Same rules. No excuses.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ② Eligibility
            </h2>
            <ul className="space-y-2.5">
              <li>
                <span className="text-white/90">Video length:</span> <span className="text-white">15&ndash;30 seconds</span>.
                Entries outside this range are automatically rejected.
              </li>
              <li>
                <span className="text-white/90">Format:</span> uploaded to YouTube or Vimeo, publicly viewable.
              </li>
              <li>
                <span className="text-white/90">AI-generated:</span> the visual content must be produced by
                an AI video service (Sora, Veo, Runway, Kling, Pika, or other).
              </li>
              <li>
                <span className="text-white/90">One entry per email.</span> Multiple accounts are grounds for
                disqualification.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ③ How Scoring Works
            </h2>
            <p className="mb-5">
              Every entry is scored in parallel by <span className="text-white">three independent AI models</span>:
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {[
                { name: 'Claude Opus 4.5', org: 'Anthropic' },
                { name: 'GPT-4o', org: 'OpenAI' },
                { name: 'Gemini 2.5 Flash', org: 'Google' },
              ].map((m) => (
                <div
                  key={m.name}
                  className="rounded-lg border border-white/10 bg-white/[.03] px-4 py-3"
                >
                  <p className="text-white font-bold text-sm">{m.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{m.org}</p>
                </div>
              ))}
            </div>
            <p className="mb-5">
              Each judge scores four categories. The weighted average across all three judges
              becomes your final score.
            </p>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[.04] text-white/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Category</th>
                    <th className="text-right px-4 py-3 font-bold">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3">
                      <span className="text-white">Intent</span>
                      <span className="block text-xs text-white/40 mt-0.5">
                        Does the video match the creator&rsquo;s stated intent?
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">25%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <span className="text-white">Execution</span>
                      <span className="block text-xs text-white/40 mt-0.5">
                        Visual quality, motion, composition, technical craft.
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">45%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <span className="text-white">Originality</span>
                      <span className="block text-xs text-white/40 mt-0.5">
                        Distinct ideas, fresh framing, not derivative.
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">20%</td>
                  </tr>
                  <tr className="bg-[#8b22ff]/[.04]">
                    <td className="px-4 py-3">
                      <span className="text-white">Integrity</span>
                      <span className="block text-xs text-white/40 mt-0.5">
                        Authenticity check. Scored by Claude only.
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">10%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ④ Integrity Verification
            </h2>
            <p className="mb-4">
              The Integrity score is judged by <span className="text-white">Claude Opus 4.5</span> alone.
              It evaluates whether the submission is a genuine AI-generated video and whether the creator
              statement is consistent with what appears on screen.
            </p>
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[.04] px-4 py-3 text-sm">
              <p className="text-amber-300/90 font-bold mb-1">Auto-flag threshold</p>
              <p className="text-white/60">
                Any entry with an Integrity score below <span className="text-white">50</span> is
                automatically flagged for human review. Flagged entries may be disqualified.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ⑤ Video Authenticity &amp; AI Service Watermarks
            </h2>
            <p className="mb-4">
              Visible watermarks from <span className="text-white">Sora</span>, <span className="text-white">Veo</span>,
              and <span className="text-white">Runway</span> are recognized as positive
              signals of AI authenticity. They will <span className="text-white">not</span> count against your visual score.
            </p>
            <p className="mb-3">The following will lead to disqualification:</p>
            <ul className="space-y-2 pl-1">
              <li>
                <span className="text-red-300/80">&times;</span> Removing or manipulating an AI service watermark
              </li>
              <li>
                <span className="text-red-300/80">&times;</span> Misrepresenting the AI service used to produce the video
              </li>
              <li>
                <span className="text-red-300/80">&times;</span> Submitting non-AI footage (live action, stock footage,
                hand-drawn animation) framed as AI-generated
              </li>
              <li>
                <span className="text-red-300/80">&times;</span> Submitting the same video under multiple emails
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ⑥ Creator Statement
            </h2>
            <p className="mb-3">
              Every entry includes a written statement (<span className="text-white">150&ndash;250 characters</span>)
              describing what is on screen. This is the input for the Intent score.
            </p>
            <p className="text-sm text-white/55">
              Concrete, descriptive statements score higher than abstract or poetic ones.
              See the apply form for examples.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ⑦ Prizes
            </h2>
            <p>
              Season 0 prize pool: <span className="text-white">$2,000 USD</span>, awarded to the top
              finalists as ranked by final weighted score. Winners are announced after the submission window
              closes and all entries are scored.
            </p>
          </section>

          <section>
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
              ⑧ Final Word
            </h2>
            <p>
              Rules may evolve between seasons as the platform matures. Material changes will be announced
              before the next submission window opens. Questions about a specific entry?
              Email <span className="text-[#b66cff]">hello@oxxovo.com</span>.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-10 border-t border-white/10 text-center">
          <a
            href="/apply"
            className="inline-block rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-8 py-4 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(139,34,255,.45)] hover:brightness-110 transition"
          >
            Apply to GENESIS · Season 0
          </a>
          <p className="text-white/30 text-xs mt-10">
            &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
          </p>
        </div>
      </section>
    </main>
  )
}
