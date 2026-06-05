'use client'

import { useT } from '@/lib/admin-i18n'
import { parseVideoUrl } from '@/lib/video-url'

// Auto-detecting embed for applicant videos.
// YouTube / Vimeo / TikTok → iframe. Instagram → external link (Meta oEmbed
// would require an app token; not worth the integration cost). Anything else
// → external link with the raw URL on display.
// Parsing lives in lib/video-url.ts as the single source of truth.

export function VideoEmbed({ url }: { url: string | null | undefined }) {
  const t = useT()
  const detected = parseVideoUrl(url)

  if (detected.kind === 'empty') {
    return (
      <div className="border border-white/10 rounded p-6 text-center text-sm text-white/40">
        {t.video.no_url}
      </div>
    )
  }

  if (detected.kind === 'instagram' || detected.kind === 'external') {
    return (
      <div className="border border-white/10 rounded p-6 bg-white/[.02]">
        <p className="text-xs text-white/40 mb-2">{t.video.raw_url_label}</p>
        <a
          href={detected.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#ff8844] hover:underline break-all"
        >
          {detected.href}
        </a>
        <div className="mt-4">
          <a
            href={detected.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded border border-[#ff8844]/40 text-[#ff8844] text-xs font-bold uppercase tracking-wider hover:bg-[#ff8844]/10 transition"
          >
            {t.video.open_external}
          </a>
        </div>
      </div>
    )
  }

  // YouTube / Vimeo / TikTok iframe
  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded border border-white/10 bg-black" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={detected.embedSrc}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <a
        href={url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-[10px] text-white/40 hover:text-[#ff8844] transition"
      >
        {t.video.open_external}
      </a>
    </div>
  )
}
