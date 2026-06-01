/**
 * Hook cliente para acceder al catálogo de oposiciones.
 *
 * Triple cache (de más rápido a más lento, fallback en cascada):
 *   1. Memoria del módulo — vive entre montajes, sub-microsegundo.
 *   2. localStorage — vive entre sesiones, ~10ms primer acceso.
 *   3. Fallback estático (OFFICIAL_OPOSICIONES) — SSR + cero downtime.
 *
 * El fetch a `/api/oposiciones/catalog` actualiza en background. Mientras
 * llegan datos frescos, la UI muestra lo que tenga (memoria → localStorage
 * → fallback). Patrón stale-while-revalidate.
 *
 * Roadmap: docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md §Sprint B.
 */

'use client'

import { useEffect, useState } from 'react'
import type { OposicionItem } from '@/components/OnboardingModal'

// v2 (01/06/2026): el id de cada item pasó de UUID de BD a position_type
// (slug con underscores). Bump de versión para invalidar caches v1 cuyos
// items aún guardan el UUID y romperían el badge "implementada" del selector.
const CACHE_KEY = 'oposiciones-catalog-v2'
const CACHE_TTL_MS = 600_000 // 10 min, alineado con el TTL de Redis + Vercel ISR

interface CacheEntry {
  data: OposicionItem[]
  expiresAt: number
}

// Cache module-scoped. Cold start del bundle limpia, lo cual es correcto:
// si una versión nueva del JS llega, queremos releer el endpoint.
let memoryCache: CacheEntry | null = null

// Singleflight para evitar que N componentes que se montan a la vez disparen
// N fetches simultáneos.
let inflightPromise: Promise<OposicionItem[]> | null = null

interface ApiOposicionEntry {
  id: string
  slug: string
  nombre: string
  short_name: string | null
  categoria: string | null
  administracion: string
  coverage_level: string
  is_active: boolean
  demand_score: number | null
}

/**
 * Icono fallback derivado de la administración. Para entradas nuevas
 * (catalogadas) que aún no tienen icon configurado.
 */
function inferIconFromAdmin(admin: string): string {
  const a = admin.toLowerCase()
  if (a.includes('sanitar') || a.includes('salud') || a.includes('osakidetza')) return '🩺'
  if (a.includes('justic')) return '⚖️'
  if (a.includes('correos') || a.includes('postal')) return '📮'
  if (a.includes('universidad')) return '🎓'
  if (a.includes('ayuntamiento') || a.includes('local')) return '🏛️'
  if (a.includes('diputaci')) return '🏛️'
  if (a.includes('comunidad') || a.includes('xunta') || a.includes('generalitat') || a.includes('junta') || a.includes('gobierno') || a.includes('autonóm')) return '🏛️'
  if (a.includes('estado') || a.includes('estatal')) return '🇪🇸'
  return '📋'
}

function mapApiToOposicionItem(api: ApiOposicionEntry): OposicionItem {
  return {
    // El `id` del item DEBE ser el position_type (underscores), no el UUID de BD.
    // Es lo que consume OPOSICION_MAP (clave = positionType) para el badge
    // "implementada" y lo que se guarda en user_profiles.target_oposicion.
    // Convención garantizada: slug (guiones) === positionType (underscores).
    id: api.slug.replace(/-/g, '_'),
    nombre: api.nombre,
    categoria: api.categoria ?? '',
    administracion: api.administracion,
    icon: inferIconFromAdmin(api.administracion),
  }
}

function readLocalStorageCache(): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (typeof parsed?.expiresAt !== 'number' || !Array.isArray(parsed?.data)) return null
    return parsed
  } catch {
    return null
  }
}

function writeLocalStorageCache(entry: CacheEntry): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // localStorage puede estar lleno o deshabilitado — ignorar.
  }
}

async function fetchAndCache(): Promise<OposicionItem[]> {
  if (inflightPromise) return inflightPromise

  inflightPromise = (async () => {
    try {
      const res = await fetch('/api/oposiciones/catalog', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { ok: boolean; oposiciones?: ApiOposicionEntry[] }
      if (!json.ok || !Array.isArray(json.oposiciones)) {
        throw new Error('respuesta inválida del endpoint')
      }
      // Filtrar entradas sin slug: no son navegables y romperían el map
      // (mapApiToOposicionItem deriva el id de slug.replace).
      const items = json.oposiciones.filter(o => !!o.slug).map(mapApiToOposicionItem)
      const entry: CacheEntry = { data: items, expiresAt: Date.now() + CACHE_TTL_MS }
      memoryCache = entry
      writeLocalStorageCache(entry)
      return items
    } finally {
      // Liberar el slot inflight independientemente del resultado.
      inflightPromise = null
    }
  })()

  return inflightPromise
}

/**
 * Devuelve el catálogo de oposiciones. Síncrono — devuelve inmediatamente
 * la mejor fuente disponible (memoria → localStorage → fallback). Si el
 * cache está caducado, dispara fetch en background y re-renderiza cuando
 * lleguen los datos.
 *
 * @param fallback Lista estática (OFFICIAL_OPOSICIONES) usada como base
 *                 mientras llegan los datos frescos. Garantiza SSR + zero downtime.
 */
export function useOposicionesCatalog(fallback: OposicionItem[]): OposicionItem[] {
  const [data, setData] = useState<OposicionItem[]>(() => {
    // Si hay cache de memoria fresco, úsalo (cross-mount).
    if (memoryCache && memoryCache.expiresAt > Date.now()) {
      return memoryCache.data
    }
    // En cliente, intenta leer localStorage.
    if (typeof window !== 'undefined') {
      const local = readLocalStorageCache()
      if (local && local.expiresAt > Date.now()) {
        memoryCache = local
        return local.data
      }
    }
    // SSR o sin cache: fallback estático.
    return fallback
  })

  useEffect(() => {
    // Si el cache de memoria está fresco, no necesitamos fetch.
    if (memoryCache && memoryCache.expiresAt > Date.now()) return

    // Fetch en background. Si falla, mantener datos actuales (fallback o cache stale).
    fetchAndCache()
      .then(items => setData(items))
      .catch(err => {
        // No bloquear UI. Loguear para debug.
        if (typeof console !== 'undefined') {
          console.warn('[useOposicionesCatalog] fetch fallback:', err)
        }
      })
  }, [])

  return data
}
