// Arithmetic of the sideways rows (app/_site/ScrollRow), left-to-right and right-to-left.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasMoreAtEnd, scrollDeltaToCenter } from './scroll-row.ts'

test('more at the end: true until the end is reached (control: a row that does not overflow has none)', () => {
  assert.equal(hasMoreAtEnd({ scrollLeft: 0, clientWidth: 358, scrollWidth: 620 }), true)
  assert.equal(hasMoreAtEnd({ scrollLeft: 100, clientWidth: 358, scrollWidth: 620 }), true)
  assert.equal(hasMoreAtEnd({ scrollLeft: 262, clientWidth: 358, scrollWidth: 620 }), false, 'exactly at the end')
  assert.equal(hasMoreAtEnd({ scrollLeft: 261, clientWidth: 358, scrollWidth: 620 }), false, 'within the 2px tolerance')
  assert.equal(hasMoreAtEnd({ scrollLeft: 255, clientWidth: 358, scrollWidth: 620 }), true)
  assert.equal(hasMoreAtEnd({ scrollLeft: 0, clientWidth: 1120, scrollWidth: 1120 }), false, 'nothing to scroll')
})

test('★right-to-left: scrollLeft is 0 at the start and negative toward the end -- same answers as left-to-right', () => {
  assert.equal(hasMoreAtEnd({ scrollLeft: 0, clientWidth: 358, scrollWidth: 620 }), true)
  assert.equal(hasMoreAtEnd({ scrollLeft: -100, clientWidth: 358, scrollWidth: 620 }), true)
  assert.equal(hasMoreAtEnd({ scrollLeft: -262, clientWidth: 358, scrollWidth: 620 }), false)
  for (const sl of [0, 40, 130, 200, 262]) {
    assert.equal(hasMoreAtEnd({ scrollLeft: -sl, clientWidth: 358, scrollWidth: 620 }), hasMoreAtEnd({ scrollLeft: sl, clientWidth: 358, scrollWidth: 620 }), String(sl))
  }
})

test('centring: the delta moves the element to the middle; zero when it already is; sign follows the side', () => {
  const c = { left: 0, width: 390 }
  assert.equal(scrollDeltaToCenter(c, { left: 195 - 40, width: 80 }), 0)
  assert.equal(scrollDeltaToCenter(c, { left: 330, width: 80 }), 175, 'an item on the right needs a positive scroll')
  assert.equal(scrollDeltaToCenter(c, { left: -50, width: 80 }), -205, 'an item on the left needs a negative scroll')
  assert.equal(scrollDeltaToCenter({ left: 20, width: 390 }, { left: 215 - 40, width: 80 }), 0, 'container offset is respected')
})

test('★the same delta centres the element whichever way the page runs (viewport rect arithmetic does not know the direction)', () => {
  // Simulate both directions: the content strip is 620 wide in a 390 container at x=0.
  // Item centre at strip offset k from the START edge. In LTR the strip starts at the left,
  // in RTL at the right; scrolling by delta shifts every item by -delta on screen.
  const cw = 390, sw = 620
  for (const k of [60, 200, 310, 560]) {
    for (const dir of ['ltr', 'rtl'] as const) {
      const centreOnScreen = dir === 'ltr' ? k : cw - k // strip pinned to the start edge, scroll 0
      const delta = scrollDeltaToCenter({ left: 0, width: cw }, { left: centreOnScreen - 10, width: 20 })
      const after = centreOnScreen - delta
      assert.equal(after, cw / 2, dir + ' k=' + k)
    }
  }
  assert.ok(sw > cw)
})

test('★ScrollRow wires the pure helpers (a source check: the script must use them, not its own arithmetic)', () => {
  const src = readFileSync('app/_site/ScrollRow.tsx', 'utf8')
  assert.ok(/hasMoreAtEnd\(el\)/.test(src) && /scrollDeltaToCenter\(/.test(src))
  assert.ok(/el\.scrollLeft \+= /.test(src), 'adds the delta (works in both directions)')
  assert.ok(/aria-current="page"/.test(src), 'centres the current item')
  assert.ok(!/scrollIntoView/.test(src), 'scrollIntoView could also scroll the page vertically; the row scrolls itself only')
})

test('★the top menu asks to be centred on the current item (the carousel does not)', () => {
  const frame = readFileSync('app/_site/SiteFrame.tsx', 'utf8')
  assert.ok(/data-topnav="true"[\s\S]*?centerCurrent/.test(frame), 'top menu passes centerCurrent')
  const card = readFileSync('app/_site/Card.tsx', 'utf8')
  assert.ok(!/centerCurrent/.test(card), 'the carousel has no "current" item to centre')
})

test('★the fade reacts: it is shown while there is more, hidden at the end, and re-checked on scroll and resize', () => {
  const src = readFileSync('app/_site/ScrollRow.tsx', 'utf8')
  assert.ok(src.includes("more ? 'opacity-100' : 'opacity-0'"), 'opacity follows the state')
  assert.ok(/setMore\(hasMoreAtEnd\(el\)\)/.test(src))
  assert.ok(/addEventListener\('scroll', update/.test(src) && /addEventListener\('resize', update/.test(src))
  assert.ok(/removeEventListener\('scroll'/.test(src) && /removeEventListener\('resize'/.test(src), 'listeners are removed on unmount')
})
