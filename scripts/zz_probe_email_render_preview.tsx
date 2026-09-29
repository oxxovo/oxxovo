// Read-only render preview for the 13 date-driven email templates (the ones
// fired by app/api/cron/email-tick/route.ts) plus 2 membership templates
// (fireMembershipNotices, gated on isMembershipEnabled rather than
// isFixtureSeason -- a different family, HQ 2026-08-30 asked for them here
// too since they carry the same date-formatting risk). NO SEND: only
// lib/email/send.tsx's
// `executeSend` ever calls resend.emails.send / logEmail / alreadySent, and this
// script never imports that file or the cron route -- it calls the same
// `render()` (@react-email/components) executeSend calls, on the same
// template components, and stops there. Writes HTML + subject to
// outputs/email-preview/, one file per template x language (x variant where a
// template has more than one -- audience/round/placement).
//
// HQ 2026-08-30: verify (a) every {{}}-shaped slot actually fills with a real
// value, (b) dates render with time-of-day + an explicit US-Pacific label
// (not bare "PT"), (c) the Nov-1 DST boundary doesn't shift the hour, (d)
// prize/other figures match the live season_0 row, in both KR and EN.
//
// Run: node --env-file=.env.local scripts/zz_probe_email_render_preview.mjs
// (this .tsx is compiled to that .mjs by esbuild first -- see the build step
// this script's runbook line names).

import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { MainRoundStart, subjectFor as subjMainRoundStart } from '../lib/email/templates/MainRoundStart'
import { SubmissionDeadline, subjectFor as subjSubmissionDeadline } from '../lib/email/templates/SubmissionDeadline'
import { ApplicationDeadline, subjectFor as subjApplicationDeadline } from '../lib/email/templates/ApplicationDeadline'
import { DeferralNotice, subjectFor as subjDeferralNotice } from '../lib/email/templates/DeferralNotice'
import { SelectedTop50, subjectFor as subjSelectedTop50 } from '../lib/email/templates/SelectedTop50'
import { NotSelected, subjectFor as subjNotSelected } from '../lib/email/templates/NotSelected'
import { ResultsAnnounced, subjectFor as subjResultsAnnounced, type ResultsPlacement } from '../lib/email/templates/ResultsAnnounced'
import { SeasonWinnerAnnounced, subjectFor as subjSeasonWinnerAnnounced } from '../lib/email/templates/SeasonWinnerAnnounced'
import { VideoLivePrelim, subjectFor as subjVideoLivePrelim } from '../lib/email/templates/VideoLivePrelim'
import { VideoLiveMain, subjectFor as subjVideoLiveMain } from '../lib/email/templates/VideoLiveMain'
import { VoteDeadline, subjectFor as subjVoteDeadline } from '../lib/email/templates/VoteDeadline'
import { SubmissionReceived, subjectFor as subjSubmissionReceived } from '../lib/email/templates/SubmissionReceived'
import { MainRoundSubmissionReceived, subjectFor as subjMainRoundSubmissionReceived } from '../lib/email/templates/MainRoundSubmissionReceived'
import { MembershipRenewal, subjectFor as subjMembershipRenewal } from '../lib/email/templates/MembershipRenewal'
import { MembershipFoundingExpiry, subjectFor as subjMembershipFoundingExpiry } from '../lib/email/templates/MembershipFoundingExpiry'
import { prelimReceiptLines, mainReceiptLines } from '../lib/email/schedule-lines'

