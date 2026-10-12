// Pure helpers behind app/_site/ScrollRow (a sideways-scrolling row with a hidden bar,
// an end fade, and auto-centering of the current item). No DOM here, so the arithmetic
// is testable -- including right-to-left, where browsers report scrollLeft as 0 at the
// start and NEGATIVE values after scrolling toward the end.

// Is there more content beyond the END edge (right in LTR, left in RTL)? Math.abs makes
// both directions the same question: how far have we moved from the start.
export function hasMoreAtEnd(m: { scrollLeft: number; clientWidth: number; scrollWidth: number }, tolerance = 2): boolean {
  return Math.abs(m.scrollLeft) + m.clientWidth < m.scrollWidth - tolerance
}

// How far (px, signed) the scroller must move so that element `e` sits in the middle of
// container `c`. Both are viewport rects (left, width). Adding the result to scrollLeft
// is correct in LTR and RTL alike: a positive delta scrolls the content leftwards on
// screen in both, and the browser clamps it at the ends.
export function scrollDeltaToCenter(c: { left: number; width: number }, e: { left: number; width: number }): number {
  return e.left + e.width / 2 - (c.left + c.width / 2)
}
