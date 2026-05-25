import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Helper reusable para tag-like cache invalidation usando keys versionadas.
 *
 * Patrón canónico (Redis docs: "Versioned cache keys"). Usado por Stripe,
 * Shopify, GitHub. AWS ElastiCache best practice.
 *
 *   - Cada "tag" (ej. 'test-config') tiene un contador monotónico en Redis
 *   - Las cache keys incluyen la versión actual: `test-config:v${v}:articles:...`
 *   - Para invalidar todo el tag → INCR del contador (O(1) atómico)
 *   - Las keys con versiones viejas expiran solas por TTL → cero leak
 *
 * Por qué vs alternativas:
 *   - vs SCAN+DEL: SCAN bloquea Redis para tags grandes, no escala
 *   - vs Redis Sets+Lua: Lua es Redis-only (Memcached/DynamoDB no lo tienen).
 *     INCR es universal — agnóstico a cualquier KV moderno.
 *
 * Cross-runtime coherente: Vercel y Fargate leen la MISMA key
 * `cache_version:${tag}` del mismo Upstash. Cuando admin invalida desde
 * Vercel (INCR), backend ve la nueva versión en su próxima `getVersion()`
 * — sin pub/sub, sin sincronización compleja.
 *
 * Cache local con TTL 1s evita 1 GET extra por request. Trade-off: tras
 * invalidación, el backend puede servir stale hasta 1s (despreciable
 * comparado con TTLs reales de 1-24h).
 */
@Injectable()
export class CacheVersioningService {
  private readonly logger = new Logger(CacheVersioningService.name);
  private readonly versionKeyPrefix = 'cache_version:';

  private static readonly LOCAL_TTL_MS = 1_000;
  private readonly localCache = new Map<string, { version: number; ts: number }>();

  constructor(private readonly cache: CacheService) {}

  /**
   * Versión actual del tag. 0 si no existe (válida — primera key tendrá v0).
   */
  async getVersion(tag: string): Promise<number> {
    const cached = this.localCache.get(tag);
    if (cached && Date.now() - cached.ts < CacheVersioningService.LOCAL_TTL_MS) {
      return cached.version;
    }
    const version = await this.cache.getNumber(this.versionKeyPrefix + tag);
    this.localCache.set(tag, { version, ts: Date.now() });
    return version;
  }

  /**
   * INCR atómico → invalida todas las cache keys que incluían la version
   * anterior. Las keys viejas siguen en Redis hasta su TTL natural pero
   * ya nadie las pide (las nuevas requests piden v+1).
   *
   * Llamar tras mutaciones que afecten los datos cacheados del tag.
   */
  async invalidate(tag: string): Promise<number> {
    const newVersion = await this.cache.increment(this.versionKeyPrefix + tag);
    // Invalidar cache local para que la próxima llamada vea la nueva
    // versión sin esperar al TTL local (otros procesos sí esperan TTL local).
    this.localCache.delete(tag);
    this.logger.log(`Tag '${tag}' invalidado → version ${newVersion}`);
    return newVersion;
  }

  /**
   * Construye cache key versionada: `${tag}:v${version}:${subKey}`.
   *
   * @example
   *   await buildKey('test-config', 'articles:lawA:t5')
   *   → 'test-config:v3:articles:lawA:t5'
   */
  async buildKey(tag: string, subKey: string): Promise<string> {
    const version = await this.getVersion(tag);
    return `${tag}:v${version}:${subKey}`;
  }
}
