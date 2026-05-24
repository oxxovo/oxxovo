import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  draft: 'bg-white/10 text-white/60 border-white/20',
  closed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

export default async function SeasonsListPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  await requireAdmin()
  const { deleted } = await searchParams
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('season_number', { ascending: false })

  const seasons = (data ?? []) as Season[]

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">Seasons</h1>
          <p className="text-sm text-white/40">
            All operating parameters for every season.
          </p>
        </div>
        <Link
          href="/admin/seasons/new"
          className="px-5 py-2.5 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm hover:brightness-110 transition"
        >
          + New season
        </Link>
      </header>

      {deleted && (
        <div className="mb-6 px-4 py-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
          Season deleted.
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-sm text-[#ff8888]">
          Failed to load seasons: {error.message}
        </div>
      )}

      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Name</th>
              <th className="text-left px-4 py-3 font-bold">#</th>
              <th className="text-left px-4 py-3 font-bold">Status</th>
              <th className="text-right px-4 py-3 font-bold">Prize pool</th>
              <th className="text-right px-4 py-3 font-bold">Capacity</th>
              <th className="text-right px-4 py-3 font-bold">Top N</th>
              <th className="text-left px-4 py-3 font-bold">Apps open</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {seasons.map((s) => (
              <tr key={s.id} className="hover:bg-white/[.03]">
                <td className="px-4 py-3 font-bold">{s.name}</td>
                <td className="px-4 py-3 text-white/60">{s.season_number}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${STATUS_STYLES[s.status] ?? STATUS_STYLES.draft}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/80">
                  ${Number(s.total_prize_pool).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white/80">
                  {s.max_applicants.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white/80">{s.top_n_advance}</td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {s.application_open_at
                    ? new Date(s.application_open_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/seasons/${s.id}`}
                    className="text-[#ff8844] hover:underline text-xs"
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
            {seasons.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/40 text-sm">
                  No seasons yet.{' '}
                  <Link href="/admin/seasons/new" className="text-[#ff8844] hover:underline">
                    Create the first one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
