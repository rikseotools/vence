import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCacheSink, type CacheSink } from '../cache/cache-sink';

/**
 * Canary de CACHÉ (agnóstica) — detecta caída del cache compartido que CI NO
 * puede cubrir (infra externa, no simulable en jest).
 *
 * (Nombre de archivo/clase LEGACY `redis-upstash`; ahora prueba el proveedor
 * ACTIVO — `CACHE_PROVIDER` = upstash | elasticache — vía `createCacheSink`.)
 *
 * Cada 5 min:
 *   1. SET `canary:cache-ping` con timestamp + TTL 60s.
 *   2. GET y verificar que el valor coincide (sin truncación/corrupción).
 *   3. DEL para limpiar (TTL es backup).
 *
 * Si la caché cae, su modo de fallo es SILENCIOSO: el cache compartido
 * (user_stats/exam_pending/theme_stats/cache_version) deja de servir → cada
 * request va a BD → load 10× → riesgo de cascada 5xx. Sin error visible. Por eso
 * un canary que REALMENTE escribe+lee es la única forma de cazarlo en ~5 min.
 *
 * Usa un sink DEDICADO (no `CacheService`, que es fail-open 100ms y se tragaría
 * el fallo) → aquí queremos saber si la caché responde de verdad.
 */
@Injectable()
export class CanaryRedisUpstashService {
  private readonly logger = new Logger(CanaryRedisUpstashService.name);

  private readonly sink: CacheSink | null;
  private readonly providerName: string;
  private readonly TIMEOUT_MS = 2_000; // 2s — elasticache en-VPC <5ms, upstash REST <100ms

  private static readonly CANARY_KEY = 'canary:cache-ping';

  constructor(config: ConfigService) {
    this.providerName = (config.get<string>('CACHE_PROVIDER') || 'upstash').toLowerCase();
    this.sink = createCacheSink({
      provider: this.providerName,
      upstashUrl: config.get<string>('UPSTASH_REDIS_REST_URL'),
      upstashToken: config.get<string>('UPSTASH_REDIS_REST_TOKEN'),
      elasticacheUrl: config.get<string>('ELASTICACHE_URL'),
    });
    if (!this.sink) {
      this.logger.warn(`Caché (${this.providerName}) sin credenciales — canary inactivo.`);
    }
  }

  async run(): Promise<CanaryRedisResult> {
    const startedAt = Date.now();

    if (!this.sink) {
      return { skipped: true, reason: 'credentials_not_configured', durationMs: Date.now() - startedAt };
    }

    const expectedValue = `canary-${startedAt}`;
    const key = CanaryRedisUpstashService.CANARY_KEY;

    // ─── SET ───
    try {
      await this.timeoutRace(this.sink.set(key, expectedValue, 60));
    } catch (err) {
      return { ok: false, step: 'set', provider: this.providerName, errorMessage: `SET falló (${this.providerName}): ${msgOf(err)}`, durationMs: Date.now() - startedAt };
    }

    // ─── GET + validate ───
    try {
      const actualValue = await this.timeoutRace(this.sink.get<string>(key));
      if (actualValue !== expectedValue) {
        return { ok: false, step: 'validate', provider: this.providerName, errorMessage: `GET devolvió "${actualValue}" pero esperado "${expectedValue}" (corrupción/desincronización)`, durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      return { ok: false, step: 'get', provider: this.providerName, errorMessage: `GET falló (${this.providerName}): ${msgOf(err)}`, durationMs: Date.now() - startedAt };
    }

    // ─── DEL (best-effort, el TTL limpia si falla) ───
    try {
      await this.timeoutRace(this.sink.del([key]));
    } catch (err) {
      this.logger.warn(`DEL canary key falló (no bloqueante, TTL limpia): ${msgOf(err)}`);
    }

    return { ok: true, provider: this.providerName, durationMs: Date.now() - startedAt };
  }

  private async timeoutRace<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`cache timeout >${this.TIMEOUT_MS}ms`)), this.TIMEOUT_MS),
      ),
    ]);
  }
}

function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type CanaryRedisResult =
  | { ok: true; provider: string; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | { ok: false; step: 'set' | 'get' | 'validate'; provider: string; errorMessage: string; durationMs: number };
