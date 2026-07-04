// lib/oposicion/oposicionCache.ts
// Caché en localStorage de la oposición resuelta del usuario. Sirve para PRE-HIDRATAR
// OposicionContext antes del paint y evitar la ventana en la que oposicionId=null →
// DEFAULT_MENU (cuyo featured es el primer slug del catálogo = Estado) → un usuario
// logueado que pulsa "practicar" durante la carga navega a Estado (bug Raquel 02-04/07).
//
// Puro y SIN dependencias de React/auth (solo el catálogo) → testeable en aislamiento y
// reutilizable. SSR-safe (no toca window en el servidor). NUNCA cachea un id inválido y
// NUNCA devuelve uno que ya no esté en el catálogo (anti datos-sucios).
import { ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'

const OPO_CACHE_KEY = 'vence_opo_cache_v1'

export interface CachedOposicion {
  id: string
  data: unknown
}

/** Lee la oposición cacheada. null si no hay, está corrupta o el id ya no es válido. */
export function readOposicionCache(): CachedOposicion | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(OPO_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { id?: unknown; data?: unknown }
    if (p && typeof p.id === 'string' && ALL_OPOSICION_IDS.includes(p.id)) {
      return { id: p.id, data: p.data ?? null }
    }
  } catch {
    /* JSON/localStorage roto → sin caché */
  }
  return null
}

/** Cachea la oposición resuelta. Ignora ids inválidos y fallos de localStorage. */
export function writeOposicionCache(id: string, data: unknown): void {
  if (typeof window === 'undefined') return
  if (!ALL_OPOSICION_IDS.includes(id)) return
  try {
    window.localStorage.setItem(OPO_CACHE_KEY, JSON.stringify({ id, data }))
  } catch {
    /* quota / modo privado */
  }
}

/** Borra la caché (logout, oposición inválida o sin oposición). */
export function clearOposicionCache(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(OPO_CACHE_KEY)
  } catch {
    /* noop */
  }
}
