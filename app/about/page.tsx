import Link from 'next/link';
import {
  IP_INFO,
  formatFooterStatusLine,
  formatInternationalNote,
  formatPatentOfficeFull,
  formatTrademarkClasses,
} from '@/lib/ip-info';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            ABOUT OXXOVO
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.95]">
            THE ARENA<br />FOR AI CREATORS.
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            OXXOVO is a competitive arena for the new generation of AI
            creators — a place where AI-generated work is judged, ranked,
            and rewarded under verified conditions.
          </p>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl mt-5">
            AI tools are becoming available to everyone. But the tool was
            never the point. The real question is — who creates work people
            remember?
          </p>
        </div>
      </section>

      <Section label="WHAT WE ARE" title="An arena, not a gallery">
        <P>
          OXXOVO is not another AI video contest. It is a creative arena.
          Creators build AI-generated videos around a live theme, and they
          compete — measured by community response and an AI-based
          verification system.
        </P>
        <P>
          It is not a gallery and not a feed. Every video on OXXOVO is here
          for one reason: to compete, and to reveal who is best.
        </P>
      </Section>

      <Section label="WHY WE BUILT IT" title="AI is easy. Winning is hard.">
        <P>
          AI is creating an entirely new generation of creators — AI
          filmmakers, AI ad creators, AI storytellers, AI visual artists.
          The ability to create is no longer the barrier.
        </P>
        <P>
          But there is still no global stage where these creators can prove
          themselves — no fair place to answer the real question: not can
          you make it, but is yours the best. OXXOVO exists to be that
          stage.
        </P>
      </Section>

      <Section label="NO GATEKEEPERS" title="The arena reveals talent">
        <P>
          OXXOVO removes the old gatekeeping structures. There are no
          appointed judges, no industry connections, and no pre-selected
          winners.
        </P>
        <P>
          Creators compete. The audience responds. The system verifies.
          That is the whole structure — talent is not decided in advance,
          it is revealed in the arena.
        </P>
      </Section>

      <Section label="VERIFIED COMPETITION" title="A standard for AI creativity">
        <P>
          OXXOVO is more than an event organizer. Every tournament runs on
          the same principles: a shared theme, a fixed time window, and
          transparent scoring.
        </P>
        <P>
          Entries are evaluated by a Triple-AI panel — Claude, GPT, and
          Gemini — combined with a community vote, so no single judge,
          human or machine, decides alone. Our goal is to build the trust
          and the standard that competitive AI creation will need.
        </P>
      </Section>

      <Section label="THE ROAD AHEAD" title="From GENESIS onward">
        <P>
          OXXOVO begins with GENESIS — a free launch tournament open to
          creators worldwide. From there, the arena grows into regular
          seasonal tournaments, leading to an annual Grand Final where the
          champions of each round compete for the title.
        </P>
        <P>
          We believe competitive AI creation will become a new form of
          entertainment in its own right. OXXOVO is building the arena for
          it — before that future fully arrives.
        </P>
      </Section>

      <Section label="🛡️ INTELLECTUAL PROPERTY" title="Protected by patent and trademark filings">
        <P>
          OXXOVO&rsquo;s tournament integrity technology is protected by
          patent applications filed with the {formatPatentOfficeFull()} on{' '}
          {IP_INFO.patent.filingDate}:
        </P>
        <ul className="text-white/70 leading-relaxed mb-4 pl-5 space-y-1.5 list-disc marker:text-[#8B22FF]/60">
          {IP_INFO.patent.titles.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <P>
          Trademark applications also filed for {IP_INFO.trademark.name} across
          multiple classes ({formatTrademarkClasses()}). {formatInternationalNote()}
        </P>
      </Section>

      <section className="px-6 py-16 md:py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            JOIN US
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-8 tracking-tight">
            Enter the arena.
          </h2>
          <Link
            href="/apply"
            className="inline-block bg-[#8B22FF] hover:bg-[#9B32FF] text-white font-bold tracking-[0.2em] px-10 py-5 transition"
          >
            APPLY TO GENESIS
          </Link>
        </div>
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">
            ← OXXOVO
          </Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-3xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>
    </main>
  );
}

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 py-16 md:py-20 border-b border-white/5">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-4">
          {label}
        </div>
        <h2 className="text-3xl md:text-4xl font-black mb-8 tracking-tight">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/70 leading-relaxed mb-4">{children}</p>;
}
