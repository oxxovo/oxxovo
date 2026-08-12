'use client'

// Text/caption track for the compose timeline: every text layer's show window as
// a draggable bar on the SAME horizontal time axis as the timeline ruler.
//
// ★ CONTROLLED + SELF-CONTAINED. The layers, the selection and the undo history
// all stay in ProComposeEditor; this component holds nothing but the transient
// drag. It is mounted INSIDE the timeline's `width: trackW` scroller, so zoom and
// horizontal scroll are inherited -- it never reads scroll state. That keeps the
// editor's own contact surface to an import plus a mount, which matters because
// the Pro Editor epic reworks the timeline later and would otherwise collide.
//
// ★ TIME AXIS, NOT CLIP PIXELS. Bars and snap guides are positioned from ms via
// pxPerSec -- the same mapping the ruler uses and the same one the render uses.
// The clip strip above is NOT on that axis (it adds a 4px flex gap between clips
// and clamps short clips to a 20px minimum), so a bar can look misaligned with a
// clip edge. That misalignment is honest: the render follows the time axis. Do
// not "fix" it by reading clip pixel positions.

import { useRef, useState } from 'react'
import type { TextLayer } from '@/lib/text-render'
// Lane packing lives in lib/ so it can be tested without React -- overlapping
// windows sharing a lane makes a caption invisible, which is the one failure
// here that reports nothing. See lib/text-track-lanes.ts.
import { assignLanes, laneCount } from '@/lib/text-track-lanes'

export type TextTrackLabels = {
  title: string
  none: string
  hint: string
  move: string
  trimStart: string
  trimEnd: string
}

// Shortest window the bar drag may produce. Matches the editor's own start/end
// sliders, which clamp with the same 100ms so the two controls cannot disagree.
const MIN_WINDOW_MS = 100
// Snap tolerance in SCREEN px, so it feels the same at every zoom level. Sized to
// a pointer's practical precision, not to any timing value.
const SNAP_PX = 6

const LANE_H = 20
const LANE_GAP = 3
// Lanes past this scroll rather than growing the pane; the timeline section is
// height-constrained on desktop and would otherwise push its own hint out.
const LANES_VISIBLE = 4

type Drag = {
  index: number
  mode: 'move' | 'start' | 'end'
  originX: number
  startMs: number
  endMs: number
}

