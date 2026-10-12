// New-site message lookup. Pure: no env, no DB.
//
// Adding a language = a catalog file + one line in CATALOGS here + one line in
// lib/locales.ts. English is canonical: any key a language does not have falls back to
// the English text, so a screen never shows a blank or a raw key, and a screen is one
// language (the requested one, or English where it is missing -- never a mix of two
// non-English languages).
import { DEFAULT_LOCALE } from '@/lib/locales'
import { EN, type MessageKey } from '@/lib/site-messages-en'
import { KO } from '@/lib/site-messages-ko'

export type { MessageKey }
export type Catalog = Partial<Record<MessageKey, string>>

export const CATALOGS: Record<string, Catalog> = {
  en: EN,
  ko: KO,
}

export function message(code: string, key: MessageKey, catalogs: Record<string, Catalog> = CATALOGS): string {
  const own = catalogs[code]?.[key]
  if (typeof own === 'string' && own !== '') return own
  const base = catalogs[DEFAULT_LOCALE]?.[key]
  return typeof base === 'string' ? base : ''
}

export type Translator = (key: MessageKey) => string

export function translator(code: string, catalogs: Record<string, Catalog> = CATALOGS): Translator {
  return (key) => message(code, key, catalogs)
}

// Content titles and descriptions will be translated by AI later (not built yet); the
// seat for it is this pure picker. `translations` maps a language to a content row's
// translated fields. No entry -> the English canonical text, so a content item is never
// shown blank and an untranslated item is never hidden.
export type Translatable = { title: string; description: string | null }
export type ContentTranslations = Record<string, Partial<Translatable> | undefined>

export function pickTranslation<T extends Translatable>(
  content: T,
  code: string,
  translations: ContentTranslations | null | undefined,
): Translatable {
  const t = code === DEFAULT_LOCALE ? undefined : translations?.[code]
  const title = typeof t?.title === 'string' && t.title.trim() !== '' ? t.title : content.title
  const description = typeof t?.description === 'string' && t.description.trim() !== '' ? t.description : content.description
  return { title, description }
}
