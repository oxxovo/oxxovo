import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'

export default async function AdminDashboard() {
  const admin = await requireAdmin()
  const supabase = await createSupabaseServer()

  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .order('season_number', { ascending: false })

  const { count: applicationCount } = await supabase
    .from('genesis_applications')
    .select('*', { count: 'exact', head: true })

  const allSeasons = (seasons ?? []) as Season[]
  const currentSeason = allSeasons.find((s) => s.status === 'active') ?? allSeasons[0] ?? null

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl font-black mb-1">Dashboard</h1>
        <p className="text-sm text-white/40">
          Welcome back, {admin.email.split('@')[0]}.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Stat label="Total Seasons" value={allSeasons.length} />
        <Stat
          label="Current Season"
          value={currentSeason?.name ?? '—'}
          sub={currentSeason ? `Season ${currentSeason.season_number} · ${currentSeason.status}` : ''}
        />
        <Stat label="Total Applicants" value={applicationCount ?? 0} />
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-bold">Recent seasons</h2>
          <Link
            href="/admin/seasons"
            className="text-xs text-[#ff8844] hover:underline"
          >
            View all →
          </Link>
        </div>

        <div className="border border-white/10 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Name</th>
                <th className="text-left px-4 py-3 font-bold">#</th>
                <th className="text-left px-4 py-3 font-bold">Status</th>
                <th className="text-right px-4 py-3 font-bold">Prize pool</th>
                <th className="text-right px-4 py-3 font-bold">Capacity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allSeasons.slice(0, 5).map((s) => (
                <tr key={s.id} className="hover:bg-white/[.03]">
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-white/60">{s.season_number}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    ${Number(s.total_prize_pool).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {s.max_applicants.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/seasons/${s.id}`}
                      className="text-[#ff8844] hover:underline text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {allSeasons.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40 text-sm">
                    No seasons yet. <Link href="/admin/seasons/new" className="text-[#ff8844] hover:underline">Create one</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4">Quick actions</h2>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/seasons/new"
            className="px-5 py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm hover:brightness-110 transition"
          >
            + New season
          </Link>
          <Link
            href="/admin/seasons"
            className="px-5 py-3 rounded border border-white/15 text-white/80 font-bold text-sm hover:border-[#ff8844] hover:text-white transition"
          >
            Manage seasons
          </Link>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-white/10 rounded p-5 bg-white/[.02]">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
        {label}
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    draft: 'bg-white/10 text-white/60 border-white/20',
    closed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }
  const cls = colorMap[status] ?? 'bg-white/10 text-white/60 border-white/20'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${cls}`}>
      {status}
    </span>
  )
}
