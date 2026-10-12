// Renders app/_site/SiteFrame.tsx (+ cards) to static HTML from fixed data (no DB, no network).
// Used by lib/home-view.test.ts and by the review files (reports/home_fixtures).
// next/link is swapped for a plain <a>; everything else is the real component.
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const posix = (p) => p.split('\\').join('/')

const linkStub = `
import React from 'react'
export default function Link({ href, children, ...rest }) {
  return React.createElement('a', { href, ...rest }, children)
}
`

let cached = null
async function load() {
  if (cached) return cached
  const dir = mkdtempSync(join(tmpdir(), 'site-render-'))
  const entry = join(dir, 'entry.tsx')
  writeFileSync(
    entry,
    `import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { SiteFrame } from ${JSON.stringify(posix(join(ROOT, 'app/_site/SiteFrame.tsx')))}
import { CardGrid } from ${JSON.stringify(posix(join(ROOT, 'app/_site/Card.tsx')))}
export function render({ cards, carousel, ...frame }) {
  return renderToStaticMarkup(React.createElement(SiteFrame, frame, React.createElement(CardGrid, { cards: cards ?? [], t: frame.t, carousel: !!carousel })))
}
`,
  )
  const stub = join(dir, 'link-stub.js')
  writeFileSync(stub, linkStub)
  const out = join(dir, 'bundle.mjs')
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    nodePaths: [join(ROOT, 'node_modules')],
    alias: { '@': ROOT, 'next/link': stub },
    // react-dom is CommonJS and requires node built-ins; an ESM bundle needs a require.
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: 'silent',
  })
  const mod = await import(pathToFileURL(out).href)
  cached = { render: mod.render, dir }
  return cached
}

export async function renderSite(props) {
  return (await load()).render(props)
}

export function cleanup() {
  if (cached) rmSync(cached.dir, { recursive: true, force: true })
  cached = null
}