export function TextTrack({
  texts,
  totalMs,
  pxPerSec,
  selectedIndex,
  playheadMs,
  boundariesMs,
  labels,
  onSelect,
  onWindow,
}: {
  texts: TextLayer[]
  totalMs: number
  pxPerSec: number
  selectedIndex: number | null
  playheadMs: number
  /** Clip boundaries as composition TIME (ms). Never clip pixel offsets. */
  boundariesMs: number[]
  labels: TextTrackLabels
  onSelect: (i: number) => void
  onWindow: (i: number, patch: { startMs: number; endMs: number }, coalesceKey: string) => void
}) {
  const drag = useRef<Drag | null>(null)
  const [snapped, setSnapped] = useState<number | null>(null) // boundary ms currently snapped to

  const msToPx = (ms: number) => (ms / 1000) * pxPerSec
  // boundariesMs holds each clip's START, so the composition END is missing --
  // and that is the edge a caption most often wants to land on.
  const guides = totalMs > 0 ? [...boundariesMs, totalMs] : boundariesMs
  const lanes = assignLanes(texts)
  const nLanes = laneCount(lanes)
  const trackH = nLanes * LANE_H + (nLanes - 1) * LANE_GAP

  // Pull an edge to the nearest clip boundary when it is within SNAP_PX on screen.
  // Returns the snapped ms and records which boundary, so the guide can light up.
  const snap = (ms: number): number => {
    let best: number | null = null
    let bestPx = SNAP_PX
    for (const b of guides) {
      const d = Math.abs(msToPx(ms) - msToPx(b))
      if (d <= bestPx) { bestPx = d; best = b }
    }
    setSnapped(best)
    return best ?? ms
  }

  const onDown = (e: React.PointerEvent, index: number, mode: Drag['mode']) => {
    e.stopPropagation()
    const l = texts[index]
    drag.current = { index, mode, originX: e.clientX, startMs: l.startMs, endMs: l.endMs }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    onSelect(index)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dMs = ((e.clientX - d.originX) / pxPerSec) * 1000
    const span = d.endMs - d.startMs

    if (d.mode === 'move') {
      const shifted = Math.max(0, Math.min(totalMs - span, d.startMs + dMs))
      const s = Math.max(0, Math.min(totalMs - span, snap(shifted)))
      onWindow(d.index, { startMs: Math.round(s), endMs: Math.round(s + span) }, 'text-move')
      return
    }
    if (d.mode === 'start') {
      const s = Math.max(0, Math.min(d.endMs - MIN_WINDOW_MS, snap(d.startMs + dMs)))
      onWindow(d.index, { startMs: Math.round(s), endMs: d.endMs }, 'text-start')
      return
    }
    const en = Math.min(totalMs, Math.max(d.startMs + MIN_WINDOW_MS, snap(d.endMs + dMs)))
    onWindow(d.index, { startMs: d.startMs, endMs: Math.round(en) }, 'text-end')
  }

  const onUp = () => {
    drag.current = null
    setSnapped(null)
  }

  return (
    <div className="mt-2 border-t border-white/8 pt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">{labels.title}</span>
        {texts.length > 0 && <span className="text-[9px] text-white/25">{labels.hint}</span>}
      </div>

      {texts.length === 0 ? (
        <p className="py-2 text-[10px] text-white/25">{labels.none}</p>
      ) : (
        <div
          className="relative overflow-y-auto"
          style={{ height: Math.min(trackH, LANES_VISIBLE * LANE_H + (LANES_VISIBLE - 1) * LANE_GAP) }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}>
          <div className="relative" style={{ height: trackH }}>
            {/* clip boundaries, drawn from TIME -- see the header note */}
            {guides.map((b, k) => (
              <span key={`b${k}`} aria-hidden
                className={`pointer-events-none absolute top-0 w-px ${snapped === b ? 'bg-[#b66cff]' : 'bg-white/8'}`}
                style={{ left: msToPx(b), height: trackH }} />
            ))}
            <span aria-hidden className="pointer-events-none absolute top-0 w-px bg-[#ff8888]/70"
              style={{ left: msToPx(playheadMs), height: trackH }} />

            {texts.map((l, i) => {
              const span = Math.max(0, l.endMs - l.startMs)
              const fin = Math.min(l.fadeInMs ?? 0, span)
              const fout = Math.min(l.fadeOutMs ?? 0, span - fin)
              const on = i === selectedIndex
              return (
                <div key={i} onPointerDown={(e) => onDown(e, i, 'move')} title={labels.move}
                  style={{ left: msToPx(l.startMs), width: Math.max(8, msToPx(span)), top: lanes[i] * (LANE_H + LANE_GAP), height: LANE_H }}
                  className={`group absolute flex cursor-grab items-center overflow-hidden rounded border text-[9px] transition ${
                    on ? 'border-[#b66cff] bg-[#8b22ff]/30 text-[#efe0ff]' : 'border-[#8b22ff]/30 bg-[#8b22ff]/12 text-white/60 hover:border-[#8b22ff]/70'
                  }`}>
                  {/* fade ramps, proportional to the window -- the same ms the
                      renderer fades over, so the bar reads like the result */}
                  {fin > 0 && <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-full bg-gradient-to-r from-black/45 to-transparent" style={{ width: msToPx(fin) }} />}
                  {fout > 0 && <span aria-hidden className="pointer-events-none absolute right-0 top-0 h-full bg-gradient-to-l from-black/45 to-transparent" style={{ width: msToPx(fout) }} />}

                  <span onPointerDown={(e) => onDown(e, i, 'start')} title={labels.trimStart}
                    className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize rounded-l bg-[#8b22ff]/60 opacity-0 transition group-hover:opacity-100" />
                  <span className="pointer-events-none truncate px-2">{l.content.split('\n')[0] || ' '}</span>
                  <span onPointerDown={(e) => onDown(e, i, 'end')} title={labels.trimEnd}
                    className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize rounded-r bg-[#8b22ff]/60 opacity-0 transition group-hover:opacity-100" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
