import Link from 'next/link';
import { formatFooterStatusLine } from '@/lib/ip-info';
import {
  getCurrentSeason,
  formatAiProviderList,
  formatPanelLabel,
  formatWeightPercent,
  advanceCountLabel,
  type Season,
} from '@/lib/seasons';

type Faq = { q: string; a: string };

function buildFaqs(season: Season): Faq[] {
  const panelLabel = formatPanelLabel(season.ai_models);
  const providerList = formatAiProviderList(season.ai_models);
  const prizePool = Number(season.total_prize_pool).toLocaleString();
  const prize1 = Number(season.prize_first).toLocaleString();
  const prize2 = Number(season.prize_second).toLocaleString();
  const prize3 = Number(season.prize_third).toLocaleString();
  const capacity = season.max_applicants.toLocaleString();
  const advanceLabel = advanceCountLabel(season);
  const communityPct = formatWeightPercent(season.community_vote_weight);
  const aiPct = formatWeightPercent(season.ai_score_weight);
  const entryFee = Number(season.entry_fee);
  const feeText = entryFee === 0 ? 'free' : `$${entryFee.toLocaleString()} entry`;

  return [
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
      a: `Yes. ${season.name} has a capacity of ${capacity} applicants. Once ${capacity} applications are received, further submissions are placed on a waitlist. If a spot opens up or an additional round is added, waitlisted creators are first in line.`,
    },
    {
      q: 'What are the prizes?',
      a: `The ${season.name} prize pool is $${prizePool} — $${prize1} for 1st place, $${prize2} for 2nd, and $${prize3} for 3rd. The 1st place winner also receives a physical trophy and a ${season.name} Champion badge.`,
    },
    {
      q: 'How are winners decided?',
      a: `In ${season.name}, every entry is first scored by the ${panelLabel} system, and the ${advanceLabel} advance to the Main Round. In the Main Round, winners are decided by a community vote (${communityPct}) combined with the ${panelLabel} score (${aiPct}).`,
    },
    {
      q: `What is ${panelLabel} Scoring?`,
      a: `OXXOVO has multiple AI systems — ${providerList} — evaluate each entry independently. Their results are combined through a consensus-based method, designed to reduce the bias of any single model.`,
    },
    {
      q: 'Are there human judges?',
      a: `${season.name} runs without human judges. Results are decided by competition, community response, and the AI-based verification system.`,
    },
    {
      q: 'What is a Founding Creator?',
      a: `The finalists who advance to the ${season.name} Main Round all become Founding Creators. They receive a permanent badge and a place in the ${season.name} Archive.`,
    },
    {
      q: 'Why does OXXOVO emphasize verification?',
      a: 'As AI-generated content grows rapidly, authenticity and trust in the creation process matter more and more. OXXOVO is building systems for creation integrity, fair competition, and AI creation verification.',
    },
    {
      q: 'Are tournaments always free?',
      a: `${season.name} is a ${feeText} founding event. Tournament structure, prize pools, and entry fees may vary by season.`,
    },
    {
      q: 'Is OXXOVO only for short-form video?',
      a: `No. Short-form AI video is the starting point. From ${season.name}, OXXOVO grows into regular seasonal tournaments and an annual Grand Final.`,
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
}

export default async function FAQPage() {
  const season = await getCurrentSeason();
  const seasonName = season?.name ?? 'GENESIS';
  const faqs: Faq[] = season ? buildFaqs(season) : [];

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
            Everything you need to know about OXXOVO and the {seasonName}
            {' '}tournament.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.length === 0 ? (
            <p className="text-white/40 text-sm text-center">
              Loading current season FAQs…
            </p>
          ) : (
            faqs.map((item, i) => (
              <div key={i} className="border border-white/10 p-6">
                <div className="font-bold text-white mb-2 text-lg">
                  {item.q}
                </div>
                <div className="text-sm text-white/60 leading-relaxed">
                  {item.a}
                </div>
              </div>
            ))
          )}
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
            APPLY TO {seasonName.toUpperCase()}
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
