'use client'

// ── Aspect-neutral media boxes (TK 2026-08-22) ──────────────────────────────
// Promoted out of app/watch/Arena.tsx so studio/admin/lobby screens can share
// it -- a hardcoded `aspect-video` (16:9) box + object-cover crops a 9:16
// source down to a thin center strip (confirmed on live /watch: 92/93 promo
// videos are 9:16, the grid box was 16:9). Fixing it to `aspect-[9/16]` would
// just reverse the bug the day a 16:9 season opens, and nothing filters a
// list to one season -- two ratios can sit in the same grid at once.
// Reads the REAL media dimensions (image onLoad/ref, video onLoadedMetadata)
// and sizes the box to match -- no crop needed because the box always equals
// the content's ratio. Works with zero DB migration; `fallback` is only the
// placeholder ratio shown before the media loads (prevents a layout jump).

import { useState } from 'react'

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-4 text-center">
      <span className="text-sm font-black uppercase tracking-wide text-white/85">{label}</span>
    </div>
  )
}

export function AspectThumb({
  url,
  label,
  className = '',
  fallback = '9 / 16',
  children,
}: {
  url: string | null
  label: string
  className?: string
  fallback?: string
  children?: React.ReactNode
}) {
  const [ratio, setRatio] = useState(fallback)
  // If the browser already has `url` cached (repeat view, HMR reload), the
  // image can finish decoding before this onLoad listener attaches -- the
  // event never fires and the box is stuck on `fallback` forever, silently
  // wrong for a real 16:9 asset. Caught by screenshot-testing this against a
  // real cached image before shipping. `ref` callback runs on mount/update,
  // so it catches the already-complete case that onLoad misses; onLoad still
  // covers the normal (not yet cached) load.
  const applyRatio = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setRatio(`${img.naturalWidth} / ${img.naturalHeight}`)
    }
  }
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: ratio }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className="h-full w-full object-cover"
          ref={applyRatio}
          onLoad={(e) => applyRatio(e.currentTarget)}
        />
      ) : (
        <Placeholder label={label} />
      )}
      {children}
    </div>
  )
}

// Video sibling of AspectThumb -- same box-matches-content approach, but for
// <video> preview tiles (studio's own clip gallery, promo review) instead of
// <img> thumbnails. onLoadedMetadata is the video equivalent of img's onLoad;
// the same already-cached/already-loaded race applies (readyState check on
// mount via ref), same fix.
export function AspectVideoThumb({
  url,
  label,
  className = '',
  fallback = '9 / 16',
  fit = 'cover',
  videoProps,
  children,
}: {
  url: string | null
  label: string
  className?: string
  fallback?: string
  // 'cover' crops to fill (grid thumbnails); 'contain' letterboxes (admin
  // review players where the whole frame -- not a crop -- is the point).
  fit?: 'cover' | 'contain'
  videoProps?: React.VideoHTMLAttributes<HTMLVideoElement>
  children?: React.ReactNode
}) {
  const [ratio, setRatio] = useState(fallback)
  const applyRatio = (video: HTMLVideoElement | null) => {
    if (video && video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
      setRatio(`${video.videoWidth} / ${video.videoHeight}`)
    }
  }
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: ratio }}>
      {url ? (
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          {...videoProps}
          className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${videoProps?.className ?? ''}`}
          ref={applyRatio}
          onLoadedMetadata={(e) => applyRatio(e.currentTarget)}
        />
      ) : (
        <Placeholder label={label} />
      )}
      {children}
    </div>
  )
}
