import Link from 'next/link';

const faqs = [
  {
    q: 'What is OXXOVO?',
    a: 'OXXOVO is a platform where AI creators compete in theme-based video tournaments. You are free to use a wide range of AI generation tools, including Runway, Sora, Kling, Veo, Pika, and Luma.',
  },
  {
    q: 'How is this different from a normal AI contest?',
    a: 'OXXOVO is not a simple contest. It is an AI-native competitive platform that combines tournaments, creator rankings, community voting, and an AI-based verification system.',
  },
  {
    q: 'Who can enter?',
    a: 'Anyone who meets the entry requirements: a public creator account, an AI-generated video to submit, a verified email, and agreement to the official rules. Note that residents of US OFAC-sanctioned regions are not eligible to participate.',
  },
  {
    q: 'Which AI tools can I use?',
    a: 'Most major AI generation tools are allowed, including Runway, OpenAI Sora, Kling, Veo, Pika, Luma, and Hailuo. OXXOVO is not tied to any single tool.',
  },
  {
    q: 'Is there a limit on how many people can apply?',
    a: 'Yes. GENESIS has a capacity of 500 applicants. Once 500 applications are received, further submissions are placed on a waitlist. If a spot opens up or an additional round is added, waitlisted creators are first in line.',
  },
  {
    q: 'What are the prizes?',
    a: 'The GENESIS prize pool is $2,000 — $1,200 for 1st place, $500 for 2nd, and $300 for 3rd. The 1st place winner also receives a physical trophy and a Genesis Champion badge.',
  },
  {
    q: 'How are winners decided?',
    a: 'In GENESIS, every Free Entry is first scored by the Triple-AI system, and the top 50 advance to the Main Round. In the Main Round, winners are decided by a community vote (70%) combined with the Triple-AI score (30%).',
  },
  {
    q: 'What is Triple-AI Scoring?',
    a: 'OXXOVO has multiple AI systems — Claude, GPT, and Gemini — evaluate each entry independently. Their results are combined through a consensus-based method, designed to reduce the bias of any single model.',
  },
  {
    q: 'Are there human judges?',
    a: 'Season 0 (GENESIS) runs without human judges. Results are decided by competition, community response, and the AI-based verification system.',
  },
  {
    q: 'What is a Founding Creator?',
    a: 'The 50 finalists who advance to the GENESIS Main Round all become Founding Creators. They receive a permanent badge and a place in the Genesis Archive.',
  },
  {
    q: 'Why does OXXOVO emphasize verification?',
    a: 'As AI-generated content grows rapidly, authenticity and trust in the creation process matter more and more. OXXOVO is building systems for creation integrity, fair competition, and AI creation verification.',
  },
  {
    q: 'Are tournaments always free?',
    a: 'GENESIS (Season 0) is a free founding event. Regular tournaments in later seasons will have an entry fee.',
  },
  {
    q: 'Is OXXOVO only for short-form video?',
    a: 'No. Short-form AI video is the starting point. From GENESIS, OXXOVO grows into regular seasonal tournaments and an annual Grand Final.',
  },
  {
    q: 'Can beginners enter?',
    a: 'Yes. OXXOVO values not only established creators but also the discovery and growth of new ones.',
  },
  {
    q: 'Where is OXXOVO based?',
    a: 'OXXOVO Labs Inc., based in Las Vegas, Nevada, USA.',
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            FAQ
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.95]">
            QUESTIONS,<br />ANSWERED.
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            Everything you need to know about OXXOVO and the GENESIS
            tournament.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((item, i) => (
            <div key={i} className="border border-white/10 p-6">
              <div className="font-bold text-white mb-2 text-lg">
                {item.q}
              </div>
              <div className="text-sm text-white/60 leading-relaxed">
                {item.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 md:py-24 text-center border-t border-white/5">
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
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">
            ← OXXOVO
          </Link>
          <div>OXXOVO Labs Inc. · Las Vegas, Nevada, USA</div>
        </div>
      </footer>
    </main>
  );
}
