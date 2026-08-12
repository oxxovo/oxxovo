#!/usr/bin/env node
/**
 * READ-ONLY: can a visitor get back to the site from every public page that had
 * no way back? Clicks the real affordance in a real browser and asserts where it
 * lands -- a grep can only prove the markup exists, not that it navigates.
 *
 * Pages and the affordance each one uses:
 *   /           landing logo (was href="#", did nothing anywhere)
 *   /welcome    the SAME LandingView -- the case href="#" could never fix, since
 *               here "/" is a real navigation rather than a reload
 *   /login      the OXXOVO wordmark (already rendered, was not a link)
 *   /pre-register  same
 *   /terms      "← OXXOVO", the markup /tournament and /about already use
 *   /privacy    same
 *
 * NOT covered, by design: /coming-soon. It is the gate rewrite target
 * (proxy.ts:129), so a home link there would resolve back to itself while the
 * gate is on and serve nobody while it is off. It deliberately has no link, so
 * there is nothing here to assert.
 *
 * Run: node scripts/home-link-reachability-check.mjs   (needs `npm start` up)
 */
import { chromium } from 'playwright-core'

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:3000'

const CASES = [
  { path: '/', name: 'landing logo', sel: 'header a[href="/"]' },
  { path: '/welcome', name: 'landing logo (the /welcome case)', sel: 'header a[href="/"]' },
  { path: '/login', name: 'wordmark', sel: 'a[href="/"]' },
  { path: '/pre-register', name: 'wordmark', sel: 'a[href="/"]' },
  { path: '/terms', name: '← OXXOVO', sel: 'a[href="/"]' },
  { path: '/privacy', name: '← OXXOVO', sel: 'a[href="/"]' },
]

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext()
let bad = 0
console.log(`base ${BASE}\n`)
console.log('page            affordance                          found  clicked -> landed        verdict')
for (const c of CASES) {
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${BASE}${c.path}`, { waitUntil: 'networkidle' })
  const el = page.locator(c.sel).first()
  const found = (await el.count()) > 0
  let landed = '-'
  let ok = false
  if (found) {
    // Click the real element rather than reading href: a link can exist and still
    // be covered, disabled, or intercepted.
    //
    // ★Wait on the URL, not on load state. These are next/link client
    // navigations: waitForLoadState('networkidle') resolves before the router has
    // committed, so page.url() still reads the OLD path -- which made every page
    // look like it never navigated, and made "/" look like a pass because its
    // answer happens to equal its starting path. Waiting on the URL is what
    // actually distinguishes "went home" from "went nowhere".
    await el.click()
    try {
      await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 8000 })
    } catch {
      /* leave landed as whatever it ended up being; asserted below */
    }
    landed = new URL(page.url()).pathname
    ok = landed === '/'
  }
  if (!ok) bad++
  console.log(
    `${c.path.padEnd(15)} ${c.name.padEnd(34)} ${String(found).padEnd(6)} ${landed.padEnd(24)} ${ok ? 'OK' : '** FAIL'}`,
  )
  await page.close()
}
// The click assertion is weak on "/" alone, because landing on "/" is also what
// doing nothing looks like there. So assert the defect itself is gone: the header
// brand must not be an href="#" anchor on either URL that serves LandingView.
console.log('\ndead-link regression (the original defect was href="#"):')
for (const path of ['/', '/welcome']) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  const dead = await page.locator('header a[href="#"]').count()
  const live = await page.locator('header a[href="/"]').count()
  const ok = dead === 0 && live > 0
  if (!ok) bad++
  console.log(`  ${path.padEnd(10)} href="#" ${dead}   href="/" ${live}   ${ok ? 'OK' : '** FAIL'}`)
  await page.close()
}

// Layout evidence for the two legal pages, whose footer block was restructured
// (the copyright text became a <p> so the link could sit above it).
for (const path of ['/terms', '/privacy']) {
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  // The legal pages are long, so the footer starts far below the fold and a clip
  // computed from an off-screen box lands outside the image. Scroll to it first,
  // then the box is viewport-relative and the clip is valid.
  const el = page.locator('a[href="/"]').first()
  await el.scrollIntoViewIfNeeded()
  const box = await el.boundingBox()
  if (box) {
    await page.screenshot({
      path: `reports/_shots/homelink${path.replace('/', '-')}.png`,
      clip: { x: 0, y: Math.max(0, box.y - 50), width: 900, height: 180 },
    })
  }
  await page.close()
}

await browser.close()

console.log(`\n${bad === 0 ? 'PASS' : `FAIL (${bad})`} -- ${CASES.length} pages clicked through to /, plus the href="#" check`)
process.exit(bad === 0 ? 0 : 1)
