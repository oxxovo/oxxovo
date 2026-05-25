'use client'

import { useT } from '@/lib/admin-i18n'

// Auto-detecting embed for applicant videos.
// YouTube / Vimeo / TikTok → iframe. Instagram → external link (Meta oEmbed
// would require an app token; not worth the integration cost). Anything else
// → external link with the raw URL on display.

type Detected =
  | { kind: 'youtube'; embedSrc: string }
  | { kind: 'vimeo'; embedSrc: string }
  | { kind: 'tiktok'; embedSrc: string }
  | { kind: 'instagram'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'empty' }

function detect(url: string | null | undefined): Detected {
  if (!url || typeof url !== 'string' || url.trim() === '') return { kind: 'empty' }
  const trimmed = url.trim()

  // YouTube — watch?v=, youtu.be/, shorts/, embed/
  const ytWatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{6,})/)
  const ytShort = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)
  const ytShorts = trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/)
  const ytEmbed = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/)
  const ytId = ytWatch?.[1] || ytShort?.[1] || ytShorts?.[1] || ytEmbed?.[1]
  if (ytId) {
    return { kind: 'youtube', embedSrc: `https://www.youtube.com/embed/${ytId}` }
  }

  // Vimeo — vimeo.com/{digits} or player.vimeo.com/video/{digits}
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  if (vimeo) {
    return { kind: 'vimeo', embedSrc: `https://player.vimeo.com/video/${vimeo[1]}` }
  }

  // TikTok — tiktok.com/@user/video/{id}
  const tiktok = trimmed.match(/tiktok\.com\/@[^/]+\/video\/(\d{6,})/)
  if (tiktok) {
    return { kind: 'tiktok', embedSrc: `https://www.tiktok.com/embed/v2/${tiktok[1]}` }
  }

  // Instagram reels/posts — embed requires Meta app token, skip
  if (/instagram\.com\/(reel|p|reels|tv)\//i.test(trimmed)) {
    return { kind: 'instagram', href: trimmed }
  }

  return { kind: 'external', href: trimmed }
}

export function VideoEmbed({ url }: { url: string | null | undefined }) {
  const t = useT()
  const detected = detect(url)

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
