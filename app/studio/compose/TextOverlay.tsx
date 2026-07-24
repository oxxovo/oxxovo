'use client'

// Transparent canvas overlaid EXACTLY on the preview <video>'s displayed box.
// Redraws the text layers at the current composition time (playheadMs) with the
// shared spec (paintTextOverlay -> drawTextLayer) so the preview is WYSIWYG with
// the worker render. pointer-events-none: clicks fall through to play/pause.
//
// The canvas FILLS the preview container (which is position:relative); each paint
// measures the <video>'s box within that container and translates the drawing so
// text lands on the actual (letterboxed) video pixels, at devicePixelRatio.

import { useEffect, useRef } from 'react'
import type { TextLayer } from '@/lib/text-render'
import { ensureTextFontsLoaded, paintTextOverlay } from './text-preview'

export function TextOverlay({
  videoRef,
  texts,
  playheadMs,
  visible,
  editingIndex,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  texts: TextLayer[]
  playheadMs: number
  visible: boolean
  editingIndex?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fontsReady = useRef(false)

  // Latest-state draw closure in a ref so ResizeObserver / rAF always paint the
  // current texts+playhead without re-subscribing.
  const draw = useRef<() => void>(() => {})
  draw.current = () => {
    const cv = canvasRef.current
    const video = videoRef.current
    if (!cv) return
    const parentBox = cv.getBoundingClientRect() // canvas fills the container
    const w = Math.max(1, Math.round(parentBox.width))
    const h = Math.max(1, Math.round(parentBox.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pxW = Math.round(w * dpr)
    const pxH = Math.round(h * dpr)
    if (cv.width !== pxW || cv.height !== pxH) {
      cv.width = pxW
      cv.height = pxH
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (!visible || !fontsReady.current || !video || !texts.length) return
    const vr = video.getBoundingClientRect()
    if (vr.width < 2 || vr.height < 2) return // video not laid out yet
    // Offset into the (letterboxed) video box within the container, then draw with
    // the video's displayed size so normalized coords map to real video pixels.
    ctx.translate(vr.left - parentBox.left, vr.top - parentBox.top)
    paintTextOverlay(ctx, vr.width, vr.height, texts, playheadMs, editingIndex)
  }

  // Load fonts once; repaint when ready.
  useEffect(() => {
    let alive = true
    void ensureTextFontsLoaded().then(() => {
      if (!alive) return
      fontsReady.current = true
      draw.current()
    })
    return () => {
      alive = false
    }
  }, [])

  // Repaint on any state change that affects the frame.
  useEffect(() => {
    draw.current()
  }, [texts, playheadMs, visible, editingIndex])

  // Keep the overlay aligned when the video box resizes (metadata load, window /
  // layout changes, aspect changes between clips).
  useEffect(() => {
    const onResize = () => draw.current()
    window.addEventListener('resize', onResize)
    const video = videoRef.current
    let ro: ResizeObserver | null = null
    if (video && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => draw.current())
      ro.observe(video)
    }
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [videoRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
