// /watch/[id] -- video detail + player. round is a query param
// (?round=application|main) since one application has two videos. Player +
// metadata land here at launch; likes / views / comments / vote attach in the
// later phases. 100% data-driven via lib/watch (service-role, server only).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getWatchVideo, getWatchComments, type WatchRound } from '@/lib/watch'
import { getUserOrNull } from '@/lib/user-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ChatWidget } from '@/app/_components/ChatWidget'
import { WatchPlayer } from '../WatchPlayer'
import { ViewTracker } from '../ViewTracker'
import { LikeButton } from '../LikeButton'
import { CommentSection } from '../CommentSection'

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
  const [video, user, comments] = await Promise.all([
    getWatchVideo(id, round),
    getUserOrNull(),
    getWatchComments(id, round),
  ])

  if (!video) notFound()

  // Whether the signed-in member already liked this video (for the button's
  // initial state). Anonymous viewers start un-liked.
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
      <section className="px-6 pt-24 pb-12 md:pt-28 max-w-4xl mx-auto">
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
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <LikeButton
            applicationId={video.applicationId}
            round={video.round}
            initialLiked={initialLiked}
            initialCount={video.likeCount}
            isLoggedIn={!!user}
          />
          <p className="text-sm text-white/50">
            {video.viewCount.toLocaleString()} views
            {video.commentCount > 0 && <> · {video.commentCount.toLocaleString()} comments</>}
          </p>
        </div>
        {video.aiService && (
          <p className="mt-2 text-xs text-white/35">Made with {video.aiService}</p>
        )}

        {/* Vote (main round) attaches here in phase 7. */}

        <CommentSection
          applicationId={video.applicationId}
          round={video.round}
          comments={comments}
          currentUserId={user?.id ?? null}
        />
      </section>

      <ChatWidget />
    </main>
  )
}
