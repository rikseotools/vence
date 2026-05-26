// lib/lawSlugAliases.ts - Cache de aliases de slugs de leyes
//
// Carga aliases desde la tabla law_slug_aliases y los cachea en memoria.
// Usado por middleware.ts para redirects 301 SEO-friendly.
// Escalable: añadir alias = solo INSERT en BD, sin tocar código.
//
// Cache cross-bundle via createGlobalCache (ver lib/cache/globalCache.ts).
// Migrado desde `let aliasCache + let cacheLoadedAt` el 2026-05-26 como
// parte del cleanup #118 — el patrón anterior causó el incidente OOM en
// LawsAPI (#117). globalThis es válido también en Edge Runtime.

import { createGlobalCache } from '@/lib/cache/globalCache'

const aliasCache = createGlobalCache<Map<string, string>>('law-slug-aliases-v1', 60 * 60 * 1000)

/**
 * Carga aliases desde BD via Supabase REST API (no necesita SDK).
 * Usa fetch directo para ser compatible con Edge Runtime (middleware).
 */
async function loadAliases(): Promise<Map<string, string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return new Map()

  try {
    const res = await fetch(`${url}/rest/v1/law_slug_aliases?select=alias,canonical_slug`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      next: { revalidate: 3600 }, // Cache en edge por 1h
    })

    if (!res.ok) return new Map()

    const data = await res.json() as Array<{ alias: string; canonical_slug: string }>
    const map = new Map<string, string>()
    for (const row of data) {
      map.set(row.alias, row.canonical_slug)
      // También versión lowercase para case-insensitive matching
      map.set(row.alias.toLowerCase(), row.canonical_slug)
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Obtiene el slug canónico si el input es un alias.
 * Devuelve null si no es un alias (es un slug válido o desconocido).
 */
export async function resolveAlias(slug: string): Promise<string | null> {
  const map = await aliasCache.getOrLoad(loadAliases)
  return map.get(slug) ?? map.get(slug.toLowerCase()) ?? null
}
