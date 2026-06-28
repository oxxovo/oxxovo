'use client'

import { VideoEmbed } from '@/app/_components/VideoEmbed'

// Watch player. Studio output (R2 / self-hosted mp4) plays in a native <video>;
// external entries (YouTube/Vimeo/TikTok/...) go through VideoEmbed, which
// renders an iframe or an external link. Season 0 prelims are external URLs;
// Studio rounds (and Season 1+) are direct files.
function isDirectFile(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)
}

export function WatchPlayer({ url }: { url: string }) {
  if (isDirectFile(url)) {
    return (
      <video
        src={url}
        controls
        playsInline
        className="w-full rounded border border-white/10 bg-black"
        style={{ aspectRatio: '16 / 9' }}
      />
    )
  }
  return <VideoEmbed url={url} />
}
