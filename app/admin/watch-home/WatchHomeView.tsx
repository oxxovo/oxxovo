'use client'

import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'
import { WatchHomeToggle } from './WatchHomeToggle'

export function WatchHomeView({ initial }: { initial: boolean }) {
  const t = useT()

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <AdminPageHeader title={t.watch_home.title} subtitle={t.watch_home.subtitle} />

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[.02] p-6">
          <WatchHomeToggle initial={initial} />
        </div>
      </div>
    </main>
  )
}
