// Video card + the text-free skeleton frames used while a section has nothing to show.
// All wording comes from the catalog through `t`; there is no literal text here.
//
// Hover (and keyboard focus): the start of the description appears over the image (the
// title is already under it, so it is not repeated). A card with no description has no
// hover layer at all. A card whose kind has no detail address is not a link (no pointer, no focus):
// its hover text still shows, it just cannot be clicked.
import Link from 'next/link'
import { ScrollRow } from './ScrollRow'
import type { HomeCard } from '@/lib/home-feed'
import { badgeKey } from '@/lib/home-sections'
import type { Translator } from '@/lib/site-messages'

export function Card({ card, t }: { card: HomeCard; t: Translator }) {
  const body = (
    <>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#1a1033] to-[#0b0814]">
        {card.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        )}
        {card.summary && (
          // Description only: the title is already printed under the image. No description
          // -> no overlay at all (nothing to reveal).
          <div
            data-hover="true"
            className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-black/10 p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <p className="text-xs leading-snug text-[#f0ecff] line-clamp-4">{card.summary}</p>
          </div>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#f4f0ff] line-clamp-2">{card.title}</div>
      {card.subtitle && <div className="mt-0.5 text-xs text-[#a79fc4] line-clamp-1">{card.subtitle}</div>}
      <div data-badge={card.badge} className="mt-1 text-[10px] font-bold tracking-wider text-[#7a7299]">
        {t(badgeKey(card.badge))}
        {card.aiGenerated && <span className="ms-2 font-normal">· {t('card.aiGenerated')}</span>}
      </div>
    </>
  )
  return card.href ? (
    <Link href={card.href} className="group block" data-card="link">
      {body}
    </Link>
  ) : (
    <div className="group" data-card="static">
      {body}
    </div>
  )
}

// One empty card: image block + two text bars. aria-hidden: it says nothing.
function SkeletonCard() {
  return (
    <div aria-hidden="true" data-skeleton="card">
      <div className="aspect-video rounded-lg bg-[#15102a]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-[#15102a]" />
      <div className="mt-1.5 h-2.5 w-1/2 rounded bg-[#110d1f]" />
    </div>
  )
}

// `carousel`: below the md breakpoint the row is a horizontal scroll-snap strip (each card
// ~72% wide so the next one peeks in); from md up it is the 4-column grid. The strip uses
// flex, snap-start and logical spacing only, so a right-to-left page scrolls and snaps
// from the right with no extra code.
export function CardGrid({
  cards,
  t,
  skeletonCount = 4,
  carousel = false,
}: {
  cards: HomeCard[]
  t: Translator
  skeletonCount?: number
  carousel?: boolean
}) {
  const listCls = carousel
    ? 'flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0'
    : 'grid grid-cols-2 gap-4 lg:grid-cols-4'
  const itemCls = carousel ? 'w-[72%] shrink-0 snap-start md:w-auto' : ''
  const empty = cards.length === 0
  const items = empty
    ? Array.from({ length: skeletonCount }, (_, i) => (
        <li key={i} className={itemCls}>
          <SkeletonCard />
        </li>
      ))
    : cards.map((c) => (
        <li key={c.key} className={itemCls}>
          <Card card={c} t={t} />
        </li>
      ))
  const extra = empty ? { 'data-empty': 'true' } : {}
  if (carousel) {
    return (
      <ScrollRow
        as="ul"
        data-carousel="true"
        {...extra}
        className={listCls}
        fadeClassName="bg-gradient-to-l from-[#070512] to-transparent rtl:bg-gradient-to-r"
      >
        {items}
      </ScrollRow>
    )
  }
  return (
    <ul {...extra} className={listCls}>
      {items}
    </ul>
  )
}
