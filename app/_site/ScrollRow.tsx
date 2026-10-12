'use client'

// A row that scrolls sideways on small screens, used for the top menu and the Featured
// carousel. Three things, all direction-neutral (they also work right-to-left):
//   1. the scroll BAR is hidden (the row still scrolls by touch, wheel, keyboard);
//   2. a soft fade on the END edge says "there is more" -- it disappears once the end is
//      reached, and the whole thing is off from md up where the row does not scroll;
//   3. with centerCurrent, the item marked aria-current="page" is scrolled to the middle
//      of the row on load, so the current area is never hidden off-screen.
// Pure arithmetic lives in lib/scroll-row.
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { hasMoreAtEnd, scrollDeltaToCenter } from '@/lib/scroll-row'

const HIDE_BAR = '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

export function ScrollRow({
  as: Tag = 'div',
  wrapperClassName = '',
  className = '',
  fadeClassName,
  centerCurrent = false,
  children,
  ...rest
}: {
  as?: ElementType
  wrapperClassName?: string
  className?: string
  // Full class string of the fade (colour must match the background behind the row).
  fadeClassName: string
  centerCurrent?: boolean
  children: ReactNode
  [key: string]: unknown
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [more, setMore] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (centerCurrent) {
      const cur = el.querySelector<HTMLElement>('[aria-current="page"]')
      if (cur) el.scrollLeft += scrollDeltaToCenter(el.getBoundingClientRect(), cur.getBoundingClientRect())
    }
    const update = () => setMore(hasMoreAtEnd(el))
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [centerCurrent])

  return (
    <div className={`relative ${wrapperClassName}`} data-scrollrow="true">
      <Tag ref={ref} className={`${HIDE_BAR} ${className}`} {...rest}>
        {children}
      </Tag>
      <span
        aria-hidden="true"
        data-fade="end"
        className={`pointer-events-none absolute inset-y-0 end-0 w-10 transition-opacity duration-150 md:hidden ${more ? 'opacity-100' : 'opacity-0'} ${fadeClassName}`}
      />
    </div>
  )
}
