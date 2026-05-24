import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

/**
 * Cache Redis (Upstash REST). Mismo contrato que `lib/cache/redis.ts`
 * de la app Next.js — keys, JSON, semánticas idénticas.
 *
 * Patrón cache-aside con fallback graceful: si Redis cae o tarda,
 * NO bloquea — los callers caen al fetcher (BD). La latencia añadida
 * en caso de fallo es máximo REDIS_TIMEOUT_MS.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private readonly enabled: boolean;

  private static readonly REDIS_TIMEOUT_MS = 100;
  private static readonly TIMEOUT_SYMBOL = Symbol('redis_timeout');

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      this.logger.warn(
        'Redis NO configurado (faltan UPSTASH_REDIS_REST_URL/TOKEN) — cache bypassed',
      );
      this.redis = null;
      this.enabled = false;
      return;
    }

    this.redis = new Redis({ url, token });
    this.enabled = true;
    this.logger.log('Cache Redis (Upstash) configurado');
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
    if (!this.redis) return null;
    try {
      const cached = await this.raceTimeout(
        this.redis.get<T>(key),
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
    if (!this.redis) return;
    this.redis.set(key, value, { ex: ttlSeconds }).catch(() => {
      // Silently ignore - el caller ya tiene el valor correcto
    });
  }

  /**
   * Invalidar una clave (DELETE). Best-effort, no bloquea si falla.
   * Útil tras UPDATE en BD para forzar refresh en próxima lectura.
   */
  async invalidate(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.raceTimeout(
        this.redis.del(key),
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
    if (!this.redis || keys.length === 0) return;
    try {
      await this.raceTimeout(
        // @upstash/redis acepta del(...spread) o del([array]) — usar spread
        this.redis.del(...keys),
        CacheService.REDIS_TIMEOUT_MS,
      );
    } catch {
      // Si falla, los TTL eventualmente limpian
    }
  }
}
