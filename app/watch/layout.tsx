// Covers /watch, /watch/[id] and /watch/rankings. The only job: keep these pages out of search
// results until `search_index_allowed` is switched to 'true' (lib/search-index.ts, fail-closed).
// No page under app/watch may set its own `robots` -- the last segment to define it wins.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { isSearchIndexAllowed, searchIndexMetadata } from '@/lib/search-index'

export async function generateMetadata(): Promise<Metadata> {
  return searchIndexMetadata(await isSearchIndexAllowed())
}

export default function WatchLayout({ children }: { children: ReactNode }) {
  return children
}
