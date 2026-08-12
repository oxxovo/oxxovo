'use client'

// Transparent canvas that FILLS the preview aspect box (the output canvas). It
// redraws the text layers at the current composition time (playheadMs) with the
// shared spec (paintTextOverlay -> drawTextLayer), so the preview is WYSIWYG with
// the worker render. Text is normalized to the OUTPUT canvas, so it sits over the
// letterbox bars / cropped frame exactly as the final render does -- aspect and
// fit are irrelevant to text placement. pointer-events-none: clicks fall through
// to the pane (play / text-drag).

import { useEffect, useRef } from 'react'
import type { TextLayer } from '@/lib/text-render'
import { ensureTextFontsLoaded, paintTextOverlay } from './text-preview'

export function TextOverlay({
  texts,
  playheadMs,
  visible,
  editingIndex,
}: {
  texts: TextLayer[]
  playheadMs: number
  visible: boolean
  editingIndex?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fontsReady = useRef(false)

  const draw = useRef<() => void>(() => {})
  draw.current = () => {
    const cv = canvasRef.current
    if (!cv) return
    const box = cv.getBoundingClientRect() // canvas fills the aspect box = output canvas
    const w = Math.max(1, Math.round(box.width))
    const h = Math.max(1, Math.round(box.height))
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
    if (!visible || !fontsReady.current || !texts.length) return
    paintTextOverlay(ctx, w, h, texts, playheadMs, editingIndex)
  }

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

  useEffect(() => {
    draw.current()
  }, [texts, playheadMs, visible, editingIndex])

  // Repaint when the aspect box resizes (aspect switch, layout, window resize).
  useEffect(() => {
    const onResize = () => draw.current()
    window.addEventListener('resize', onResize)
    const cv = canvasRef.current
    let ro: ResizeObserver | null = null
    if (cv && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => draw.current())
      ro.observe(cv)
    }
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}
