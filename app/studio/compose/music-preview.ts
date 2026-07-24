'use client'

// Preview-side music bed transport. WYSIWYG with the worker's mixMusic: the SAME
// deterministic gain envelope (musicGainAt) the worker bakes with afade+volume is
// applied here as the <audio>.volume per tick. The bed is a STANDALONE element,
// NOT tied to any clip <video>, so it plays continuously across hard-cut src swaps
// (music must not gap at cuts). The composition clock (playheadMs) is the master;
// this controller only follows it (play/seek/pause/tick + a drift guard).

// Structural copy of cryptobind's MusicBed (client-safe; cryptobind pulls node
// crypto so it can't be imported into the browser bundle). Keep in sync.
export type MusicBed = {
  assetId: string
  source: 'library' | 'ai'
  volume: number
  clipVolume: number
  startMs?: number
  endMs?: number
  fadeInMs?: number
  fadeOutMs?: number
}

// Bed gain at composition time tCompMs (0 outside the window). Mirrors the worker
// chain: volume(bed) x fade-in ramp x fade-out ramp, in bed-local time. This is
// the audio analog of textAlphaAt.
export function musicGainAt(m: MusicBed, tCompMs: number): number {
  const start = m.startMs ?? 0
  const end = m.endMs ?? Number.POSITIVE_INFINITY
  if (tCompMs < start || tCompMs > end) return 0
  const local = tCompMs - start
  const dur = end - start
  const fin = m.fadeInMs ?? 0
  const fout = m.fadeOutMs ?? 0
  let g = Math.max(0, Math.min(1, m.volume / 100))
  if (fin > 0 && local < fin) g *= local / fin
  if (fout > 0 && Number.isFinite(dur) && local > dur - fout) g *= Math.max(0, (dur - local) / fout)
  return Math.max(0, g)
}

const DRIFT_MS = 120 // re-sync only past this, so free playback isn't stuttered

export type MusicPreview = ReturnType<typeof createMusicPreview>

export function createMusicPreview() {
  let audio: HTMLAudioElement | null = null
  let bed: MusicBed | null = null
  let url: string | null = null
  let playing = false

  const ensure = (): HTMLAudioElement | null => {
    if (!audio && typeof Audio !== 'undefined') {
      audio = new Audio()
      audio.preload = 'auto'
      audio.crossOrigin = 'anonymous'
      // Attach (hidden) to the DOM: some browsers manage playback/decoding more
      // reliably for attached media, and it makes the bed inspectable for the
      // WebAudio parity capture.
      if (typeof document !== 'undefined') { audio.style.display = 'none'; audio.setAttribute('data-oxxovo-bed', '1'); document.body.appendChild(audio) }
    }
    return audio
  }
  const localSec = (compMs: number) => Math.max(0, (compMs - (bed?.startMs ?? 0)) / 1000)
  const inWindow = (compMs: number) =>
    bed != null && compMs >= (bed.startMs ?? 0) && compMs <= (bed.endMs ?? Number.POSITIVE_INFINITY)

  return {
    // Load / clear the bed. Called when the selected music or its URL changes.
    setBed(nextBed: MusicBed | null, nextUrl: string | null) {
      bed = nextBed
      const a = ensure()
      if (!a) return
      if (nextUrl !== url) {
        url = nextUrl
        if (nextUrl) a.src = nextUrl
        else { a.removeAttribute('src'); a.load() }
      }
      if (!nextBed) a.pause()
    },
    // Transport (user gesture): begin at composition time fromCompMs.
    play(fromCompMs: number) {
      const a = ensure()
      playing = true
      if (!a || !bed || !url) return
      if (inWindow(fromCompMs)) {
        try { a.currentTime = localSec(fromCompMs) } catch { /* not ready */ }
        a.volume = musicGainAt(bed, fromCompMs)
        void a.play().catch(() => {})
      } else {
        a.pause()
      }
    },
    // Scrub / seek to a composition time (respects current transport state).
    seek(compMs: number) {
      const a = audio
      if (!a || !bed) return
      if (inWindow(compMs)) {
        try { a.currentTime = localSec(compMs) } catch { /* not ready */ }
        a.volume = musicGainAt(bed, compMs)
        if (playing) void a.play().catch(() => {})
      } else {
        a.pause()
      }
    },
    // Per-progress-tick follow: enter/exit the window, apply the gain envelope,
    // and re-sync only if drift exceeds DRIFT_MS (src swaps never touch the bed).
    tick(compMs: number) {
      const a = audio
      if (!a || !bed || !playing) return
      if (inWindow(compMs)) {
        const want = localSec(compMs)
        if (a.paused) {
          try { a.currentTime = want } catch { /* not ready */ }
          void a.play().catch(() => {})
        } else if (Math.abs(a.currentTime - want) > DRIFT_MS / 1000) {
          try { a.currentTime = want } catch { /* not ready */ }
        }
        a.volume = musicGainAt(bed, compMs)
      } else if (!a.paused) {
        a.pause()
      }
    },
    pause() { playing = false; audio?.pause() },
    // The bed <audio> element (for WebAudio parity capture / tests).
    element(): HTMLAudioElement | null { return audio },
    destroy() {
      playing = false
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.remove() }
      audio = null
    },
  }
}
