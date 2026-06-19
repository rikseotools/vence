import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCacheSink, type CacheSink } from './cache-sink';

/**
 * Cache agnóstica por contrato (CacheSink). Mismo contrato que
 * `lib/cache/redis.ts` del frontend — keys, JSON, semánticas idénticas, MISMO
 * proveedor (CACHE_PROVIDER) para coherencia cross-runtime de `cache_version`.
 *
 * Patrón cache-aside con fallback graceful: si la caché cae o tarda, NO bloquea
 * — los callers caen al fetcher (BD). Latencia máx. en fallo = REDIS_TIMEOUT_MS.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly sink: CacheSink | null;
  private readonly enabled: boolean;

  private static readonly REDIS_TIMEOUT_MS = 100;
  private static readonly TIMEOUT_SYMBOL = Symbol('redis_timeout');

  constructor(private readonly config: ConfigService) {
    this.sink = createCacheSink({
      provider: (this.config.get<string>('CACHE_PROVIDER') || 'upstash').toLowerCase(),
      upstashUrl: this.config.get<string>('UPSTASH_REDIS_REST_URL'),
      upstashToken: this.config.get<string>('UPSTASH_REDIS_REST_TOKEN'),
      elasticacheUrl: this.config.get<string>('ELASTICACHE_URL'),
    });
    this.enabled = !!this.sink;
    if (!this.sink) {
      this.logger.warn('Cache NO configurada (sin credenciales del proveedor) — cache bypassed');
    } else {
      this.logger.log(`Cache configurada (proveedor: ${this.sink.name})`);
    }
  }

  /**
   * Race una promesa contra un timeout. Si supera ms, resuelve con un
   * symbol único — mejor que throw que sería ambiguo con errores reales.
   */
  private async raceTimeout<T>(
    p: Promise<T>,
    ms: number,
  ): Promise<T | typeof CacheService.TIMEOUT_SYMBOL> {
    const timeout = new Promise<typeof CacheService.TIMEOUT_SYMBOL>((resolve) =>
      setTimeout(() => resolve(CacheService.TIMEOUT_SYMBOL), ms),
    );
    return Promise.race([p, timeout]);
  }

  /**
   * GET con timeout. Devuelve null en miss, timeout, o cualquier error
   * de Redis (network, parse). El caller decide si hacer fetch a BD.
   */
  async getCached<T>(key: string): Promise<T | null> {
    if (!this.sink) return null;
    try {
      const cached = await this.raceTimeout(
        this.sink.get<T>(key),
        CacheService.REDIS_TIMEOUT_MS,
      );
      if (
        cached !== CacheService.TIMEOUT_SYMBOL &&
        cached !== null &&
        cached !== undefined
      ) {
        return cached;
      }
    } catch {
      // Network / parse error → tratar como miss
    }
    return null;
  }

  /**
   * SET fire-and-forget con TTL. No espera la confirmación de Redis: si
   * falla, la próxima request será otro miss (aceptable). Sin bloquear
   * la respuesta del usuario.
   */
  setCached<T>(key: string, value: T, ttlSeconds: number): void {
    if (!this.sink) return;
    this.sink.set(key, value, ttlSeconds).catch(() => {
      // Silently ignore - el caller ya tiene el valor correcto
    });
  }

  /**
   * Invalidar una clave (DELETE). Best-effort, no bloquea si falla.
   * Útil tras UPDATE en BD para forzar refresh en próxima lectura.
   */
  async invalidate(key: string): Promise<void> {
    if (!this.sink) return;
    try {
      await this.raceTimeout(
        this.sink.del([key]),
        CacheService.REDIS_TIMEOUT_MS,
      );
    } catch {
      // Si falla la invalidación, el TTL eventualmente limpiará el valor stale
    }
  }

  /**
   * Invalidar múltiples claves de un patrón en una sola llamada.
   * Best-effort. Usar tras UPDATE para invalidar caches relacionadas
   * (ej. tras answer-and-save: user_stats + exam_pending + theme_stats).
   *
   * Upstash REST no soporta SCAN, así que pasamos las claves explícitas.
   */
  async invalidateMany(keys: string[]): Promise<void> {
    if (!this.sink || keys.length === 0) return;
    try {
      await this.raceTimeout(
        this.sink.del(keys),
        CacheService.REDIS_TIMEOUT_MS,
      );
    } catch {
      // Si falla, los TTL eventualmente limpian
    }
  }

  /**
   * INCR atómico. Devuelve el nuevo valor tras incrementar (1 si no existía).
   * Operación nativa de Redis/Memcached/DynamoDB/etcd — agnóstica a proveedor.
   *
   * Usado por CacheVersioningService para invalidación tag-like (cada
   * INCR invalida atómicamente todas las cache keys que incluyan la
   * versión anterior). Ver cache-versioning.service.ts.
   */
  async increment(key: string): Promise<number> {
    if (!this.sink) return 0;
    try {
      const result = await this.raceTimeout(
        this.sink.incr(key),
        CacheService.REDIS_TIMEOUT_MS,
      );
      if (result === CacheService.TIMEOUT_SYMBOL) return 0;
      return typeof result === 'number' ? result : Number(result) || 0;
    } catch (err) {
      this.logger.warn(
        `increment(${key}) falló: ${(err as Error).message ?? 'unknown'}`,
      );
      return 0;
    }
  }

  /**
   * GET que parsea a number. Devuelve 0 si miss/error/parse fail.
   * Combinado con `increment` permite implementar el patrón de cache
   * versioned-keys: cliente almacena version como número, lee con
   * getNumber, invalida con increment.
   */
  async getNumber(key: string): Promise<number> {
    if (!this.sink) return 0;
    try {
      const raw = await this.raceTimeout(
        this.sink.get<number | string>(key),
        CacheService.REDIS_TIMEOUT_MS,
      );
      if (raw === CacheService.TIMEOUT_SYMBOL || raw === null || raw === undefined) {
        return 0;
      }
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
}
