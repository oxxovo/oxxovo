'use client'

// Pluggable sequence-preview engine. The editor talks to this interface only, so
// the WYSIWYG WebGL engine (phase D) drops in without touching the editor.
//
// C ships createRawPreview: plain sequential <video> playback of the clips in
// order + trim. It applies NO effects, so `approximate` is true the moment the
// EDL carries any effect -- the editor then shows an honest "preview is
// approximate; the final is produced on render" note. It NEVER presents an
// effectless preview as the exact graded result (TK rule). With no effects set
// (C's user path today) the raw preview IS accurate.
//
// D will add createGLPreview() (kind: 'gl', approximate: false) that mirrors the
// render's deterministic filter contract (render is authoritative, preview
// follows). The editor picks the best available engine; the seam is this file.

import type { EffectParams } from '@/lib/effects'

export type PreviewClip = { id: string; url: string }
export type PreviewSegment = {
  uid: string
  jobId: string
  startMs: number
  endMs: number
  speed?: number
  effects?: EffectParams
}
export type PreviewTransition = { afterIndex: number; type: string; durationMs: number }

export interface PreviewEngine {
  readonly kind: 'raw' | 'gl'
  // true if this engine does NOT reproduce the exact final (e.g. effects unshown).
  approximate(hasEffects: boolean): boolean
  mount(video: HTMLVideoElement): void
  play(segments: PreviewSegment[], clips: Map<string, PreviewClip>, global?: EffectParams, transitions?: PreviewTransition[]): void
  // Update composition refs in place WITHOUT restarting playback (live slider edits).
  update?(segments: PreviewSegment[], clips: Map<string, PreviewClip>, global?: EffectParams, transitions?: PreviewTransition[]): void
  pause(): void
  // paused single-segment preview (on select): show the segment's first frame.
  showFrame(seg: PreviewSegment, clips: Map<string, PreviewClip>, global?: EffectParams): void
  destroy(): void
}

export function createRawPreview(opts: { onPlayingChange?: (playing: boolean) => void } = {}): PreviewEngine {
  let video: HTMLVideoElement | null = null
  let segs: PreviewSegment[] = []
  let clipMap: Map<string, PreviewClip> = new Map()
  let idx = 0
  let playing = false

  const setPlaying = (p: boolean) => { playing = p; opts.onPlayingChange?.(p) }

  const playAt = async (i: number) => {
    if (!video || i >= segs.length) { setPlaying(false); return }
    idx = i
    const seg = segs[i]
    const clip = clipMap.get(seg.jobId)
    if (!clip) { setPlaying(false); return }
    if (video.src !== clip.url) video.src = clip.url
    try {
      video.currentTime = seg.startMs / 1000
      await video.play()
    } catch { setPlaying(false) }
  }

  const onTimeUpdate = () => {
    if (!video || !playing) return
    const seg = segs[idx]
    if (seg && video.currentTime >= seg.endMs / 1000) void playAt(idx + 1)
  }
  const onEnded = () => setPlaying(false)

  return {
    kind: 'raw',
    approximate: (hasEffects: boolean) => hasEffects, // raw shows no effects
    mount(v) {
      video = v
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', onEnded)
    },
    play(segments, clips) {
      segs = segments
      clipMap = clips
      if (!segments.length) return
      setPlaying(true)
      void playAt(0)
    },
    update(segments, clips) { segs = segments; clipMap = clips },
    pause() { setPlaying(false); video?.pause() },
    showFrame(seg, clips) {
      if (playing || !video) return
      const clip = clips.get(seg.jobId)
      if (!clip) return
      if (video.src !== clip.url) video.src = clip.url
      const seek = () => { try { video!.currentTime = seg.startMs / 1000 } catch { /* not ready */ } }
      if (video.readyState >= 1) seek()
      else video.addEventListener('loadedmetadata', seek, { once: true })
    },
    destroy() {
      video?.removeEventListener('timeupdate', onTimeUpdate)
      video?.removeEventListener('ended', onEnded)
      video?.pause()
      video = null
    },
  }
}
