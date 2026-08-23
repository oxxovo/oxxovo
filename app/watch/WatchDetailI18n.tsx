'use client'

// ★2026-08-11 (지수2C). app/watch/[id]/page.tsx is a SERVER component (async,
// data-fetching) -- useT()/useAdminLang() are React hooks (useSyncExternalStore)
// and cannot run there. These small client leaves carry just the translated
// text; the page passes them plain data as props and stays a server component
// for everything else. Keys: reports/lane_c_i18n_translation_list_2026-08-10.md
// "Watch -- 상세 페이지 본문" section + the approved translation doc.
import { useT, useAdminLang } from '@/lib/admin-i18n'
import type { WatchRound } from '@/lib/watch'

export function RoundLabel({ round }: { round: WatchRound }) {
  const t = useT()
  return <>{round === 'main' ? t.watch.detail_roundlabel_main : t.watch.detail_roundlabel_prelim}</>
}

export function StaffPickLabel() {
  const t = useT()
  return <>{t.watch.detail_staffpick}</>
}

export function WinnerBadgeLabel() {
  const t = useT()
  return <>{t.watch.detail_winner}</>
}

// null when the entry is neither ranked nor a generic winner (mirrors the old
// rankLabel === '' case -- caller skips rendering entirely).
export function RankLabel({ awardRank, awarded }: { awardRank: number | null; awarded: boolean }) {
  const t = useT()
  if (awardRank === 1) return <>{t.watch.detail_rank1}</>
  if (awardRank === 2) return <>{t.watch.detail_rank2}</>
  if (awardRank === 3) return <>{t.watch.detail_rank3}</>
  if (awarded) return <>{t.watch.detail_winner_generic}</>
  return null
}

// ★Self-authored EN (no doc entry -- the Korean here was already hardcoded and
// unconditional before this pass; a 제니2-approved English string never
// existed for it). Logged in reports/lane_c_watch_selfauthored_en_2026-08-11.md
// for a 제니3 review pass, per 제니2's 2026-08-11 direction ("판단대로 가라").
export function MainRoundPendingNote() {
  const t = useT()
  return <>{t.watch.detail_main_round_pending}</>
}

// HQ 2026-08-22, item 3: the required element (Twist/필수조건), main-round
// only, rendered ONLY when the caller already confirmed it is revealed --
// this component trusts its prop and does no gating of its own. The gate
// lives server-side in app/watch/[id]/page.tsx (isTwistRevealed(), via
// getRevealedTheme()) -- the same single source every other surface reads
// the twist through. Never pass an unrevealed twist in here "to be shown
// later"; there is no client-side hold-back.
//
// ★HQ 2026-08-22 (follow-up): two lines -- label+value, then a prompt
// pointing the audience at WHY it matters for voting ("compare how each
// entry solved the same constraint"). Gating unchanged from above.
export function TwistLabel({ twist }: { twist: string }) {
  const t = useT()
  return (
    <>
      {t.watch.detail_twist_label(twist)}
      <br />
      {t.watch.detail_twist_prompt}
    </>
  )
}

export function ViewsCommentsLine({
  views,
  comments,
  submittedAtISO,
}: {
  views: number
  comments: number
  submittedAtISO: string | null
}) {
  const t = useT()
  const lang = useAdminLang()
  const dateStr = submittedAtISO
    ? new Date(submittedAtISO).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')
    : null
  return (
    <>
      {t.watch.detail_views(views)}
      {comments > 0 && <> · {t.watch.detail_comments_count(comments)}</>}
      {dateStr && <> · {dateStr}</>}
    </>
  )
}

export function MadeWithLine({ aiService }: { aiService: string }) {
  const t = useT()
  return <>{t.watch.detail_madewith(aiService)}</>
}

export function RelatedTitle() {
  const t = useT()
  return <>{t.watch.detail_related_title}</>
}

export function RelatedEmpty() {
  const t = useT()
  return <>{t.watch.detail_related_empty}</>
}

export function RelatedCardMeta({ views, likes }: { views: number; likes: number }) {
  const t = useT()
  return <>{t.watch.detail_related_views_likes(views, likes)}</>
}
