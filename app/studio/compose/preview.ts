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
  // How this clip fills the output aspect box: 'cover' = crop-fill, else letterbox.
  fit?: 'contain' | 'cover'
}

// The clip's fill mode as a CSS object-fit -- the preview surface mirrors the
// worker's letterbox (contain) / center-crop (cover) so framing is WYSIWYG.
export function fitObjectFit(seg: PreviewSegment | undefined): 'contain' | 'cover' {
  return seg?.fit === 'cover' ? 'cover' : 'contain'
}
export type PreviewTransition = { afterIndex: number; type: string; durationMs: number }

export interface PreviewEngine {
  readonly kind: 'raw' | 'gl'
  // true if this engine does NOT reproduce the exact final (e.g. effects unshown).
  approximate(hasEffects: boolean): boolean
  mount(video: HTMLVideoElement): void
  // startCompMs: begin playback at this composition-global offset (default 0).
  play(segments: PreviewSegment[], clips: Map<string, PreviewClip>, global?: EffectParams, transitions?: PreviewTransition[], startCompMs?: number): void
  // Update composition refs in place WITHOUT restarting playback (live slider edits).
  update?(segments: PreviewSegment[], clips: Map<string, PreviewClip>, global?: EffectParams, transitions?: PreviewTransition[]): void
  // Move the playhead to a composition-global time (ms) and repaint that frame.
  // Works while playing (reposition) and while paused (scrub). Never shows black.
  seek(compMs: number, segments: PreviewSegment[], clips: Map<string, PreviewClip>, global?: EffectParams, transitions?: PreviewTransition[]): void
  pause(): void
  // Blank the preview when the timeline is emptied (no stale last frame).
  clear(): void
  // paused single-segment preview (on select): show the segment's first frame.
  showFrame(seg: PreviewSegment, clips: Map<string, PreviewClip>, global?: EffectParams): void
  destroy(): void
}

// Map a composition-global time (ms) to the segment index + absolute video time
// (ms) to seek that clip to. Spans use endMs-startMs (matches the editor's totalMs
// and timeline widths; speed/transition overlap are not subtracted here). Clamps
// past the end to the last segment's out point.
export function locateComposition(segs: PreviewSegment[], compMs: number): { idx: number; videoTimeMs: number } {
  if (!segs.length) return { idx: 0, videoTimeMs: 0 }
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    const span = Math.max(0, segs[i].endMs - segs[i].startMs)
    if (compMs < acc + span) return { idx: i, videoTimeMs: segs[i].startMs + Math.max(0, compMs - acc) }
    acc += span
  }
  const last = segs[segs.length - 1]
  return { idx: segs.length - 1, videoTimeMs: last.endMs }
}

export function createRawPreview(opts: { onPlayingChange?: (playing: boolean) => void; onProgress?: (compMs: number) => void } = {}): PreviewEngine {
  let video: HTMLVideoElement | null = null
  let segs: PreviewSegment[] = []
  let clipMap: Map<string, PreviewClip> = new Map()
  let idx = 0
  let playing = false
  let lastReport = 0

  const setPlaying = (p: boolean) => { playing = p; opts.onPlayingChange?.(p) }
  const compStart = (i: number) => { let a = 0; for (let k = 0; k < i; k++) a += Math.max(0, segs[k].endMs - segs[k].startMs); return a }
  const report = () => {
    if (!video || !opts.onProgress) return
    const seg = segs[idx]; if (!seg) return
    const now = performance.now()
    if (now - lastReport < 50) return // ~20fps; avoids a setState storm per rAF
    lastReport = now
    opts.onProgress(compStart(idx) + Math.max(0, video.currentTime * 1000 - seg.startMs))
  }

  const applyFit = (seg: PreviewSegment | undefined) => { if (video) video.style.objectFit = fitObjectFit(seg) }

  const playAt = async (i: number, startOffsetMs = 0) => {
    if (!video || i >= segs.length) { setPlaying(false); return }
    idx = i
    const seg = segs[i]
    const clip = clipMap.get(seg.jobId)
    if (!clip) { setPlaying(false); return }
    applyFit(seg)
    if (video.src !== clip.url) video.src = clip.url
    try {
      video.currentTime = seg.startMs / 1000 + startOffsetMs / 1000
      await video.play()
    } catch { setPlaying(false) }
  }

  const onTimeUpdate = () => {
    if (!video || !playing) return
    report()
    const seg = segs[idx]
    if (seg && video.currentTime >= seg.endMs / 1000) void playAt(idx + 1)
  }
  const onEnded = () => setPlaying(false)

  return {
    kind: 'raw',
    approximate: (hasEffects: boolean) => hasEffects, // raw shows no effects
    mount(v) {
      video = v
      // Raw playback needs no CORS; clear any crossOrigin left by a prior GL
      // mount so this element reuses the media pool's opaque (no-cors) cache for
      // the bare clip URL instead of forcing a separate CORS fetch.
      v.removeAttribute('crossorigin')
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', onEnded)
    },
    play(segments, clips, _global, _transitions, startCompMs = 0) {
      segs = segments
      clipMap = clips
      if (!segments.length) return
      setPlaying(true)
      const { idx: si, videoTimeMs } = locateComposition(segs, startCompMs)
      void playAt(si, videoTimeMs - segs[si].startMs)
    },
    update(segments, clips) { segs = segments; clipMap = clips },
    seek(compMs, segments, clips) {
      segs = segments; clipMap = clips
      if (!segs.length || !video) return
      const { idx: ni, videoTimeMs } = locateComposition(segs, compMs)
      idx = ni
      const clip = clipMap.get(segs[ni].jobId)
      if (!clip) return
      applyFit(segs[ni])
      if (video.src !== clip.url) video.src = clip.url
      const target = videoTimeMs / 1000
      const doSeek = () => { if (!video) return; try { video.currentTime = target } catch { /* not ready */ } if (playing) video.play().catch(() => {}) }
      if (video.readyState >= 1) doSeek()
      else video.addEventListener('loadedmetadata', doSeek, { once: true })
    },
    pause() { setPlaying(false); video?.pause() },
    clear() { setPlaying(false); video?.pause() },
    showFrame(seg, clips) {
      if (playing || !video) return
      const clip = clips.get(seg.jobId)
      if (!clip) return
      applyFit(seg)
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
