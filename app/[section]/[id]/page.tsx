// Public detail of one content item: oxxovo.ai/<slug>/<id>. Only what
// getPublicContentBySection() returns is rendered: title, description, the
// public video role(s) and the thumbnail. Nothing else exists on the page to leak.
// Every non-public case -- held, hidden, rights not cleared, not yet due, switch
// closed, wrong section, probe- test row -- is the same notFound().
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicContentBySection } from '@/lib/content-public'
import { PUBLIC_TEXT } from '@/lib/content-public-text'

export const dynamic = 'force-dynamic'

export default async function ContentItemPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params
  const found = await getPublicContentBySection(section, id)
  if (!found) notFound()

  const { content, assets } = found.item
  const video = assets.find((a) => a.role === 'main_16x9') ?? assets.find((a) => a.role === 'main_9x16') ?? null
  const poster = assets.find((a) => a.role === 'thumbnail')?.url

  return (
    <main className="min-h-screen bg-[#0a0608] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-5">
        <Link href={`/${section}`} className="text-sm text-white/50 hover:text-white transition">
          ← {PUBLIC_TEXT.back}
        </Link>
        {video ? (
          <video
            src={video.url}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[75vh] rounded bg-black"
          />
        ) : (
          <p className="text-white/50">{PUBLIC_TEXT.videoUnavailable}</p>
        )}
        <h1 className="text-2xl font-black">{content.title}</h1>
        {content.description && <p className="text-white/70 whitespace-pre-line">{content.description}</p>}
        <div className="text-xs text-white/40">
          {PUBLIC_TEXT.published} {new Date(content.publish_at).toISOString().slice(0, 10)}
          {content.ai_generated ? ` · ${PUBLIC_TEXT.aiGenerated}` : ''}
        </div>
      </div>
    </main>
  )
}
