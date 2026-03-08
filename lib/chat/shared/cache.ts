// lib/chat/shared/cache.ts
// Cache en memoria simple con TTL para el sistema de chat
//
// Usado para cachear queries frecuentes que no cambian a menudo:
// - Topics por position_type (cambian raramente)
// - Oposiciones activas (cambian raramente)
// - Hot articles por oposicion (se recalculan periodicamente)

import { logger } from './logger'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly defaultTTL: number

  constructor(defaultTTLMs: number = 1000 * 60 * 30) { // 30 min default
    this.defaultTTL = defaultTTLMs
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  /**
   * Invalida todas las entradas que empiezan con un prefijo
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = []
    this.store.forEach((_, key) => {
      if (key.startsWith(prefix)) keysToDelete.push(key)
    })
    keysToDelete.forEach(k => this.store.delete(k))
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

// Singleton - cache compartido por todo el sistema de chat
let cacheInstance: MemoryCache | null = null

export function getChatCache(): MemoryCache {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache(1000 * 60 * 30) // 30 min TTL
    logger.debug('Chat cache initialized', { domain: 'cache' })
  }
  return cacheInstance
}

// ============================================
// CACHE KEYS
// ============================================

export const CACHE_KEYS = {
  /** Topics por position_type: topics:{positionType} */
  topics: (positionType: string) => `topics:${positionType}`,
  /** Todas las oposiciones activas */
  oposiciones: () => 'oposiciones:all',
  /** Info de oposicion por ID */
  oposicionInfo: (id: string) => `oposicion:${id}`,
  /** Hot articles por oposicion */
  hotArticles: (oposicion: string, law?: string) => `hot:${oposicion}:${law || 'all'}`,
  /** Busqueda de topics por contenido */
  topicSearch: (terms: string, positionType?: string) => `tsearch:${positionType || 'all'}:${terms}`,
} as const

// ============================================
// TTLs
// ============================================

export const CACHE_TTL = {
  /** Topics: cambian muy raramente (1 hora) */
  TOPICS: 1000 * 60 * 60,
  /** Oposiciones: cambian muy raramente (1 hora) */
  OPOSICIONES: 1000 * 60 * 60,
  /** Hot articles: se recalculan periodicamente (30 min) */
  HOT_ARTICLES: 1000 * 60 * 30,
  /** Busquedas de topics: consultas frecuentes (15 min) */
  TOPIC_SEARCH: 1000 * 60 * 15,
} as const
