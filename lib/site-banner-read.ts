// The one DB read behind the page banners -- SERVER ONLY. Uncached on purpose (pages
// are force-dynamic): replacing a banner row must show at once. Any failure = no
// banners = every page uses the default.
import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { BANNER_PAGES, bannerKey, originOf, parseBanners, type BannerMap } from '@/lib/site-banner'

export async function readBanners(): Promise<BannerMap> {
  try {
    const origin = originOf(process.env.R2_PUBLIC_BASE)
    if (!origin) return {}
    const { data, error } = await createSupabaseAdmin()
      .from('platform_config')
      .select('key, value')
      .in('key', BANNER_PAGES.map(bannerKey))
    if (error || !data) {
      if (error) console.error('[site-banner] read failed code=' + String((error as { code?: unknown }).code ?? 'unknown'))
      return {}
    }
    return parseBanners(data as { key: string; value: unknown }[], origin)
  } catch (e) {
    console.error('[site-banner] exception:', e instanceof Error ? e.name : 'unknown')
    return {}
  }
}