// ── local copy of formatDeadlinePT (lib/seasons.ts imports 'server-only',
// which throws outside Next's build -- this is the exact same logic, pure). ──
function formatDeadlinePT(
  iso: string | null | undefined,
  lang: 'ko' | 'en' = 'en',
  opts?: { withKst?: boolean; fullTzLabel?: boolean },
): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const ptLabel = lang === 'ko' ? (opts?.fullTzLabel ? '미국 서부 시간' : 'PT') : opts?.fullTzLabel ? 'US Pacific Time' : 'PT'
  if (lang === 'ko' && opts?.withKst) {
    const kstDate = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })
    const kstTime = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', dayPeriod: 'short' })
    const ptDate = d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric' })
    const ptTime = d.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })
    return `한국 시간 ${kstDate} ${kstTime} (${ptDate} ${ptTime} ${ptLabel})`
  }
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US'
  const date = d.toLocaleDateString(locale, { timeZone: 'America/Los_Angeles', month: lang === 'ko' ? 'long' : 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString(locale, { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time} ${ptLabel}`
}

// ★Plain path, not new URL(file, OUT_DIR) -- several filenames contain a
// literal "#" (제니3's numbering, e.g. "selected_top50-ko_#7.html"), and the
// URL API treats "#" as a fragment delimiter, silently truncating everything
// from it onward off the pathname. First run wrote "not_selected-en_" with
// the "#7.html" simply dropped -- caught by listing the directory, not by
// any error (writeFileSync happily "succeeded" on the truncated path).
const OUT_DIR = fileURLToPath(new URL('../outputs/email-preview/', import.meta.url))
mkdirSync(OUT_DIR, { recursive: true })

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: season, error } = await admin
    .from('seasons')
    .select(
      'id,name,total_prize_pool,prize_first,prize_second,prize_third,application_close_at,registration_close_at,main_round_start_at,main_round_end_at,scoring_start_at,scoring_complete_at,prelim_results_announcement_at,community_vote_start_at,community_vote_end_at,awards_announcement_at',
    )
    .eq('id', 'season_0')
    .single()
  if (error || !season) throw new Error('failed to load season_0: ' + error?.message)

  const seasonName = season.name
  const creatorName = 'Jamie Kim' // sample -- not a real applicant, this is a render preview only
  const nickname = creatorName

  type Job = { file: string; subject: string; html: string }
  const jobs: Job[] = []

  const add = async (file: string, subject: string, el: React.ReactElement) => {
    jobs.push({ file, subject, html: await render(el) })
  }

  for (const lang of ['ko', 'en'] as const) {
    // main_round_start
    {
      const p = {
        lang, creatorName, seasonName,
        themeAnnouncementMinutesBefore: 30,
        submissionHours: 48,
        mainRoundVideoMinSeconds: 35,
        mainRoundVideoMaxSeconds: 40,
      }
      await add(`main_round_start-${lang}`, subjMainRoundStart(p), <MainRoundStart {...p} />)
    }
    // submission_deadline
    {
      const p = { lang, creatorName, seasonName, hoursRemaining: 6 }
      await add(`submission_deadline-${lang}`, subjSubmissionDeadline(p), <SubmissionDeadline {...p} />)
    }
    // application_deadline
    {
      const p = { lang, creatorName, seasonName, hoursRemaining: 24 }
      await add(`application_deadline-${lang}`, subjApplicationDeadline(p), <ApplicationDeadline {...p} />)
    }
    // deferral_notice -- exercises formatDeadlinePT's DEFAULT branch (no opts) inside the template itself
    {
      const p = {
        lang, creatorName, seasonName,
        deferCount: 1, maxDeferCount: 2,
        newRegistrationCloseAt: season.registration_close_at,
        newApplicationCloseAt: season.application_close_at,
      }
      await add(`deferral_notice-${lang}`, subjDeferralNotice(p), <DeferralNotice {...p} />)
    }
    // selected_top50 -- mainRoundStartAt goes through the template's OWN
    // formatDateKo/formatDateEn (toLocaleString with NO timeZone option --
    // this is the thing to look at closely in the rendered HTML).
    {
      const p = {
        lang, creatorName, seasonName,
        topNAdvance: 50, totalParticipants: 412,
        mainRoundStartAt: season.main_round_start_at,
        score: 87.4, rank: 12, percentile: 3,
        strength: 'Strong visual continuity across every cut.',
        improvement: 'Pacing sags in the middle third.',
        videoUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?round=application',
        profileUrl: 'https://www.oxxovo.ai/profile',
      }
      await add(`selected_top50-${lang}_#7`, subjSelectedTop50(p), <SelectedTop50 {...p} />)
    }
    // not_selected
    {
      const p = {
        lang, creatorName, seasonName,
        score: 61.2, rank: 340, total: 412, percentile: 82,
        strength: 'Clear concept, well communicated in the opening shot.',
        improvement: 'Several clips exceed the visible generation budget, softening detail.',
        videoUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?round=application',
        profileUrl: 'https://www.oxxovo.ai/profile',
        nextSeasonName: 'Season 1',
        nextSeasonDate: '',
        applyUrl: 'https://www.oxxovo.ai/apply',
      }
      await add(`not_selected-${lang}_#8`, subjNotSelected(p), <NotSelected {...p} />)
    }
    // results_announced -- all 4 placement variants (1st/2nd/3rd/no-award)
    for (const placement of ['rank1', 'rank2', 'rank3', 'main_no_award'] as ResultsPlacement[]) {
      const p = { lang, creatorName, seasonName, placement }
      await add(`results_announced-${placement}-${lang}_#15`, subjResultsAnnounced(p), <ResultsAnnounced {...p} />)
    }
    // season_winner_announced
    {
      const p = { lang, creatorName, seasonName, watchUrl: 'https://www.oxxovo.ai/watch' }
      await add(`season_winner_announced-${lang}_#17`, subjSeasonWinnerAnnounced(p), <SeasonWinnerAnnounced {...p} />)
    }
    // video_live_prelim (scored mode)
    {
      const p = {
        lang, nickname, seasonName,
        videoTitle: 'Neon Harvest',
        thumbnailUrl: null,
        watchUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?round=application',
        shareUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?ref=share',
        reportUrl: 'https://www.oxxovo.ai/profile',
        score: 87.4, percentile: 3, rank: 12,
        aiStrength: 'Strong visual continuity across every cut.',
        aiImprove: 'Pacing sags in the middle third.',
      }
      await add(`video_live_prelim-${lang}`, subjVideoLivePrelim(p), <VideoLivePrelim {...p} />)
    }
    // video_live_main
    {
      const p = {
        lang, nickname, seasonName,
        videoTitle: 'Neon Harvest — Main Round Cut',
        thumbnailUrl: null,
        watchUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?round=main',
        shareUrl: 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?ref=share&round=main',
        voteDeadline: lang === 'ko' ? '2일 14시간' : '2d 14h',
        viewCount: 1284,
      }
      await add(`video_live_main-${lang}`, subjVideoLiveMain(p), <VideoLiveMain {...p} />)
    }
    // vote_deadline -- both audiences. 제니3 #13-A=participant, #13-B=member.
    for (const [audience, num] of [['participant', '13-A'], ['member', '13-B']] as const) {
      const p = {
        lang, name: creatorName, seasonName, audience,
        voteUrl: 'https://www.oxxovo.ai/watch?round=main',
        videoUrl: audience === 'participant' ? 'https://www.oxxovo.ai/watch/00000000-0000-0000-0000-000000000000?round=main' : null,
      }
      await add(`vote_deadline-${audience}-${lang}_#${num}`, subjVoteDeadline(p), <VoteDeadline {...p} />)
    }
    // studio_submission_received (prelim) -- real prelimReceiptLines() off season_0
    {
      const p = {
        lang, creatorName, seasonName,
        videoTitle: 'Neon Harvest',
        submittedAtLabel: formatDeadlinePT(new Date().toISOString(), lang),
        fileState: 'complete' as const,
        scheduleLines: prelimReceiptLines(season, lang),
      }
      await add(`studio_submission_received-${lang}`, subjSubmissionReceived(p), <SubmissionReceived {...p} />)
    }
    // main_round_submission_received -- real mainReceiptLines() off season_0
    {
      const p = {
        lang, creatorName, seasonName,
        videoTitle: 'Neon Harvest — Main Round Cut',
        submittedAtLabel: formatDeadlinePT(new Date().toISOString(), lang),
        fileState: 'complete' as const,
        scheduleLines: mainReceiptLines(season, lang),
      }
      await add(`main_round_submission_received-${lang}`, subjMainRoundSubmissionReceived(p), <MainRoundSubmissionReceived {...p} />)
    }
    // membership_renewal -- date-only (dateStyle:'long', no time), also had
    // the missing-timeZone bug (fixed alongside SelectedTop50/DeferralNotice).
    {
      const p = {
        lang, creatorName,
        priceUsd: 19.99, interval: 'month',
        renewsOn: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
      }
      await add(`membership_renewal-${lang}`, subjMembershipRenewal(p), <MembershipRenewal {...p} />)
    }
    // membership_founding_expiry
    {
      const p = {
        lang, creatorName,
        foundingNumber: 42,
        endsOn: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
        priceUsd: 19.99, interval: 'month',
        subscribeUrl: 'https://www.oxxovo.ai/membership',
      }
      await add(`membership_founding_expiry-${lang}`, subjMembershipFoundingExpiry(p), <MembershipFoundingExpiry {...p} />)
    }
  }

  for (const job of jobs) {
    const wrapped = `<!-- SUBJECT: ${job.subject} -->\n` + job.html
    writeFileSync(join(OUT_DIR, job.file + '.html'), wrapped, 'utf8')
  }
  console.log(`wrote ${jobs.length} HTML files to outputs/email-preview/`)
  console.log(`season_0 reference values used: prize $${season.total_prize_pool} (1st $${season.prize_first} / 2nd $${season.prize_second} / 3rd $${season.prize_third})`)
}

main()
