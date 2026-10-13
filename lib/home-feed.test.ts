// Home aggregation: it must only CALL the two doors, never widen or re-judge them.
// All doors are fakes here; each negative case has a positive control next to it
// (a "nothing shows" result means nothing unless the same fixture shows when open).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WatchVideo } from './watch.ts'
import type { PublicListItem as PublicContent } from './content-public.ts'
import type { ContentKind } from './content-kinds.ts'
import { HOME_CARD_MAX, getHomeCards, type HomeFeedDeps } from './home-feed.ts'

const SEASON = 'season-now'

function video(over: Partial<WatchVideo> = {}): WatchVideo {
  return {
    applicationId: 'app1', round: 'application', seasonId: SEASON, videoUrl: 'https://r2.example/v.mp4',
    creatorUserId: 'u1', creatorName: 'Creator One', videoTitle: 'Entry One', videoDescription: null,
    awardRank: null, durationSeconds: 30, aiService: 'kling', staffPick: false, awarded: false,
    submittedAt: '2026-10-10T10:00:00Z', thumbnailUrl: null, likeCount: 9, viewCount: 99, commentCount: 3,
    publicScore: 88, scored: true, voteCount: 7, isFixture: false, ...over,
  } as WatchVideo
}
function content(kind: ContentKind, id: string, publish_at = '2026-10-10T12:00:00Z', over: object = {}): PublicContent {
  return { id, kind, form: 'short', language: 'en', title: `T-${id}`, description: 'd', ai_generated: true, publish_at, ...over } as PublicContent
}

type Calls = { competitionOpen: number; competitionVideos: number; contents: ContentKind[]; paths: number; translations: string[][] }
function deps(o: {
  open?: boolean
  seasonId?: string | null
  videos?: WatchVideo[]
  byKind?: Partial<Record<ContentKind, PublicContent[]>>
  paths?: Partial<Record<ContentKind, string>>
  throwCompetition?: boolean
  throwKind?: ContentKind
  translations?: Record<string, Record<string, { title?: string; description?: string }>>
}): { d: HomeFeedDeps; calls: Calls } {
  const calls: Calls = { competitionOpen: 0, competitionVideos: 0, contents: [], paths: 0, translations: [] }
  const d: HomeFeedDeps = {
    competitionOpen: async () => { calls.competitionOpen++; return o.open ?? false },
    currentSeasonId: async () => (o.seasonId === undefined ? SEASON : o.seasonId),
    competitionVideos: async () => {
      calls.competitionVideos++
      if (o.throwCompetition) throw new Error('boom')
      return o.videos ?? []
    },
    contents: async (kind) => {
      calls.contents.push(kind)
      if (o.throwKind === kind) throw new Error('boom')
      return o.byKind?.[kind] ?? []
    },
    paths: async () => { calls.paths++; return o.paths ?? { news: 'daily', film: 'films', cf: 'ads' } },
    translations: async (ids) => { calls.translations.push(ids); return o.translations ?? {} },
  }
  return { d, calls }
}

const silence = () => {
  const orig = console.error
  console.error = () => {}
  return () => { console.error = orig }
}

test('control: with the doors open and rows present, cards appear', async () => {
  const { d } = deps({ open: true, videos: [video()], byKind: { news: [content('news', 'n1')], film: [content('film', 'f1')] } })
  const cards = await getHomeCards('all', d)
  assert.equal(cards.length, 3)
})

test('competition door closed -> no competition card and the videos are never even requested', async () => {
  const { d, calls } = deps({ open: false, videos: [video()] })
  assert.deepEqual(await getHomeCards('competition', d), [])
  assert.equal(calls.competitionOpen, 1)
  assert.equal(calls.competitionVideos, 0, 'the gate comes before the read')
})

test('closed competition does not hide an open contents section (the reason the root no longer ANDs the gate)', async () => {
  const { d } = deps({ open: false, videos: [video()], byKind: { news: [content('news', 'n1')] } })
  const cards = await getHomeCards('all', d)
  assert.deepEqual(cards.map((c) => c.badge), ['daily'])
})

test('contents door answers nothing (switch closed) -> nothing, even with a competition card in the same view', async () => {
  const { d } = deps({ open: true, videos: [video()] })
  const cards = await getHomeCards('all', d)
  assert.deepEqual(cards.map((c) => c.badge), ['competition'])
})

test('competition cards are narrowed to the current season and never a fixture entry', async () => {
  const { d } = deps({
    open: true,
    videos: [
      video({ applicationId: 'a-now' }),
      video({ applicationId: 'a-old', seasonId: 'season-test' }),
      video({ applicationId: 'a-fix', isFixture: true }),
    ],
  })
  const cards = await getHomeCards('competition', d)
  assert.deepEqual(cards.map((c) => c.key), ['competition:a-now:application'])
})

test('no current season -> no competition cards', async () => {
  const { d, calls } = deps({ open: true, seasonId: null, videos: [video()] })
  assert.deepEqual(await getHomeCards('competition', d), [])
  assert.equal(calls.competitionVideos, 0)
})

