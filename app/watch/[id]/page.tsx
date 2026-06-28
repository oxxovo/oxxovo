// /watch/[id] -- video detail + player. round is a query param
// (?round=application|main) since one application has two videos. Two-column
// layout: left = player + meta + social + comments, right = related sidebar
// (same season, trending). 100% data-driven via lib/watch (service-role, server).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getWatchVideo,
  getWatchComments,
  getVoteContext,
  getRelatedVideos,
  getPublicMainScore,
  type WatchRound,
  type WatchVideo,
} from '@/lib/watch'
import { getUserOrNull } from '@/lib/user-auth'
import { getAdminOrNull } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { WatchPlayer } from '../WatchPlayer'
import { ViewTracker } from '../ViewTracker'
import { LikeButton } from '../LikeButton'
import { CommentSection } from '../CommentSection'
import { StaffPickToggle } from '../StaffPickToggle'
import { VoteButton } from '../VoteButton'
import { ShareButton } from '../ShareButton'
import { SaveButton, VideoReportButton } from '../SaveReportButtons'
import { ScorePanel } from '../ScorePanel'

export const dynamic = 'force-dynamic'

function parseRound(v: string | undefined): WatchRound {
  return v === 'main' ? 'main' : 'application'
}

export default async function WatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ round?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const round = parseRound(sp.round)

  // Visibility gate FIRST: getWatchVideo enforces HIDDEN_STATUSES (flagged/
  // rejected -> null). Only after it confirms the video is public do we fetch
  // comments/votes/score/related, so none of those can leak for a hidden app
  // even though they don't each re-check status.
  const [video, user, adminUser] = await Promise.all([
    getWatchVideo(id, round),
    getUserOrNull(),
    getAdminOrNull(),
  ])

  if (!video) notFound()

  // Main-round videos carry a community vote (windowed) + public Triple-AI score
  // (finalists only; null until judging completes). Prelim scores are owner-only
  // (shown on /profile), never here.
  const [comments, voteCtx, related, mainScore] = await Promise.all([
    getWatchComments(id, round),
    round === 'main'
      ? getVoteContext(video.applicationId, video.seasonId, user?.id ?? null)
      : Promise.resolve(null),
    getRelatedVideos(video.seasonId, video.applicationId, video.round),
    round === 'main' ? getPublicMainScore(video.applicationId) : Promise.resolve(null),
  ])

  // Whether the signed-in member already liked this video (initial button state).
  let initialLiked = false
  if (user) {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('watch_likes')
      .select('id')
      .eq('application_id', id)
      .eq('round', round)
      .eq('user_id', user.id)
      .maybeSingle()
    initialLiked = !!data
  }

  const roundLabel = round === 'main' ? 'Main Round' : 'Preliminary'

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-12 md:pt-28 max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Left: player + meta + social + comments */}
        <div className="flex-1 min-w-0">
          <Link href="/watch" className="text-sm text-white/50 hover:text-white transition">
            ← Watch
          </Link>

          <div className="mt-5">
            <WatchPlayer url={video.videoUrl} />
          </div>
          <ViewTracker applicationId={video.applicationId} round={video.round} />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/75">
              {roundLabel}
            </span>
            {video.staffPick && (
              <span className="inline-flex items-center rounded bg-[#8b22ff]/85 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Staff Pick
              </span>
            )}
            {video.awarded && (
              <span className="inline-flex items-center rounded bg-amber-500/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">
                🏆 Winner
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-black">{video.creatorName}</h1>

          {/* Action row: creator (left) + like/share/save/report (right). */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-white/80">{video.creatorName}</span>
            <div className="flex flex-wrap items-center gap-2">
              <LikeButton
                applicationId={video.applicationId}
                round={video.round}
                initialLiked={initialLiked}
                initialCount={video.likeCount}
                isLoggedIn={!!user}
              />
              <ShareButton />
              <SaveButton isLoggedIn={!!user} />
              <VideoReportButton isLoggedIn={!!user} />
              {adminUser && (
                <StaffPickToggle applicationId={video.applicationId} initial={video.staffPick} />
              )}
            </div>
          </div>

          {/* Meta box: competition label + stats + AI tool. */}
          <div className="mt-4 rounded-xl bg-white/[.04] p-4 text-sm text-white/70">
            <p className="font-bold text-white/90">
              {roundLabel}
              {video.awarded && ' · 🏆 Winner'}
              {video.staffPick && ' · Staff Pick'}
            </p>
            <p className="mt-1 text-white/50">
              {video.viewCount.toLocaleString()} views
              {video.commentCount > 0 && <> · {video.commentCount.toLocaleString()} comments</>}
              {video.submittedAt && <> · {new Date(video.submittedAt).toLocaleDateString()}</>}
            </p>
            {video.aiService && <p className="mt-1 text-xs text-white/40">Made with {video.aiService}</p>}
          </div>

          {voteCtx && (
            <div className="mt-6">
              <VoteButton applicationId={video.applicationId} ctx={voteCtx} isLoggedIn={!!user} />
            </div>
          )}

          {mainScore && <ScorePanel score={mainScore} />}

          <CommentSection
            applicationId={video.applicationId}
            round={video.round}
            comments={comments}
            currentUserId={user?.id ?? null}
          />
        </div>

        {/* Right: related (same season, trending) */}
        <aside className="lg:w-80 shrink-0">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 mb-4">
            More from this season
          </h2>
          {related.length === 0 ? (
            <p className="text-sm text-white/35">Nothing else here yet.</p>
          ) : (
            <div className="space-y-3">
              {related.map((v) => (
                <RelatedCard key={`${v.applicationId}:${v.round}`} v={v} />
              ))}
            </div>
          )}
        </aside>
      </section>

      <ChatWidget />
    </main>
  )
}

function RelatedCard({ v }: { v: WatchVideo }) {
  return (
    <Link
      href={`/watch/${v.applicationId}?round=${v.round}`}
      className="group flex gap-3 rounded-lg p-1.5 transition hover:bg-white/5"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-[#0c0a14]">
        {v.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbnailUrl} alt={v.creatorName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] to-[#1a0633] p-1 text-center">
            <span className="text-[10px] font-bold uppercase text-white/80">{v.creatorName}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{v.creatorName}</p>
        <p className="mt-0.5 text-[11px] text-white/45">
          {v.viewCount.toLocaleString()} views · {v.likeCount.toLocaleString()} likes
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">
          {v.round === 'main' ? 'Main Round' : 'Preliminary'}
        </p>
      </div>
    </Link>
  )
}
