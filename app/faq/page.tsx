import Link from 'next/link';
import { formatFooterStatusLine } from '@/lib/ip-info';
import {
  getCurrentSeason,
  formatPanelLabel,
  formatWeightPercent,
  advanceCountLabel,
  formatAccessCopy,
  type Season,
} from '@/lib/seasons';
import { getMembershipLandingData } from '@/app/membership/actions';
import type { MembershipLandingData } from '@/app/membership/types';

type Faq = { q: string; a: string; qKo?: string; aKo?: string };

function buildFaqs(season: Season, mem: MembershipLandingData): Faq[] {
  const panelLabel = formatPanelLabel(season.ai_models);
  const prizePool = Number(season.total_prize_pool).toLocaleString();
  const prize1 = Number(season.prize_first).toLocaleString();
  const prize2 = Number(season.prize_second).toLocaleString();
  const prize3 = Number(season.prize_third).toLocaleString();
  const advanceLabel = advanceCountLabel(season);
  const communityPct = formatWeightPercent(season.community_vote_weight);
  const aiPct = formatWeightPercent(season.ai_score_weight);
  const accessCopy = formatAccessCopy({
    seasonName: season.name,
    entryFee: Number(season.entry_fee),
    membershipEnabled: mem.enabled,
    price: mem.price,
    interval: mem.interval,
    foundingMonths: mem.foundingMonths,
    foundingCap: mem.founding.cap,
  });

  return [
    {
      q: 'What is OXXOVO?',
      a: 'OXXOVO is a platform where AI creators compete in theme-based video tournaments, using tools built into OXXOVO Studio.',
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
      q: 'Can I use other AI tools?',
      qKo: '다른 AI 도구를 사용할 수 있나요?',
      a: "No. Every entry is created inside OXXOVO Studio, and externally produced video can't be uploaded. This isn't a limitation — it's what makes the scoring mean something. Everyone starts from the same toolset, so what separates entries is direction, not budget or tool access.",
      aKo: '아니요. 모든 출품작은 OXXOVO Studio 안에서 만듭니다. 외부에서 제작한 영상은 업로드할 수 없습니다. 이건 제약이 아니라 채점이 성립하기 위한 조건입니다. 모두가 같은 도구에서 출발하기 때문에, 작품을 가르는 것은 예산이나 도구 접근이 아니라 연출입니다.',
    },
    {
      q: 'What happens when the field is full?',
      qKo: '정원이 차면 어떻게 되나요?',
      a: "Entries close for this season. The next season's schedule will be posted here when it's set. Spots don't reopen mid-season.",
      aKo: '이번 시즌 참가 신청은 마감됩니다. 다음 시즌 일정은 공개되는 대로 이 페이지에 안내됩니다. 이번 시즌 자리가 중간에 열리지는 않습니다.',
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
      a: `OXXOVO uses multiple independent AI systems to evaluate each entry. Their results are combined through a consensus-based method, designed to reduce the bias of any single model.`,
    },
    {
      q: 'Are there human judges?',
      a: `${season.name} runs without human judges. Results are decided by competition, community response, and the AI-based verification system.`,
    },
    {
      q: 'What is a Finalist?',
      a: `Applicants who place in the ${advanceLabel} advance to the ${season.name} Main Round as Finalists, where they create their competition video in OXXOVO Studio.`,
    },
    {
      // HQ 2026-08-22, item 3: slot reserved, final wording pending 제니3.
      // Mechanism-only on purpose -- states THAT a required element exists
      // and WHEN it's revealed, never the season's actual secret value
      // (that stays behind isTwistRevealed() everywhere it's shown).
      q: 'Is there a required element (Twist) in the Main Round?',
      qKo: '본선에 필수조건(Twist)이 있나요?',
      a: 'Yes. Every Main Round theme includes one required element (Twist) that every entry must include. It is revealed to Finalists at the start of the Main Round, and to the audience on Watch as soon as it is revealed.',
      aKo: '네. 모든 본선 주제에는 모든 출품작이 반드시 포함해야 하는 필수조건(Twist)이 있습니다. 본선 시작 시각에 진출자에게 공개되고, 공개되는 즉시 Watch에서도 관객이 볼 수 있습니다.',
    },
    {
      q: 'Why does OXXOVO emphasize verification?',
      a: 'As AI-generated content grows rapidly, authenticity and trust in the creation process matter more and more. OXXOVO is building systems for creation integrity, fair competition, and AI creation verification.',
    },
    {
      q: 'How much does it cost to compete?',
      a: `${accessCopy} Tournament structure, prize pools, and fees may vary by season.`,
    },
    {
      q: 'Is OXXOVO only for short-form video?',
      a: `No. Short-form AI video is the starting point. From ${season.name}, OXXOVO grows into regular seasonal tournaments.`,
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
  const [season, mem] = await Promise.all([
    getCurrentSeason(),
    getMembershipLandingData(),
  ]);
  const seasonName = season?.name ?? 'OXXOVO';
  const faqs: Faq[] = season ? buildFaqs(season, mem) : [];

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
                {item.qKo && (
                  <div className="font-bold text-white/50 mb-2 text-sm" lang="ko">
                    {item.qKo}
                  </div>
                )}
                <div className="text-sm text-white/60 leading-relaxed">
                  {item.a}
                </div>
                {item.aKo && (
                  <div className="text-sm text-white/40 leading-relaxed mt-1" lang="ko">
                    {item.aKo}
                  </div>
                )}
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
