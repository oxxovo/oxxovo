// /guidelines -- Community Guidelines (copy supplied by HQ, 2026-06-28).
// Linked from the comment composer.

import Link from 'next/link'
import { formatFooterStatusLine } from '@/lib/ip-info'

export const dynamic = 'force-dynamic'

const RULES: { title: string; body: string }[] = [
  { title: 'Be respectful', body: 'No harassment, personal attacks, or hate speech.' },
  {
    title: 'No discrimination',
    body: 'Content targeting race, gender, religion, or nationality is not allowed.',
  },
  { title: 'Keep it on-topic', body: 'No political or religious disputes.' },
  { title: 'No spam', body: 'No repeated, promotional, or irrelevant comments.' },
  {
    title: "Respect creators' work",
    body: 'If you suspect plagiarism, report it with evidence rather than making public accusations.',
  },
  { title: 'No illegal or harmful content', body: '' },
]

export default function GuidelinesPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-16 md:pt-28 max-w-3xl mx-auto">
        <p className="inline-flex items-center gap-2.5 mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          Community
        </p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight">Community Guidelines</h1>
        <p className="mt-4 text-base text-white/60 leading-relaxed">
          OXXOVO is a space for AI creators to share work and connect. To keep it welcoming for
          everyone, all comments and interactions must follow these rules:
        </p>

        <ol className="mt-10 space-y-6">
          {RULES.map((r, i) => (
            <li key={r.title} className="border-b border-white/5 pb-5">
              <h2 className="text-lg font-bold">
                <span className="text-[#b66cff]">{i + 1}.</span> {r.title}
              </h2>
              {r.body && <p className="mt-2 text-sm text-white/65 leading-relaxed">{r.body}</p>}
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-xl border border-white/10 bg-white/[.02] p-5 text-sm text-white/65 leading-relaxed">
          <p>Violations may result in comment removal or account restrictions.</p>
          <p className="mt-2">Use the Report button to flag content that breaks these rules.</p>
          <p className="mt-2 text-white/45">OXXOVO reserves the right to moderate at its discretion.</p>
        </div>
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">← OXXOVO</Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-3xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>
    </main>
  )
}
