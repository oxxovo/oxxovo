// Review fixture: renders the REAL SiteFrame + CardGrid (client bundle, fixed data, no DB, no
// network except the Tailwind CDN script) to reports/site_fixtures/<name>.html and a PNG.
// Mobile shots go through an iframe because headless Chrome's window min width is ~500px.
// Usage: node scripts/site-fixture-shot.mjs <name> <cfg.json> [--mobile] [--w 390] [--h 844]
// cfg: { locale, dir, page, item?, carousel?, cards[], openMenu? }
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const posix = (p) => p.replaceAll('\\', '/')
const [name, cfgPath, ...flags] = process.argv.slice(2)
const mobile = flags.includes('--mobile')
const arg = (k, d) => (flags.includes(k) ? Number(flags[flags.indexOf(k) + 1]) : d)
const W = arg('--w', mobile ? 390 : 1280)
const H = arg('--h', mobile ? 844 : 800)
const CHROME = process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = join(ROOT, 'reports/site_fixtures')

const dir = mkdtempSync(join(tmpdir(), 'site-shot-'))
try {
  const entry = join(dir, 'entry.tsx')
  writeFileSync(entry, `import React from 'react'
import { createRoot } from 'react-dom/client'
import { SiteFrame } from ${JSON.stringify(posix(join(ROOT, 'app/_site/SiteFrame.tsx')))}
import { CardGrid } from ${JSON.stringify(posix(join(ROOT, 'app/_site/Card.tsx')))}
import { LOCALES, withLocale } from ${JSON.stringify(posix(join(ROOT, 'lib/locales.ts')))}
import { translator } from ${JSON.stringify(posix(join(ROOT, 'lib/site-messages.ts')))}
import { getPage, resolveSidebarItem } from ${JSON.stringify(posix(join(ROOT, 'lib/site-nav.ts')))}
const cfg = (window as any).__CFG__
const def = getPage(cfg.page)
const t = translator(cfg.locale)
const grid = React.createElement(CardGrid, { cards: cfg.cards, t, carousel: !!cfg.carousel })
createRoot(document.getElementById('root')!).render(
  React.createElement(SiteFrame, {
    locale: cfg.locale, dir: cfg.dir, t, page: cfg.page, banner: null,
    activeItem: resolveSidebarItem(def, cfg.item), accountHref: '/login',
    languages: LOCALES.map((l) => ({ code: l.code, nativeName: l.nativeName, href: withLocale(def.path, l.code, LOCALES) })),
  } as any, cfg.page === 'home' ? React.createElement(React.Fragment, null, React.createElement('h2', { className: 'mb-3 text-lg font-bold text-[#f4f0ff]' }, t('home.featured')), grid) : grid),
)
if (cfg.openMenu) setTimeout(() => { const d = document.querySelector('details'); if (d) (d as HTMLDetailsElement).open = true }, 300)
`)
  const bundle = join(dir, 'bundle.js')
  await build({
    entryPoints: [entry], outfile: bundle, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [join(ROOT, 'node_modules')], alias: { '@': ROOT, 'next/link': join(ROOT, 'scripts/_link-stub.js') },
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
  })
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;background:#070512}.fx{position:fixed;inset-inline-end:6px;bottom:6px;background:#000c;color:#ffd;font:11px monospace;padding:3px 6px;z-index:99}</style></head><body><div id="root"></div><div class="fx">FIXTURE DATA - ${name}</div><script>window.__CFG__=${JSON.stringify(cfg)}</script><script>${readFileSync(bundle, 'utf8').replace(/<\/script/g, '<\\/script')}</script></body></html>`
  const htmlPath = join(OUT, name + '.html')
  writeFileSync(htmlPath, html)
  let target = htmlPath
  if (mobile) {
    target = join(dir, 'wrap.html')
    writeFileSync(target, `<!doctype html><body style="margin:0;background:#222"><iframe src="file:///${posix(htmlPath)}" style="width:${W}px;height:${H}px;border:0;display:block"></iframe></body>`)
  }
  const png = join(OUT, name + '.png')
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${mobile ? W + 20 : W},${H + (mobile ? 20 : 0)}`, '--virtual-time-budget=10000', `--screenshot=${png}`, 'file:///' + posix(target)], { encoding: 'utf8' })
  console.log('chrome exit', r.status, png)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
