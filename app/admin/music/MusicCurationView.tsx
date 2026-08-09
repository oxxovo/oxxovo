'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { setMusicActiveAction } from './actions'
import type { CurationFilter, CurationPage } from '@/lib/music-curation'

// Copy lives here, like app/admin/actors/ActorsView.tsx: the only string this
// feature adds to lib/admin-i18n.ts is the nav entry.

const DICT = {
  en: {
    title: 'Music library',
    subtitle:
      'Curation: which library tracks participants may choose from. `active` is the participant-facing switch — turning it off removes the track from every picker immediately.',
    waiting: 'Waiting on two things, and neither is this screen:',
    waitLoad: 'the track load itself (stage 1 — 1,000 tracks, worker `seed:music:batch`)',
    waitScore: 'machine review [2.5], which supplies the score this list will be ordered by',
    noneYet: 'The library is empty, so there is nothing to curate yet.',
    noneMatch: 'No tracks match this filter.',
    orderNote: 'Ordered by title. Once [2.5] lands, the highest-scoring tracks come first and this note goes away.',
    target: (a: number) => `${a.toLocaleString()} active`,
    ofTarget: (a: number, t: number) => `${a.toLocaleString()} of ${t.toLocaleString()} target`,
    library: 'in library',
    withheld: 'withheld',
    unsigned: 'unsigned',
    unsignedNote:
      'An unsigned track can never be offered, whatever `active` says — the picker requires a v1m signature. Re-run the loader for these.',
    filters: { all: 'All', active: 'Active', withheld: 'Withheld' } as Record<CurationFilter, string>,
    search: 'Search title',
    searchGo: 'Search',
    clear: 'Clear',
    colTitle: 'Title',
    colMood: 'mood',
    colLen: 'Length',
    colLicense: 'Licence',
    colProvider: 'Provider',
    colState: 'State',
    colAction: '',
    activate: 'Activate',
    withhold: 'Withhold',
    selected: (n: number) => `${n} selected`,
    activateSel: 'Activate selected',
    withholdSel: 'Withhold selected',
    selectAll: 'Select all on this page',
    clearSel: 'Clear selection',
    page: (p: number, n: number) => `Page ${p} of ${n}`,
    prev: '← Previous',
    next: 'Next →',
    notReady: (s: string) => `not ready (${s})`,
    noSig: 'NO SIGNATURE',
    preview: 'Preview',
    errPartial: 'Some rows did not change',
    errForbidden: 'Not signed in as an admin',
    errFailed: 'The update failed',
  },
  ko: {
    title: '음악 라이브러리',
    subtitle:
      '큐레이션 — 참가자가 고를 수 있는 라이브러리 곡을 정합니다. `active`가 참가자에게 보이는 스위치이고, 끄면 즉시 모든 피커에서 사라집니다.',
    waiting: '두 가지를 기다리는 중이고, 둘 다 이 화면이 아닙니다:',
    waitLoad: '곡 적재 자체 (1단계 — 1,000곡, 워커 `seed:music:batch`)',
    waitScore: '기계 심사 [2.5] — 이 목록의 정렬 기준이 될 점수를 공급합니다',
    noneYet: '라이브러리가 비어 있어 큐레이션할 대상이 없습니다.',
    noneMatch: '이 조건에 맞는 곡이 없습니다.',
    orderNote: '제목순 정렬입니다. [2.5]가 들어오면 점수 높은 곡이 먼저 오고 이 안내는 사라집니다.',
    target: (a: number) => `활성 ${a.toLocaleString()}곡`,
    ofTarget: (a: number, t: number) => `목표 ${t.toLocaleString()}곡 중 ${a.toLocaleString()}곡`,
    library: '라이브러리',
    withheld: '보류',
    unsigned: '서명 없음',
    unsignedNote:
      '서명이 없는 곡은 `active`와 무관하게 절대 노출되지 않습니다 — 피커가 v1m 서명을 요구합니다. 해당 곡은 적재를 다시 돌리세요.',
    filters: { all: '전체', active: '활성', withheld: '보류' } as Record<CurationFilter, string>,
    search: '제목 검색',
    searchGo: '검색',
    clear: '초기화',
    colTitle: '제목',
    colMood: 'mood',
    colLen: '길이',
    colLicense: '라이선스',
    colProvider: '출처',
    colState: '상태',
    colAction: '',
    activate: '활성화',
    withhold: '보류',
    selected: (n: number) => `${n}곡 선택`,
    activateSel: '선택 활성화',
    withholdSel: '선택 보류',
    selectAll: '이 페이지 전체 선택',
    clearSel: '선택 해제',
    page: (p: number, n: number) => `${n}페이지 중 ${p}페이지`,
    prev: '← 이전',
    next: '다음 →',
    notReady: (s: string) => `준비 안 됨 (${s})`,
    noSig: '서명 없음',
    preview: '미리듣기',
    errPartial: '일부 곡이 변경되지 않았습니다',
    errForbidden: '관리자로 로그인되어 있지 않습니다',
    errFailed: '변경에 실패했습니다',
  },
} as const

