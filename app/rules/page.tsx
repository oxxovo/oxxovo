'use client'

import { useEffect, useState } from 'react'
import {
  getCurrentSeason,
  advanceCountLabel,
  formatAccessCopy,
  formatModelName,
  formatWeightPercent,
  getIntegrityModel,
  type Season,
} from '@/lib/seasons'
import { getMembershipLandingData } from '@/app/membership/actions'
import type { MembershipLandingData } from '@/app/membership/types'
import {
  IP_INFO,
  formatFooterStatusLine,
} from '@/lib/ip-info'

const STATEMENT_MIN = 150
const STATEMENT_MAX = 250
const SUPPORT_EMAIL = 'hello@oxxovo.com'

export default function RulesPage() {
  const [season, setSeason] = useState<Season | null>(null)
  const [membership, setMembership] = useState<MembershipLandingData | null>(null)

  useEffect(() => {
    getCurrentSeason().then(setSeason)
    getMembershipLandingData().then(setMembership).catch(() => setMembership(null))
  }, [])

  if (!season) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading current season rules…</p>
      </main>
    )
  }

  const integrityModel = getIntegrityModel(season.ai_models)
  const integrityName = integrityModel
    ? formatModelName(integrityModel.name)
    : 'a designated panel model'
  const modelCount = season.ai_models.length
  const lastUpdated = new Date(season.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  const scoringCategories: {
    name: string
    desc: string
    weight: number
    integrity?: boolean
  }[] = [
    {
      name: 'Intent',
      desc: "Does the video match the creator's stated intent?",
      weight: season.scoring_intent_clarity_weight,
    },
    {
      name: 'Execution',
      desc: 'Visual quality, motion, composition, technical craft.',
      weight: season.scoring_execution_weight,
    },
    {
      name: 'Originality',
      desc: 'Distinct ideas, fresh framing, not derivative.',
      weight: season.scoring_originality_weight,
    },
    {
      name: 'Integrity',
      desc: `Authenticity check. Scored by ${integrityName} only.`,
      weight: season.scoring_integrity_weight,
      integrity: true,
    },
  ]

  // Main-round audience-vote layer is driven by the live season weights, never
  // hardcoded: community_vote_weight === 0 means the vote runs as a test (Season
  // 0), > 0 means it counts toward the Final Score by that season's split.
  const communityCounts = season.community_vote_weight > 0
  const aiWeightPct = formatWeightPercent(season.ai_score_weight)
  const communityWeightPct = formatWeightPercent(season.community_vote_weight)

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
          Apply to {season?.name ?? 'OXXOVO'}
        </a>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {season.name}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3">Tournament Rules</h1>
          <p className="text-white/40 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-14 text-white/70 leading-relaxed">

          <RuleSection num="①" title="Overview">
            <p>
              {season.name} is OXXOVO&rsquo;s global AI video tournament. Creators around the world submit short AI-generated videos. Each entry is scored by a panel of {modelCount} independent AI judges, in parallel, under the same criteria. Same prompt. Same rules. No excuses.
            </p>
            <p className="mt-4 text-sm italic text-white/45">
              These rules describe the <span className="text-white/70">current season ({season.name})</span>. Parameters such as capacity, prize pool, AI panel composition, and scoring weights may vary by season as the platform matures.
            </p>
          </RuleSection>

          <RuleSection num="②" title="Eligibility">
            <ul className="space-y-2.5">
              <li>
                <span className="text-white/90">Video length:</span>{' '}
                <span className="text-white">
                  {season.application_video_min_seconds}&ndash;{season.application_video_max_seconds} seconds
                </span>
                . Entries outside this range are automatically rejected.
              </li>
              <li>
                <span className="text-white/90">Format:</span> uploaded to YouTube or Vimeo, publicly viewable.
              </li>
              <li>
                <span className="text-white/90">AI-generated:</span> the visual content must be produced by an AI video service (Sora, Veo, Runway, Kling, Pika, or other).
              </li>
              <li>
                <span className="text-white/90">Creator statement:</span> a {STATEMENT_MIN}&ndash;{STATEMENT_MAX} character description of what is on screen, used as input for the Intent score.
              </li>
              <li>
                <span className="text-white/90">One entry per email.</span> Multiple accounts are grounds for disqualification.
              </li>
              <li>
                <span className="text-white/90">Capacity:</span> {season.name} accepts up to{' '}
                <span className="text-white">{season.max_applicants.toLocaleString()}</span> applicants. After capacity, additional entries are routed to the waitlist with priority access to the next season.
              </li>
            </ul>
          </RuleSection>

          <RuleSection num="③" title="How Scoring Works">
            <p className="mb-5">
              Every entry is scored in parallel by{' '}
              <span className="text-white">{modelCount} independent AI models</span>, each from a different company. Using multiple judges cancels individual AI bias.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              {season.ai_models.map((m) => (
                <div
                  key={m.name}
                  className={`flex-1 min-w-[160px] rounded-lg border px-4 py-3 ${
                    m.is_integrity
                      ? 'border-[#8b22ff]/40 bg-[#8b22ff]/[.06]'
                      : 'border-white/10 bg-white/[.03]'
                  }`}
                >
                  <p className="text-white font-bold text-sm">{formatModelName(m.name)}</p>
                  <p className="text-white/40 text-xs mt-0.5">{m.provider ?? '—'}</p>
                  {m.is_integrity && (
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-[#b66cff]">
                      Integrity Judge
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p>
              Each judge scores four categories. The weighted average across all {modelCount} judges is your <span className="text-white">AI Score</span>, with outlier scores automatically excluded to prevent manipulation.
            </p>

            <div className="mt-6 rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.07] px-4 py-3">
              <p className="text-[#d9b8ff] font-bold text-sm">
                Preliminary: 100% AI judging. Main round: AI Score plus an audience vote.
              </p>
              <p className="text-[#d9b8ff]/80 font-bold text-sm mt-1" lang="ko">
                예선: 100% AI 심사. 본선: AI Score + 관객 투표.
              </p>
              <p className="text-white/60 text-xs mt-1.5">
                In the preliminary, entries are ranked by AI Score alone. In the main round we publish three numbers &mdash; <span className="text-white/80">AI Score</span>, <span className="text-white/80">Community Score</span> (the audience vote), and <span className="text-white/80">Final Score</span>.{' '}
                {communityCounts ? (
                  <>This season the Final Score combines them by the season&rsquo;s configured weights: AI {aiWeightPct} + Community {communityWeightPct}.</>
                ) : (
                  <>This season the ranking is decided by AI Score, with the audience vote run as a test that does not affect the result. From the next season the Final Score combines AI Score and Community Score by the weights configured for that season.</>
                )}
              </p>
              <p className="text-white/50 text-xs mt-1.5" lang="ko">
                예선은 AI Score만으로 순위를 정합니다. 본선에서는 AI Score, Community Score(관객 투표), Final Score 세 가지를 공개합니다.{' '}
                {communityCounts ? (
                  <>이번 시즌 Final Score는 시즌 설정 비중(AI {aiWeightPct} + 관객 {communityWeightPct})으로 합산됩니다.</>
                ) : (
                  <>이번 시즌은 AI Score로 순위를 정하며, 관객 투표는 결과에 반영되지 않는 테스트로 운영됩니다. 다음 시즌부터 Final Score가 시즌별 설정 비중에 따라 AI Score와 Community Score를 합산합니다.</>
                )}
              </p>
            </div>
          </RuleSection>

          <RuleSection num="④" title="Scoring Categories">
            <p className="mb-5">Four scoring categories, weighted as follows:</p>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[.04] text-white/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Category</th>
                    <th className="text-right px-4 py-3 font-bold">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {scoringCategories.map((c) => (
                    <tr key={c.name} className={c.integrity ? 'bg-[#8b22ff]/[.04]' : ''}>
                      <td className="px-4 py-3">
                        <span className="text-white">{c.name}</span>
                        <span className="block text-xs text-white/40 mt-0.5">{c.desc}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-bold">
                        {formatWeightPercent(c.weight)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs italic text-white/45">
              Scoring weights are calibrated per season and may vary in future tournaments.
            </p>
          </RuleSection>

          <RuleSection num="⑤" title="Integrity Verification">
            <p className="mb-4">
              The Integrity score is judged by <span className="text-white">{integrityName}</span> alone &mdash; assigned solo by design, to prevent panel-wide collusion. It evaluates whether the submission is a genuine AI-generated video and whether the creator statement is consistent with what appears on screen.
            </p>
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[.04] px-4 py-3 text-sm">
              <p className="text-amber-300/90 font-bold mb-1">Auto-flag threshold</p>
              <p className="text-white/60">
                Any entry with an Integrity score below{' '}
                <span className="text-white">{season.flag_integrity_threshold}</span> is automatically flagged for human review. Flagged entries may be disqualified.
              </p>
            </div>
          </RuleSection>

          <RuleSection num="⑥" title="Video Authenticity & AI Service Watermarks">
            <div className="mb-5 rounded-lg border border-[#8b22ff]/30 bg-[#8b22ff]/[.07] px-4 py-3">
              <p className="text-[#d9b8ff] font-bold text-sm">
                Baseline: what the AI generated is allowed — what you add in post is not.
              </p>
              <p className="text-[#d9b8ff]/80 font-bold text-sm mt-1" lang="ko">
                기준선: AI가 생성한 것은 허용 &mdash; 후편집으로 추가한 것은 금지.
              </p>
              <p className="text-white/60 text-xs mt-1.5">
                Any text, visual effect, or audio that appears <span className="text-white/80">within</span> a generated clip is part of the AI&rsquo;s output and is allowed. Adding text, effects, transitions, or external audio <span className="text-white/80">afterward</span> is not. OXXOVO&rsquo;s in-platform editor has no tools to add them, so what your AI generates is exactly what competes.
              </p>
            </div>
            <p className="mb-4">
              Visible watermarks from <span className="text-white">Sora</span>, <span className="text-white">Veo</span>, and <span className="text-white">Runway</span> are recognized as positive signals of AI authenticity. They will <span className="text-white">not</span> count against your visual score.
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
                <span className="text-red-300/80">&times;</span> Submitting non-AI footage (live action, stock footage, hand-drawn animation) framed as AI-generated
              </li>
              <li>
                <span className="text-red-300/80">&times;</span> Submitting the same video under multiple emails
              </li>
            </ul>
            <div className="mt-5 rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] px-4 py-3 text-sm">
              <p className="text-[#b66cff] font-bold mb-1">&#8505;&#65039; Patent Notice</p>
              <p className="text-white/60">
                The above tournament integrity technologies are protected by patent applications filed in {IP_INFO.patent.jurisdictionShort} ({IP_INFO.patent.filingDate}) and will be extended internationally under the {IP_INFO.international.treaty}.
              </p>
            </div>
          </RuleSection>

          <RuleSection num="⑦" title="Tournament Structure & Prizes">
            <p className="mb-4">
              {season.name} accepts up to{' '}
              <span className="text-white">{season.max_applicants.toLocaleString()}</span> applicants. After all entries are scored, the{' '}
              <span className="text-white">{advanceCountLabel(season)}</span> advance as Finalists of OXXOVO.
            </p>
            <div className="rounded-lg border border-[#8b22ff]/20 bg-[#8b22ff]/[.04] px-5 py-4">
              <p className="text-[#b66cff] text-[11px] uppercase tracking-widest font-bold mb-3">
                {season.name} Prize Pool
              </p>
              <p className="text-3xl font-black text-white mb-3">
                ${Number(season.total_prize_pool).toLocaleString()} USD
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-white/40 text-xs uppercase">1st</p>
                  <p className="text-white font-bold">${Number(season.prize_first).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase">2nd</p>
                  <p className="text-white font-bold">${Number(season.prize_second).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase">3rd</p>
                  <p className="text-white font-bold">${Number(season.prize_third).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-white/40 text-xs mt-3 italic">
                {formatAccessCopy({
                  seasonName: season.name,
                  entryFee: Number(season.entry_fee),
                  membershipEnabled: membership?.enabled ?? false,
                  price: membership?.price ?? null,
                  interval: membership?.interval ?? 'month',
                  foundingMonths: membership?.foundingMonths ?? null,
                  foundingCap: membership?.founding.cap ?? 0,
                  concise: true,
                })}
              </p>
            </div>
          </RuleSection>

          <RuleSection num="⑧" title="Grand Final & Future Seasons">
            <p>
              Tournament structure scales with participation. As OXXOVO grows, future seasons will feature larger capacities, higher prize pools, and the eventual Grand Final. Specific tournament structure, prize pools, and selection counts vary by season and are announced before each application window opens.
            </p>
          </RuleSection>

          <RuleSection num="⑨" title="Disclaimer & Final Word">
            <p className="mb-4">
              These rules describe the <span className="text-white/90">{season.name}</span> tournament. Future seasons may differ in capacity, prize pool, AI panel composition, scoring weights, and other parameters. Material changes will be announced before the next application window opens.
            </p>
            <p>
              Questions about a specific entry? Email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#b66cff] hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </RuleSection>

        </div>

        <div className="mt-16 pt-10 border-t border-white/10 text-center">
          <a
            href="/apply"
            className="inline-block rounded-lg bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] px-8 py-4 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(139,34,255,.45)] hover:brightness-110 transition"
          >
            Apply to {season.name}
          </a>
          <p className="text-white/30 text-xs mt-10">
            OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
          </p>
          <p className="text-white/30 text-xs mt-1">
            {formatFooterStatusLine()}
          </p>
        </div>
      </section>
    </main>
  )
}

function RuleSection({
  num,
  title,
  children,
}: {
  num: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-4 font-bold">
        {num} {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}
