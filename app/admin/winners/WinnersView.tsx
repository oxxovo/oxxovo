'use client'

import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { GRADE_BADGE_CLASS, GRADE_LABEL_KO, GRADE_LABEL_EN, type Grade } from '@/lib/grades'

export type WinnerCard = {
  id: string
  seasonId: string
  seasonLabel: string
  seasonNumber: number
  creatorName: string | null
  videoTitle: string | null
  thumbnailUrl: string | null
  videoUrl: string | null
  awardRank: number
  verifiedScore: number | null
  grade: Grade | null
}

type SeasonOption = { id: string; name: string; season_number: number; display_name?: string | null }

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const DICT = {
  ko: {
    title: '수상자 관리',
    subtitle: '시즌별 입상자와 작품 — 읽기 전용입니다. 순위 수정/취소는 지원자 관리(Applications) 화면에서만 합니다.',
    f_season: '시즌',
    all: '전체 시즌',
    empty: '아직 수상자가 없습니다.',
    grade_pending: '채점 대기',
    no_video: '영상 없음',
    watch: '영상 보기 →',
  },
  en: {
    title: 'Winners',
    subtitle: 'Winners and their films across seasons — read only. Rank changes/overrides happen only in Applications.',
    f_season: 'Season',
    all: 'All seasons',
    empty: 'No winners yet.',
    grade_pending: 'Scoring pending',
    no_video: 'No video',
    watch: 'Watch video →',
  },
}

export function WinnersView({
  seasons,
  selectedSeasonScope,
  winners,
}: {
  seasons: SeasonOption[]
  selectedSeasonScope: string
  winners: WinnerCard[]
}) {
  const lang = useAdminLang()
  const t = DICT[lang]
  const router = useRouter()
  const gradeLabel = lang === 'ko' ? GRADE_LABEL_KO : GRADE_LABEL_EN

  const handleSeasonChange = (newScope: string) => {
    const params = new URLSearchParams()
    if (newScope !== 'all') params.set('season', newScope)
    const qs = params.toString()
    router.push(`/admin/winners${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-3xl font-black">{t.title}</h1>
        <p className="mt-1 text-sm text-white/50 max-w-2xl">{t.subtitle}</p>
      </header>

      <div className="mb-8 max-w-xs">
        <select
          value={selectedSeasonScope}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="w-full px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
        >
          <option value="all">{t.all}</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name?.trim() || s.name} (#{s.season_number})
            </option>
          ))}
        </select>
      </div>

      {winners.length === 0 ? (
        <div className="border border-white/10 rounded px-4 py-12 text-center text-white/40 text-sm">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {winners.map((w) => (
            <WinnerTile key={w.id} w={w} t={t} gradeLabel={gradeLabel} />
          ))}
        </div>
      )}
    </div>
  )
}

function WinnerTile({
  w,
  t,
  gradeLabel,
}: {
  w: WinnerCard
  t: (typeof DICT)['en']
  gradeLabel: Record<Grade, string>
}) {
  return (
    <div className="border border-white/10 rounded bg-white/[.02] overflow-hidden">
      <div className="aspect-video bg-black/40 relative">
        {w.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-white/20 text-[11px]">
            {t.no_video}
          </div>
        )}
        <span className="absolute top-2 left-2 text-2xl drop-shadow">
          {MEDAL[w.awardRank] ?? `#${w.awardRank}`}
        </span>
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-black/60 text-white/70 px-2 py-1 rounded">
          {w.seasonLabel}
        </span>
      </div>

      <div className="p-3">
        <div className="text-sm text-white/90 truncate font-bold">
          {w.videoTitle?.trim() || w.creatorName?.trim() || '—'}
        </div>
        {w.videoTitle && w.creatorName && (
          <div className="mt-0.5 text-[11px] text-white/50 truncate">{w.creatorName}</div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {w.grade ? (
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${GRADE_BADGE_CLASS[w.grade]}`}>
              {gradeLabel[w.grade]}
            </span>
          ) : (
            <span className="text-[10px] text-white/30 uppercase tracking-wider">{t.grade_pending}</span>
          )}
          {w.verifiedScore != null && (
            <span className="text-[11px] text-white/60 font-bold">{Number(w.verifiedScore).toFixed(2)}</span>
          )}
        </div>

        {w.videoUrl && (
          <a
            href={w.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[11px] text-[#ff8844] hover:underline font-bold"
          >
            {t.watch}
          </a>
        )}
      </div>
    </div>
  )
}
