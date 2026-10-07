// Public list of one content section: oxxovo.ai/<slug>. The first segment is a
// configured slug (platform_config content_path_<kind>), never a hard-coded
// word; every reason it cannot be shown -- unknown slug, no slug configured,
// the DBA's publication switch closed -- is the same notFound() (design SS7).
//
// force-dynamic: slugs and switches change without a redeploy, and a page baked
// at build time would keep a closed surface open.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPublicContentsBySection } from '@/lib/content-public'
import { contentUrl } from '@/lib/content-paths'
import { PUBLIC_TEXT } from '@/lib/content-public-text'

export const dynamic = 'force-dynamic'

export default async function ContentSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const found = await listPublicContentsBySection(section)
  if (!found) notFound()

  return (
    <main className="min-h-screen bg-[#0a0608] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {found.items.length === 0 ? (
          <p className="text-white/60">{PUBLIC_TEXT.emptyList}</p>
        ) : (
          <ul className="space-y-6">
            {found.items.map((c) => (
              <li key={c.id}>
                {/* The address is built by contentUrl() only; here the slug is the one already resolved. */}
                <Link
                  href={contentUrl(c.kind, c.id, { [c.kind]: section }) ?? '#'}
                  className="block rounded border border-white/10 p-4 hover:border-[#ff8844]/60 transition"
                >
                  <div className="text-lg font-bold">{c.title}</div>
                  {c.description && <p className="mt-1 text-sm text-white/60 line-clamp-2">{c.description}</p>}
                  <div className="mt-2 text-xs text-white/40">
                    {PUBLIC_TEXT.published} {new Date(c.publish_at).toISOString().slice(0, 10)}
                    {c.ai_generated ? ` · ${PUBLIC_TEXT.aiGenerated}` : ''}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
