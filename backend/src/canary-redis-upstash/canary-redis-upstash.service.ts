import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

/**
 * Canary Redis Upstash — detecta caída del cache compartido que CI NO
 * puede cubrir (es infra externa, no se puede simular en jest).
 *
 * Cada 5 min:
 *   1. SET `canary:redis-ping` con timestamp + TTL 60s.
 *   2. GET y verificar que el valor coincide (sin truncación, sin corrupción).
 *   3. DEL para limpiar (no acumular keys; TTL es backup).
 *
 * Si Redis cae:
 *   - El cache compartido user_stats/exam_pending/theme_stats deja de servir.
 *   - Cascada: cada user request hace queries directas a BD → load 10× → 5xx.
 *   - Hoy se diagnostica POST-incidente. Con canary: 5 min.
 *
 * Usamos instancia Redis dedicada (no CacheService) porque el cache service
 * tiene timeouts agresivos (100ms) que son fail-open por diseño — para el
 * canary queremos saber si REALMENTE responde, no fail-open silencioso.
 */
@Injectable()
export class CanaryRedisUpstashService {
  private readonly logger = new Logger(CanaryRedisUpstashService.name);

  private readonly redis: Redis | null;
  private readonly enabled: boolean;
  private readonly TIMEOUT_MS = 2_000; // 2s — Upstash REST típico <100ms

  // Key dedicada para el canary. TTL 60s por si DEL falla.
  private static readonly CANARY_KEY = 'canary:upstash-ping';

  constructor(config: ConfigService) {
    const url = config.get<string>('UPSTASH_REDIS_REST_URL');
    const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');
    if (!url || !token) {
      this.logger.warn(
        'UPSTASH_REDIS_REST_URL/TOKEN no configurados — canary inactivo.',
      );
      this.redis = null;
      this.enabled = false;
      return;
    }
    this.redis = new Redis({ url, token });
    this.enabled = true;
  }

  async run(): Promise<CanaryRedisResult> {
    const startedAt = Date.now();

    if (!this.enabled || !this.redis) {
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    const expectedValue = `canary-${startedAt}`;

    // ─── SET ───
    try {
      await this.timeoutRace(
        this.redis.set(CanaryRedisUpstashService.CANARY_KEY, expectedValue, {
          ex: 60,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'set',
        errorMessage: `SET falló: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── GET + validate ───
    try {
      const actualValue = await this.timeoutRace(
        this.redis.get<string>(CanaryRedisUpstashService.CANARY_KEY),
      );
      if (actualValue !== expectedValue) {
        return {
          ok: false,
          step: 'validate',
          errorMessage: `GET devolvió "${actualValue}" pero esperado "${expectedValue}" (corrupción / desincronización)`,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'get',
        errorMessage: `GET falló: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── DEL (best-effort, no rompe canary si falla — el TTL limpia) ───
    try {
      await this.timeoutRace(
        this.redis.del(CanaryRedisUpstashService.CANARY_KEY),
      );
    } catch (err) {
      // No es bloqueante: la TTL de 60s ya limpia. Solo log.
      this.logger.warn(
        `DEL canary key falló (no bloqueante, TTL limpia): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { ok: true, durationMs: Date.now() - startedAt };
  }

  private async timeoutRace<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Upstash timeout >${this.TIMEOUT_MS}ms`)),
          this.TIMEOUT_MS,
        ),
      ),
    ]);
  }
}

export type CanaryRedisResult =
  | { ok: true; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step: 'set' | 'get' | 'validate';
      errorMessage: string;
      durationMs: number;
    };