test('a row of another kind from the contents door is dropped, not shown under this section', async () => {
  const { d } = deps({ byKind: { news: [content('news', 'n1'), content('film', 'sneaky')] } })
  const cards = await getHomeCards('news', d)
  assert.deepEqual(cards.map((c) => c.key), ['content:n1'])
})

test('a section asks only for its own kinds; sections without a source ask nothing', async () => {
  const a = deps({})
  await getHomeCards('news', a.d)
  assert.deepEqual(a.calls.contents, ['news'])
  assert.equal(a.calls.competitionOpen, 0)

  const m = deps({})
  await getHomeCards('music', m.d)
  assert.deepEqual([...m.calls.contents].sort(), ['music', 'music_video'])

  const e = deps({})
  await getHomeCards('entertainment', e.d)
  assert.deepEqual([...e.calls.contents].sort(), ['cf', 'drama', 'film', 'music', 'music_video'])

  const c = deps({ open: true, videos: [video()], byKind: { news: [content('news', 'n1')] } })
  await getHomeCards('competition', c.d)
  assert.deepEqual(c.calls.contents, [], 'the competition section never asks the contents door')
  assert.equal(c.calls.paths, 0)
})

test('translation seat: another language picks a translated title; missing -> English canonical; English never asks', async () => {
  const rows = { news: [content('news', 'n1'), content('news', 'n2')] }
  const tr = { n1: { ko: { title: 'KO-TITLE', description: 'KO-DESC' } } }
  const ko = deps({ byKind: rows, translations: tr })
  const cards = await getHomeCards('news', ko.d, 'ko')
  assert.equal(cards.find((c) => c.key === 'content:n1')?.title, 'KO-TITLE')
  assert.equal(cards.find((c) => c.key === 'content:n1')?.subtitle, 'KO-DESC')
  assert.equal(cards.find((c) => c.key === 'content:n2')?.title, 'T-n2', 'no translation -> canonical, not hidden')
  const en = deps({ byKind: rows, translations: tr })
  const enCards = await getHomeCards('news', en.d, 'en')
  assert.equal(enCards.find((c) => c.key === 'content:n1')?.title, 'T-n1')
  assert.deepEqual(en.calls.translations, [], 'English is the canonical text: no translation lookup')
})

test('a failing translation lookup leaves the cards in English', async () => {
  const restore = silence()
  try {
    const x = deps({ byKind: { news: [content('news', 'n1')] } })
    x.d.translations = async () => { throw new Error('boom') }
    const cards = await getHomeCards('news', x.d, 'ko')
    assert.equal(cards[0].title, 'T-n1')
  } finally {
    restore()
  }
})

test('a door that throws contributes nothing; the other source still shows', async () => {
  const restore = silence()
  try {
    const a = deps({ open: true, throwCompetition: true, byKind: { news: [content('news', 'n1')] } })
    assert.deepEqual((await getHomeCards('all', a.d)).map((c) => c.key), ['content:n1'])
    const b = deps({ open: true, throwKind: 'news', videos: [video()], byKind: { film: [content('film', 'f1')] } })
    assert.deepEqual((await getHomeCards('all', b.d)).map((c) => c.key).sort(), ['competition:app1:application', 'content:f1'])
  } finally {
    restore()
  }
})

test('★a card carries only the allowed fields: no score, rank, counts, source or upstream data', async () => {
  const leaky = content('news', 'n1', undefined, {
    source_ref: 'step10-news-20261010', source: 'news_desk', upstream_approval_id: 'x', rights_reason: 'r', payload_hash: 'h', caption: 'sns',
  })
  const { d } = deps({ open: true, videos: [video()], byKind: { news: [leaky as PublicContent] } })
  const cards = await getHomeCards('all', d)
  const allowed = ['aiGenerated', 'badge', 'durationSec', 'href', 'key', 'publishedAt', 'subtitle', 'summary', 'thumbnailUrl', 'title']
  for (const c of cards) assert.deepEqual(Object.keys(c).sort(), allowed)
  const json = JSON.stringify(cards)
  for (const bad of ['source_ref', 'step10-news', 'upstream', 'rights_reason', 'payload_hash', 'caption', 'publicScore', 'voteCount', 'likeCount', 'creatorUserId', 'videoUrl', 'r2.example']) {
    assert.ok(!json.includes(bad), `leaked: ${bad}`)
  }
})

test('addresses: contentUrl only; a kind without a configured slug is shown but not linked', async () => {
  const { d } = deps({ byKind: { news: [content('news', 'n1')], drama: [content('drama', 'd1')] }, paths: { news: 'daily' } })
  const cards = await getHomeCards('all', d)
  assert.equal(cards.find((c) => c.key === 'content:n1')?.href, '/daily/n1')
  assert.equal(cards.find((c) => c.key === 'content:d1')?.href, null)
})

