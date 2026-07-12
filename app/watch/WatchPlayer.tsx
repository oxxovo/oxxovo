'use client'

import { useState } from 'react'
import { VideoEmbed } from '@/app/_components/VideoEmbed'

// Watch player. Studio output (R2 / self-hosted mp4) plays in a native <video>;
// external entries (YouTube/Vimeo/TikTok/...) go through VideoEmbed, which
// renders an iframe or an external link. Season 0 prelims are external URLs;
// Studio rounds (and Season 1+) are direct files.
function isDirectFile(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)
}

// Aspect-adaptive: aspect ratio is a creator choice (vertical 9:16, square,
// widescreen -- all first-class). We read the real dimensions from the video's
// metadata and match the box to them, so a portrait CF fills its frame instead
// of drowning in 16:9 black bars. max-height keeps a tall video inside the
// viewport (mobile especially); the browser preserves the ratio within
// max-width + max-height, so both orientations sit naturally and centered.
export function WatchPlayer({ url }: { url: string }) {
  const [aspect, setAspect] = useState<string | null>(null)

  if (!isDirectFile(url)) return <VideoEmbed url={url} />

  return (
    <video
      src={url}
      controls
      playsInline
      onLoadedMetadata={(e) => {
        const v = e.currentTarget
        if (v.videoWidth > 0 && v.videoHeight > 0) setAspect(`${v.videoWidth} / ${v.videoHeight}`)
      }}
      className="mx-auto block max-h-[80vh] max-w-full rounded border border-white/10 bg-black"
      // Before metadata loads, hold a 16:9 full-width placeholder (no layout
      // jump for the common case); once known, match the real ratio.
      style={aspect ? { aspectRatio: aspect } : { aspectRatio: '16 / 9', width: '100%' }}
    />
  )
}