const FILTERS: CurationFilter[] = ['all', 'active', 'withheld']
const TARGET = 1000

function fmtLen(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function MusicCurationView({
  data,
  filter,
  q,
}: {
  data: CurationPage
  filter: CurationFilter
  q: string
}) {
  const lang = useAdminLang()
  const t = DICT[lang === 'ko' ? 'ko' : 'en']
  const router = useRouter()
  const [pending, start] = useTransition()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)

  const pageIds = useMemo(() => data.tracks.map((x) => x.id), [data.tracks])
  const selectedOnPage = pageIds.filter((id) => sel.has(id))

  function href(next: { page?: number; filter?: CurationFilter; q?: string }) {
    const p = new URLSearchParams()
    const f = next.filter ?? filter
    const query = next.q ?? q
    if (f !== 'all') p.set('filter', f)
    if (query) p.set('q', query)
    const pg = next.page ?? 1
    if (pg > 1) p.set('page', String(pg))
    const s = p.toString()
    return `/admin/music${s ? `?${s}` : ''}`
  }

  function apply(ids: string[], active: boolean) {
    if (!ids.length) return
    setErr(null)
    start(async () => {
      const res = await setMusicActiveAction(ids, active)
      if (!res.ok) {
        setErr(
          res.error === 'forbidden' ? t.errForbidden : res.error === 'partial' ? `${t.errPartial} (${res.detail})` : t.errFailed,
        )
      }
      // Refresh either way: a partial result changed some rows.
      setSel(new Set())
      router.refresh()
    })
  }

  function toggleOne(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const empty = data.libraryTotal === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/50">{t.subtitle}</p>
      </div>

      {/* Catalogue-wide counts. These do NOT move with the filter -- a target you
          cannot count against is not a target. */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xl font-bold text-emerald-300">{data.activeTotal.toLocaleString()}</p>
          <p className="text-[11px] text-white/50">{t.ofTarget(data.activeTotal, TARGET)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xl font-bold text-white">{data.libraryTotal.toLocaleString()}</p>
          <p className="text-[11px] text-white/50">{t.library}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xl font-bold text-amber-300">{data.withheldTotal.toLocaleString()}</p>
          <p className="text-[11px] text-white/50">{t.withheld}</p>
        </div>
        {data.unsignedTotal > 0 && (
          <div className="rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 px-4 py-3">
            <p className="text-xl font-bold text-[#ff8888]">{data.unsignedTotal.toLocaleString()}</p>
            <p className="text-[11px] text-white/50">{t.unsigned}</p>
          </div>
        )}
      </div>

      {data.unsignedTotal > 0 && (
        <p className="rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/5 px-4 py-3 text-xs text-[#ffaaaa]">
          {t.unsignedNote}
        </p>
      )}

      {empty ? (
        // ★The honest empty state. This screen is step [3] and its inputs are not here.
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-6">
          <p className="text-sm text-white/70">{t.noneYet}</p>
          <p className="mt-3 text-xs text-white/50">{t.waiting}</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-white/40">
            <li>{t.waitLoad}</li>
            <li>{t.waitScore}</li>
          </ul>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={href({ filter: f, page: 1 })}
                className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                  f === filter ? 'bg-[#b66cff] text-black' : 'border border-white/15 text-white/60 hover:border-white/35'
                }`}
              >
                {t.filters[f]}
              </Link>
            ))}
            <form action="/admin/music" method="get" className="ml-auto flex gap-2">
              {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder={t.search}
                className="rounded border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#b66cff] focus:outline-none"
              />
              <button type="submit" className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/35">
                {t.searchGo}
              </button>
              {q && (
                <Link
                  href={href({ q: '', page: 1 })}
                  className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/50 hover:border-white/35"
                >
                  {t.clear}
                </Link>
              )}
            </form>
          </div>

          <p className="text-[11px] text-white/35">{t.orderNote}</p>

          {/* Bulk bar. 1,000 tracks one at a time is the reason this exists. */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <button
              type="button"
              onClick={() => setSel(new Set(pageIds))}
              className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-white/60 hover:border-white/35"
            >
              {t.selectAll}
            </button>
            {selectedOnPage.length > 0 && (
              <>
                <span className="text-[11px] text-white/50">{t.selected(selectedOnPage.length)}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply(selectedOnPage, true)}
                  className="rounded bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {t.activateSel}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply(selectedOnPage, false)}
                  className="rounded bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {t.withholdSel}
                </button>
                <button
                  type="button"
                  onClick={() => setSel(new Set())}
                  className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-white/50 hover:border-white/35"
                >
                  {t.clearSel}
                </button>
              </>
            )}
          </div>

          {err && (
            <p className="rounded border border-[#ff4444]/40 bg-[#ff4444]/10 px-3 py-2 text-xs text-[#ffaaaa]">{err}</p>
          )}

          {data.tracks.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/60">
              {t.noneMatch}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                    <th className="w-8 py-2 pl-3" />
                    <th className="py-2 pr-3">{t.colTitle}</th>
                    <th className="py-2 pr-3">{t.colLen}</th>
                    <th className="py-2 pr-3">{t.colLicense}</th>
                    <th className="py-2 pr-3">{t.colProvider}</th>
                    <th className="py-2 pr-3">{t.colState}</th>
                    <th className="py-2 pr-3">{t.preview}</th>
                    <th className="py-2 pr-3">{t.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tracks.map((track) => (
                    <tr key={track.id} className="border-b border-white/5 align-middle">
                      <td className="py-2 pl-3">
                        <input
                          type="checkbox"
                          checked={sel.has(track.id)}
                          onChange={() => toggleOne(track.id)}
                          className="h-3.5 w-3.5 accent-[#b66cff]"
                          aria-label={track.title ?? track.id}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-xs font-bold text-white">{track.title || track.id}</p>
                        {track.mood && (
                          <p className="text-[10px] text-white/35">
                            {t.colMood}: {track.mood}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-[11px] whitespace-nowrap text-white/60">{fmtLen(track.durationSeconds)}</td>
                      <td className="py-2 pr-3 text-[11px] whitespace-nowrap text-white/60">{track.licenseType ?? '—'}</td>
                      <td className="py-2 pr-3 text-[11px] whitespace-nowrap text-white/60">{track.provider ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {track.active ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              {t.filters.active}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              {t.filters.withheld}
                            </span>
                          )}
                          {track.status !== 'ready' && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                              {t.notReady(track.status)}
                            </span>
                          )}
                          {!track.signed && (
                            <span className="rounded bg-[#ff4444]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8888]">
                              {t.noSig}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {/* preload="none": a page of 100 must not fetch 100 files. */}
                        {track.url ? (
                          <audio controls preload="none" src={track.url} className="h-7 w-40" />
                        ) : (
                          <span className="text-[11px] text-white/30">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => apply([track.id], !track.active)}
                          className={`rounded px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                            track.active
                              ? 'border border-white/20 text-white/70 hover:border-white/40'
                              : 'bg-emerald-500/90 text-black hover:bg-emerald-400'
                          }`}
                        >
                          {track.active ? t.withhold : t.activate}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-white/50">
            <span>{t.page(data.page, data.pageCount)}</span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Link href={href({ page: data.page - 1 })} className="rounded border border-white/15 px-2.5 py-1 hover:border-white/35">
                  {t.prev}
                </Link>
              )}
              {data.page < data.pageCount && (
                <Link href={href({ page: data.page + 1 })} className="rounded border border-white/15 px-2.5 py-1 hover:border-white/35">
                  {t.next}
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
