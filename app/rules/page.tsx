import Link from 'next/link';

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            OXXOVO — OFFICIAL RULEBOOK — v5.1
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.95]">
            THE<br />RULES.
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            OXXOVO is a verified AI creation tournament platform. Creators
            submit AI-generated videos, and winners are decided by Triple-AI
            scoring and community vote.
          </p>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl mt-5">
            This rulebook applies to GENESIS and all OXXOVO tournaments.
          </p>
        </div>
      </section>

      <Section label="PART 1" title="GENESIS — Free Launch Tournament">
        <P>
          GENESIS is OXXOVO&apos;s first tournament — a one-time free launch
          event. Entry is free and open to creators worldwide.
        </P>
        <Steps
          items={[
            ['01', 'Application', 'Up to 500 creators apply and submit one Free Entry — any AI-generated video they created, with no theme limits.'],
            ['02', 'Triple-AI Scoring', 'Claude, GPT, and Gemini score every Free Entry. The top 50 advance to the Main Round.'],
            ['03', 'The Main Round', 'The 50 finalists create one 30-second video on the OXXOVO theme within 48 hours.'],
            ['04', 'Champions Revealed', 'Community vote (70%) and Triple-AI score (30%) decide 1st, 2nd, and 3rd place.'],
          ]}
        />
        <SubTitle>Prize Pool — $2,000</SubTitle>
        <P>The GENESIS prize pool is funded by OXXOVO.</P>
        <Grid3
          items={[
            ['1ST', '$1,200'],
            ['2ND', '$500'],
            ['3RD', '$300'],
          ]}
        />
        <SubTitle>Rewards</SubTitle>
        <RuleList
          items={[
            ['1st place', 'Prize + a physical trophy + the "Genesis Champion" digital badge.'],
            ['2nd & 3rd place', 'Prize + the "Genesis Finalist" digital badge.'],
            ['All 50 finalists', 'The "Founding Creator" badge + a permanent place in the Genesis Archive.'],
            ['Applicants who do not advance', 'Recorded in OXXOVO, with no additional reward.'],
          ]}
        />
      </Section>

      <Section label="PART 2" title="Regular Tournaments">
        <P>
          From Season 1, OXXOVO runs paid Regular Tournaments. The match
          structure is identical to GENESIS — Free Entry, top 50 finalists,
          a themed video, then 1st / 2nd / 3rd place.
        </P>
        <RuleList
          items={[
            ['Entry fee', '$50 per round.'],
            ['Capacity', 'Up to 500 creators per round.'],
            ['Frequency', 'Up to 50 rounds per year.'],
          ]}
        />
        <SubTitle>Entry Fee Split</SubTitle>
        <Grid3
          items={[
            ['OXXOVO', '30%'],
            ['GRAND FINAL', '20%'],
            ['ROUND PRIZE', '50%'],
          ]}
        />
        <SubTitle>Round Prize Split</SubTitle>
        <Grid3
          items={[
            ['1ST', '60%'],
            ['2ND', '27%'],
            ['3RD', '13%'],
          ]}
        />
        <P>
          The 1st, 2nd, and 3rd place winners of each Regular Tournament earn
          a qualification slot for the Grand Final.
        </P>
      </Section>

      <Section label="YEAR-END" title="The Grand Final">
        <P>
          Once a year, OXXOVO holds the Grand Final — a championship of
          champions.
        </P>
        <RuleList
          items={[
            ['Qualifiers', 'The 1st, 2nd, and 3rd place winners of every Regular Tournament round — up to 150 creators.'],
            ['Format', 'Three stages: 150 to 50 to 10, then 1st / 2nd / 3rd place.'],
            ['One slot per creator', 'Each creator holds one qualification slot. If a creator already qualified through another placement, that slot stays empty — it is not passed on.'],
            ['Prize', 'The annual accumulated pool — 20% of all entry fees — approximately $250,000.'],
          ]}
        />
      </Section>

      <Section label="ALL TOURNAMENTS" title="Common Rules">
        <RuleList
          items={[
            ['Physical trophy', 'Awarded to the 1st place winner of every tournament. The trophy body shares one common OXXOVO design; only the plate — tournament name, winner name, and date — is engraved and attached.'],
            ['Repeat winners', 'A digital badge accumulates the win count (e.g. "Champion x3"). There is no extra prize or extra qualification slot — repeat wins are recognized as honor.'],
            ['Triple-AI scoring', 'Every entry is scored by three AI systems: Claude Sonnet 4.6, GPT-5.4, and Gemini 2.5 Pro.'],
            ['"Free Entry"', 'This term refers only to the creative work — the video itself — that a creator submits.'],
            ['Geographic restriction', 'Residents of U.S. OFAC-sanctioned regions may not participate.'],
          ]}
        />
      </Section>

      <section className="px-6 py-16 md:py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            READY?
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
        <div className="max-w-3xl mx-auto flex justify-between items-center text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">
            ← OXXOVO
          </Link>
          <div>OFFICIAL RULEBOOK / v5.1</div>
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

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs tracking-[0.3em] text-white/40 mt-10 mb-5 uppercase">
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/70 leading-relaxed mb-4">{children}</p>;
}

function Steps({ items }: { items: string[][] }) {
  return (
    <div className="space-y-4 mt-6">
      {items.map(([num, title, desc]) => (
        <div
          key={num}
          className="flex gap-5 border border-white/10 p-5 hover:border-[#8B22FF]/50 transition"
        >
          <div className="text-[#8B22FF] font-black text-lg shrink-0">{num}</div>
          <div>
            <div className="font-bold mb-1">{title}</div>
            <div className="text-sm text-white/60 leading-relaxed">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Grid3({ items }: { items: string[][] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-2">
      {items.map(([label, value]) => (
        <div key={label} className="border border-white/10 p-5 text-center">
          <div className="text-xs tracking-[0.2em] text-white/40 mb-2">{label}</div>
          <div className="text-2xl font-black">{value}</div>
        </div>
      ))}
    </div>
  );
}

function RuleList({ items }: { items: string[][] }) {
  return (
    <div className="space-y-3 mt-6">
      {items.map(([term, desc]) => (
        <div key={term} className="border border-white/10 p-5">
          <div className="text-sm font-bold text-white mb-1">{term}</div>
          <div className="text-sm text-white/60 leading-relaxed">{desc}</div>
        </div>
      ))}
    </div>
  );
}
