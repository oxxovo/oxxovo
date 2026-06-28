// /guidelines -- Community Guidelines. PLACEHOLDER structure only; the policy
// copy (no harassment / hate / politics-religion / impersonation / spam) is
// supplied by HQ / 제니3. Linked from the comment composer.

import Link from 'next/link'
import { formatFooterStatusLine } from '@/lib/ip-info'

export const dynamic = 'force-dynamic'

// Section scaffold -- HQ fills the body copy per item.
const SECTIONS: { title: string }[] = [
  { title: 'Be respectful' },
  { title: 'No harassment or personal attacks' },
  { title: 'No hate speech' },
  { title: 'Keep politics and religion out' },
  { title: 'No impersonation or false ownership claims' },
  { title: 'No spam' },
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
        <p className="mt-4 text-base text-white/60">
          Comments and votes on OXXOVO follow these rules. {/* Intro copy: HQ / 제니3. */}
        </p>

        <div className="mt-10 space-y-6">
          {SECTIONS.map((s) => (
            <div key={s.title} className="border-b border-white/5 pb-5">
              <h2 className="text-lg font-bold">{s.title}</h2>
              {/* Body copy supplied by HQ / 제니3. */}
              <p className="mt-2 text-sm text-white/40">—</p>
            </div>
          ))}
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