test('order is newest first across sources, ties are stable, and the list is capped', async () => {
  const many = Array.from({ length: HOME_CARD_MAX + 10 }, (_, i) =>
    content('news', `n${String(i).padStart(3, '0')}`, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()))
  const { d } = deps({ open: true, videos: [video({ submittedAt: '2026-10-09T00:00:00Z' })], byKind: { news: many } })
  const cards = await getHomeCards('all', d)
  assert.equal(cards.length, HOME_CARD_MAX)
  const times = cards.map((c) => Date.parse(c.publishedAt as string))
  assert.deepEqual(times, [...times].sort((x, y) => y - x))
  assert.equal(cards[0].key, 'competition:app1:application', 'the Oct 9 competition entry is newer than every Oct 1 news row')
})

// ---- structural guards (source level) -----------------------------------------------
// Weaker than a behaviour test, but these two facts have no runtime seam: the root
// page is a Next server component, and "no third rule" is about what the file is
// allowed to import at all.
import { readFileSync } from 'node:fs'

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')

test('★lib/home-feed.ts opens no database of its own -- it only calls the two doors', () => {
  const src = stripComments(readFileSync('lib/home-feed.ts', 'utf8'))
  for (const bad of ['supabase', '.from(', 'createClient', 'fetch(']) assert.ok(!src.includes(bad), `home-feed must not use ${bad}`)
  assert.ok(src.includes('listPublicContents') && src.includes('getWatchVideos') && src.includes('isCompetitionWatchPublic'))
})

test('★the root page does not AND the competition gate any more, and never judges publicness itself', () => {
  const src = stripComments(readFileSync('app/page.tsx', 'utf8'))
  assert.ok(!src.includes('isCompetitionWatchPublic'), 'a closed competition would hide the open contents sections')
  assert.ok(!src.includes('isCompetitionPublicationEnabled'))
  assert.ok(src.includes('isNewSiteOpen()'), 'the watch_as_home switch still decides')
  assert.ok(src.includes('<LandingView />'), 'switch off -> the landing')
  assert.ok(!/\.from\(|createSupabase/.test(src), 'the page reads through lib/home-feed only')
})

// ---- thumbnails and hover text on cards ---------------------------------------------

test('thumbnails: a content item shows the thumbnail the list door gave it; none -> null (gradient frame)', async () => {
  const withThumb = content('news', 'n1', undefined, { thumbnail_url: 'https://cdn.example/t.jpg' })
  const without = content('news', 'n2', undefined, { thumbnail_url: null })
  const absent = content('news', 'n3')
  const { d } = deps({ byKind: { news: [withThumb, without, absent] } })
  const cards = await getHomeCards('news', d)
  assert.equal(cards.find((c) => c.key === 'content:n1')?.thumbnailUrl, 'https://cdn.example/t.jpg')
  assert.equal(cards.find((c) => c.key === 'content:n2')?.thumbnailUrl, null)
  assert.equal(cards.find((c) => c.key === 'content:n3')?.thumbnailUrl, null)
})

test('★thumbnails: an address that is not https never reaches a card (content or competition)', async () => {
  for (const bad of ['http://cdn.example/t.jpg', 'javascript:alert(1)', '/t.jpg', '   ', 'data:image/png;base64,AAAA']) {
    const { d } = deps({ open: true, videos: [video({ thumbnailUrl: bad })], byKind: { news: [content('news', 'n1', undefined, { thumbnail_url: bad })] } })
    const cards = await getHomeCards('all', d)
    assert.equal(cards.length, 2, bad)
    for (const c of cards) assert.equal(c.thumbnailUrl, null, bad)
  }
})

test('★thumbnails: the feed asks the list door for thumbnails and nothing else about assets', () => {
  const src = readFileSync('lib/home-feed.ts', 'utf8')
  assert.ok(/withThumbnails: true/.test(src))
  assert.ok(!/content_assets|main_16x9|main_9x16|PUBLIC_ASSET_ROLES|videoUrl/.test(stripComments(src)), 'no other asset is read here')
})

test('hover text: summary is the description clipped to 200 chars; none when there is no description', async () => {
  const long = 'x'.repeat(500)
  const { d } = deps({ byKind: { news: [content('news', 'n1', undefined, { description: long }), content('news', 'n2', undefined, { description: null }), content('news', 'n3', undefined, { description: '  ' })] } })
  const cards = await getHomeCards('news', d)
  const by = (k: string) => cards.find((c) => c.key === 'content:' + k)!
  assert.equal(by('n1').summary?.length, 201)
  assert.ok(by('n1').summary?.endsWith('…'))
  assert.equal(by('n2').summary, null)
  assert.equal(by('n3').summary, null)
})

test('★the home Featured row is the carousel (small screens scroll and snap); the section pages are not', () => {
  const home = stripComments(readFileSync('app/page.tsx', 'utf8'))
  assert.ok(/<CardGrid cards=\{cards\} t=\{data\.t\} carousel \/>/.test(home), 'Featured passes carousel')
  const section = stripComments(readFileSync('app/_site/SectionPage.tsx', 'utf8'))
  assert.ok(!/carousel/.test(section), 'section lists keep the grid')
})
