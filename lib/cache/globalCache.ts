// lib/cache/globalCache.ts
//
// Helper para caches singleton compartidos cross-bundle en Next.js.
//
// PROBLEMA QUE RESUELVE:
// Next.js bundlea cada archivo varias veces (Server Component + API Route +
// Middleware + RSC). Un `let xCache: T | null = null` a nivel de módulo crea
// copias INDEPENDIENTES por bundle. Cada request bajo carga inicializa SU
// propia copia, mantiene strong refs vivos, y el GC no puede liberar →
// memory leak progresivo.
//
// Visto en producción: incidente OOM 2026-05-26 14:50-15:10. Cache de slugs
// de leyes (`lib/api/laws/queries.ts`) recargaba ~30 veces/min en lugar de
// 1 vez/h. Memoria del task ECS subía 71%→99.8% en 30 min y OOM kill.
//
// FIX:
// Storage en `globalThis` con key versionada. globalThis es UNA sola
// instancia compartida por todo el runtime Node — todos los bundles
// referencian el mismo slot.
//
// USO:
//
//   import { createGlobalCache } from '@/lib/cache/globalCache'
//
//   const lawsCache = createGlobalCache<LawData>('laws-slugs-v1', 60 * 60 * 1000)
//
//   export async function getLaws() {
//     return lawsCache.getOrLoad(async () => {
//       return await db.select().from(laws).where(...)
//     })
//   }
//
//   export function invalidateLaws() {
//     lawsCache.invalidate()
//   }
//
// REGLA PARA NUEVOS DEVELOPERS:
// Cualquier cache in-memory a nivel de módulo en Vence DEBE usar este helper.
// NUNCA `let xCache: T | null = null` directo — está roto en Next.js bajo
// bundling múltiple.

export interface GlobalCache<T> {
  /** Retorna el valor cacheado, o lo carga vía `loader` si no existe o expiró. */
  getOrLoad(loader: () => Promise<T>): Promise<T>
  /** Borra el cache. La próxima llamada a getOrLoad disparará el loader. */
  invalidate(): void
  /** Lee el cache sin disparar carga. Solo para debug/observability. */
  peek(): T | null
  /** Devuelve true si hay un valor cacheado válido (no expirado). */
  isFresh(): boolean
}

interface CacheEntry<T> {
  value: T
  loadedAt: number
}

/**
 * Crea un cache singleton compartido cross-bundle.
 *
 * @param key Identificador único. **DEBE incluir versión** (`-v1`, `-v2`,
 *   ...) — si cambia la forma del valor cacheado, subir la versión invalida
 *   caches viejos que sobrevivan a hot-reload del runtime.
 * @param ttlMs Tiempo de vida en milisegundos. Tras este tiempo, el próximo
 *   `getOrLoad` recarga.
 */
export function createGlobalCache<T>(key: string, ttlMs: number): GlobalCache<T> {
  // Namespace común para todos los caches de Vence — evita colisiones con
  // libraries externas (Prisma, Supabase SDK, etc.) que también usen
  // globalThis para sus singletons.
  const storageKey = `__vence_cache_${key}`
  type Storage = Record<string, CacheEntry<T> | null | undefined>
  const storage = globalThis as unknown as Storage

  function read(): CacheEntry<T> | null {
    return storage[storageKey] ?? null
  }

  function write(entry: CacheEntry<T> | null): void {
    storage[storageKey] = entry
  }

  return {
    async getOrLoad(loader: () => Promise<T>): Promise<T> {
      const entry = read()
      if (entry && Date.now() - entry.loadedAt < ttlMs) {
        return entry.value
      }
      const value = await loader()
      write({ value, loadedAt: Date.now() })
      return value
    },
    invalidate(): void {
      write(null)
    },
    peek(): T | null {
      return read()?.value ?? null
    },
    isFresh(): boolean {
      const entry = read()
      if (!entry) return false
      return Date.now() - entry.loadedAt < ttlMs
    },
  }
}
